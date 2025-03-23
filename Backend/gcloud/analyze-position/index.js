// Enhanced Chess Position Analyzer with specialized prompts
const { VertexAI } = require('@google-cloud/vertexai');

// Import player level configurations from player-levels.js
// Create this file in the same directory
const {
  playerLevelConfig,
  determineGamePhase,
  createOpeningPrompt,
  createMiddlegamePrompt
} = require('./player-levels');

exports.analyzeChessPosition = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') { 
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    // Initialize Vertex AI
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

    const { fen, evaluation, bestMoves, playerLevel } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    // Validate playerLevel and set default if invalid
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    const validatedLevel = validLevels.includes(playerLevel) ? playerLevel : 'beginner';
    
    console.log(`Analyzing position for ${validatedLevel} player:`, {
      fen,
      evaluation: evaluation || 'Not provided',
      moves: bestMoves ? `${bestMoves.length} moves` : 'None'
    });

    // Determine the game phase (opening, middlegame, or endgame)
    const gamePhase = determineGamePhase(fen);
    console.log(`Detected game phase: ${gamePhase}`);

    // Create appropriate prompt based on game phase
    let prompt;
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
      gamePhase: gamePhase
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Function to create an endgame-specific prompt
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

// Function to create a generic/fallback prompt
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