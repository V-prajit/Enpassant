const { VertexAI } = require('@google-cloud/vertexai');

const {
  playerLevelConfig,
  determineGamePhase,
  createOpeningPrompt,
  createMiddlegamePrompt
} = require('./player-levels');

exports.analyzeChessPosition = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') { 
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'tidal-hack25tex-223',
      location: 'us-central1',
    });

    const generativeModel = vertex.preview.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 800,
        temperature: 0.1,
        topP: 0.8,
        topK: 40,
      }
    });

    const { 
      fen, 
      evaluation, 
      bestMoves, 
      playerLevel, 
      isCheckmate, 
      checkmateWinner,
      isGameReport
     } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    const validatedLevel = validLevels.includes(playerLevel) ? playerLevel : 'beginner';
    
    console.log(`Analyzing position for ${validatedLevel} player:`, {
      fen,
      evaluation: evaluation || 'Not provided',
      moves: bestMoves ? `${bestMoves.length} moves` : 'None',
      isCheckmate: isCheckmate || false,
      isGameReport: isGameReport || false
    });

    // Detect game phase first
    const gamePhase = determineGamePhase(fen);
    console.log(`Detected game phase: ${gamePhase}`);

    let prompt;
    if (isGameReport){
      prompt = createGameReportPrompt(fen, evaluation, bestMoves, validatedLevel, isCheckmate, checkmateWinner);
    }
    else if (isCheckmate){
      prompt = createCheckmatePrompt(fen, checkmateWinner, validatedLevel);
    } else {
      switch (gamePhase) {
        case 'opening':
          prompt = createOpeningPrompt(fen, evaluation, bestMoves, validatedLevel);
          break;
        case 'middlegame':
          prompt = createMiddlegamePrompt(fen, evaluation, bestMoves, validatedLevel);
          break;
        case 'endgame':
          prompt = createEndgamePrompt(fen, evaluation, bestMoves, validatedLevel);
          break;
        default:
          // Fallback to a generic prompt if phase detection fails
          prompt = createGenericPrompt(fen, evaluation, bestMoves, validatedLevel);
      }
    }

    console.log('Sending specialized prompt to Gemini...');
    const startTime = Date.now();
    
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseTime = (Date.now() - startTime) / 1000;
    console.log(`Gemini response received in ${responseTime.toFixed(2)} seconds`);

    // Extract text from the response
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                'Sorry, I could not analyze this position due to a technical issue.';

    console.log(`Generated ${text.length} characters of analysis`);

    return res.status(200).json({
      explanation: text,
      responseTime: responseTime,
      gamePhase: gamePhase || 'unknown'
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};


function createEndgamePrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  
  return `
  You are EndgameMaster, a chess endgame coach for a ${playerLevel} player.
  
  Position: ${fen}
  Engine Evaluation: ${evaluation || 'Not available'}
  Best Moves: ${formatBestMoves(bestMoves)}
  
  ## Material Balance
  Analyze the endgame material balance:
  - What pieces remain for each side?
  - Is there a material advantage?
  - Are there pawn imbalances?
  
  ## Endgame Principles
  Identify key endgame principles relevant to this position:
  - King activity and centralization
  - Pawn advancement and promotion potential
  - Piece coordination
  - Key squares and zugzwang potential
  
  ## Technical Assessment
  Provide a technical assessment of the position:
  - Is this a theoretical win, draw, or loss?
  - What are the key defensive resources?
  - Are there fortress positions available?
  
  ## Best Move Explanation
  Explain why the engine's recommended move is strong:
  - How does it contribute to the endgame plan?
  - Does it create threats or prevent opponent's plans?
  - How does it improve piece activity?
  
  ## Endgame Plan
  Provide specific endgame advice for the ${playerLevel} player:
  ${playerLevel === 'beginner' ? 
    'Focus on promoting pawns and activating your king. Kings become powerful pieces in the endgame!' : 
    playerLevel === 'intermediate' ? 
    'Apply opposition concepts and understand when to trade pieces to reach favorable king and pawn endings.' :
    'Analyze the technical winning or drawing methods specific to this endgame type, including opposition, triangulation, and breakthrough techniques.'}
  
  Keep your explanation instructive and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
  ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
  `;
}

function createGenericPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  
  return `
  You are ChessMaster, a chess coach for a ${playerLevel} player.
  
  Position: ${fen}
  Engine Evaluation: ${evaluation || 'Not available'}
  Best Moves: ${formatBestMoves(bestMoves)}
  
  ## Position Assessment
  Analyze the key elements of this position:
  - Material balance
  - Piece activity and coordination
  - King safety
  - Pawn structure
  - Control of key squares
  
  ## Strategic Themes
  Identify the main strategic themes:
  - What plans should each side pursue?
  - Are there weak squares or pieces to target?
  - What pieces should be improved?
  
  ## Tactical Elements
  Note any tactical possibilities:
  - Are there immediate combinations?
  - Any defensive requirements?
  - Any piece coordination opportunities?
  
  ## Best Move Explanation
  Explain why the engine's recommended move is strong:
  - How does it fit into a coherent plan?
  - What immediate threats does it create or address?
  - How does it improve the position overall?
  
  ## Learning Opportunities
  Identify the key learning opportunity for a ${playerLevel} player in this position.
  
  Keep your explanation instructive and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
  ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
  `;
}

// Helper function to format best moves
function formatBestMoves(bestMoves) {
  if (!Array.isArray(bestMoves) || bestMoves.length === 0) {
    return 'Not available';
  }
  
  return bestMoves.map((move, index) => {
    const moveText = move.san || move.uci;
    return `Move ${index + 1}: ${moveText}`;
  }).join('\n');
}

function createCheckmatePrompt(fen, winner, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  
  return `
  You are ChessMaster, a chess coach for a ${playerLevel} player.
  
  Position: ${fen}
  
  ## CHECKMATE POSITION
  This position is a checkmate. ${winner} has won the game.
  
  ## Analysis Task
  Please explain to a ${playerLevel} player:
  1. How the checkmate was achieved
  2. The key tactical patterns that led to checkmate
  3. What the losing side could have done earlier to avoid this outcome
  4. Learning opportunities from this checkmate position
  
  ## Educational Focus
  ${playerLevel === 'beginner' ? 
    'Focus on basic concepts like piece coordination, king safety, and the importance of development. Use simple language.' : 
    playerLevel === 'intermediate' ? 
    'Explain the tactical patterns and strategic errors that led to the checkmate. Discuss defensive resources.' :
    'Provide a detailed analysis of the tactical and strategic factors that led to this checkmate position, including alternative defensive ideas.'}
  
  Keep your explanation instructive and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
  ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
  `;
}

function createGameReportPrompt(fen, evaluation, bestMoves, playerLevel, isCheckmate, winner) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  
  return `
  You are ChessCoach, providing a game report for a ${playerLevel} player.
  
  Current Position: ${fen}
  Game Result: ${isCheckmate ? `Checkmate - ${winner} has won the game.` : 'Game in progress'}
  
  ## Game Report Task
  Please provide a comprehensive game report for a ${playerLevel} player. Include:
  
  1. An assessment of the final position
  2. Key turning points in the game
  3. Strategic and tactical lessons
  4. Recommendations for improvement
  
  ## Educational Focus
  ${playerLevel === 'beginner' ? 
    'Focus on basic concepts like piece development, king safety, and material counting. Use simple language.' : 
    playerLevel === 'intermediate' ? 
    'Explain the strategic and tactical patterns that decided the game. Discuss how pawn structure influenced the result.' :
    'Provide an in-depth analysis of the game, including key decision points, alternative approaches, and strategic themes.'}
  
  ## Player Guidance
  Offer 2-3 specific tips that a ${playerLevel} player could use to improve their chess skills based on this game.
  
  Keep your explanation instructive and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
  ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
  `;
}