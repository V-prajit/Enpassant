// Backend/gcloud/analyze-position/player-levels.js
// Configuration for different player skill levels with enhanced chess expertise
const playerLevelConfig = {
    beginner: {
      concepts: ['piece development', 'controlling the center', 'basic tactics', 'king safety', 'piece values'],
      complexity: 'low',
      terms: ['attack', 'defend', 'protect', 'capture', 'threat', 'check', 'checkmate', 'castle'],
      avoidTerms: ['zugzwang', 'prophylaxis', 'compensation', 'initiative'],
      gamePhases: {
        opening: 'Focus on developing knights and bishops, controlling the central squares (e4, d4, e5, d5), and castling early',
        middlegame: 'Focus on piece activity and king safety',
        endgame: 'Focus on pawn promotion and king activity'
      },
      pieceValues: 'Remember basic piece values: Queen (9), Rook (5), Bishop (3), Knight (3), Pawn (1)'
    },
    intermediate: {
      concepts: ['pawn structure', 'piece coordination', 'tactical patterns', 'initiative', 'active pieces'],
      complexity: 'medium',
      terms: ['pin', 'fork', 'discovered attack', 'overloaded piece', 'tempo', 'outpost', 'weak squares'],
      avoidTerms: ['deep endgame theory', 'prophylaxis subtleties'],
      gamePhases: {
        opening: 'Consider pawn structure implications and piece placement for middlegame plans',
        middlegame: 'Coordinate pieces toward strategic goals and watch for tactical opportunities',
        endgame: 'Understand basic endgame principles for rook, bishop, and knight endings'
      },
      pieceValues: 'Remember that piece activity often matters more than raw material - an active knight on an outpost can be worth more than a passive rook'
    },
    advanced: {
      concepts: ['positional play', 'strategic planning', 'piece imbalances', 'prophylaxis', 'dynamic compensation'],
      complexity: 'high',
      terms: ['counterplay', 'compensation', 'initiative', 'weak squares', 'pawn breaks', 'piece coordination', 'prophylaxis'],
      avoidTerms: [],
      gamePhases: {
        opening: 'Consider specific pawn structures and their strategic implications',
        middlegame: 'Balance positional and tactical elements while forming long-term plans',
        endgame: 'Apply technical precision in converting advantages, including opposite-colored bishop dynamics and rook endgame techniques'
      },
      pieceValues: 'Evaluate pieces contextually - understand when a piece\'s strategic value exceeds its nominal value, such as a knight dominating on d6 versus a trapped rook'
    }
  };
  
  /**
   * Determines the phase of the game based on the FEN position
   * @param {string} fen - Current position in FEN notation
   * @returns {string} - 'opening', 'middlegame', or 'endgame'
   */
  function determineGamePhase(fen) {
    // Count total pieces on the board from FEN
    const piecesSection = fen.split(' ')[0];
    const pieceCount = (piecesSection.match(/[pnbrqkPNBRQK]/g) || []).length;
    
    // Count developed pieces (knights, bishops, rooks, queens)
    const developedPieces = (piecesSection.match(/[NBRQ]/g) || []).length;
    
    if (pieceCount >= 28 && developedPieces <= 4) {
      return 'opening';
    } else if (pieceCount <= 14) {
      return 'endgame';
    } else {
      return 'middlegame';
    }
  }
  
  // Create a specialized opening analysis prompt
  function createOpeningPrompt(fen, evaluation, bestMoves, playerLevel) {
    const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
    
    return `
    You are OpeningMaster, a chess opening coach for a ${playerLevel} player.
    
    Position: ${fen}
    Engine Evaluation: ${evaluation || 'Not available'}
    Best Moves: ${formatBestMoves(bestMoves)}
    
    ## Opening Identification
    Identify the opening or opening family this position belongs to.
    
    ## Development Assessment
    Analyze the development status of both sides:
    - Which pieces are developed and which still need development?
    - Is the king safely castled?
    - How is the center control for both sides?
    
    ## Key Opening Principles
    ${playerLevel === 'beginner' ? 
      'For beginners, focus on the core opening principles: develop knights and bishops, control the center (especially e4, d4, e5, d5), castle early, and connect the rooks. 1.e4 and 1.d4 are excellent first moves to learn.' : 
      playerLevel === 'intermediate' ? 
      'For intermediates, explain how this opening\'s pawn structure shapes the middlegame plans and piece placement.' :
      'For advanced players, analyze the specific strategic ideas in this opening variation and potential transpositions.'}
    
    ## Best Move Explanation
    Explain why the engine's recommended move follows good opening principles:
    - How does it contribute to development?
    - How does it affect center control?
    - Does it prepare for castling or other strategic goals?
    
    ## Common Pitfalls
    Mention one or two common mistakes that players at the ${playerLevel} level might make in this opening position.
    
    Keep your explanation educational and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
    ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
    `;
  }
  
  // Create a specialized middlegame analysis prompt
  function createMiddlegamePrompt(fen, evaluation, bestMoves, playerLevel) {
    const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
    
    return `
    You are MiddlegameMaster, a chess middlegame coach for a ${playerLevel} player.
    
    Position: ${fen}
    Engine Evaluation: ${evaluation || 'Not available'}
    Best Moves: ${formatBestMoves(bestMoves)}
    
    ## Position Structure
    Analyze the key structural elements of this middlegame position:
    - Pawn structure (chains, islands, weak pawns)
    - Piece activity and coordination
    - King safety for both sides
    - Control of key squares, especially in the center (e4, d4, e5, d5)
    - Open files and diagonals
    
    ## Strategic Assessment
    Identify the main strategic themes:
    - Who has the better minor pieces?
    - Are there weak squares to exploit?
    - Which side has better space control?
    - Are there pawn breaks to consider?
    
    ## Tactical Opportunities
    Note any immediate tactical possibilities:
    - Piece combinations
    - Attacking chances
    - Defensive requirements
    
    ## Best Move Explanation
    Explain why the engine's recommended move is strong:
    - How does it fit a strategic plan?
    - What tactical ideas does it support or prevent?
    - How does it improve piece activity?
    
    ## Three Most Important Factors
    Remember that in each middlegame position, a player must consider:
    - King safety
    - Piece activity
    - The opponent's plans and threats
    
    ## Planning Advice
    Provide specific planning advice for the ${playerLevel} player:
    ${playerLevel === 'beginner' ? 
      'Focus on improving your least active pieces and securing your king.' : 
      playerLevel === 'intermediate' ? 
      'Develop a concrete plan based on the pawn structure and piece imbalances.' :
      'Consider both the immediate tactical possibilities and long-term strategic plans based on the specific characteristics of this position.'}
    
    Keep your explanation instructive and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
    ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
    
    Remember: ${config.pieceValues}
    `;
  }
  
  // Create a tactical analysis prompt
  function createTacticalPrompt(fen, evaluation, bestMoves, playerLevel) {
    const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
    
    return `
    You are TacticsMaster, a chess tactics coach for a ${playerLevel} player.
    
    Position: ${fen}
    Engine Evaluation: ${evaluation || 'Not available'}
    Best Moves: ${formatBestMoves(bestMoves)}
    
    ## Tactical Analysis
    Analyze the tactical elements in this position:
    - Identify any immediate tactical motifs (pins, forks, discovered attacks, etc.)
    - Highlight weak pieces or squares that can be exploited
    - Assess any hanging or undefended pieces
    
    ## Calculation Exercise
    For a ${playerLevel} player, walk through the calculation of the best move:
    - What is the initial move?
    - What are the expected responses?
    - What are the follow-up moves?
    
    ## Pattern Recognition
    Identify any common tactical patterns in this position:
    ${playerLevel === 'beginner' ? 
      'Focus on basic patterns like pins, forks, and discovered attacks.' : 
      playerLevel === 'intermediate' ? 
      'Identify combinations involving sacrifices and intermediate moves.' :
      'Analyze complex tactical motifs including deflection, interference, and clearance sacrifices.'}
    
    ## Defensive Tactics
    Identify any defensive resources or tactical threats that must be addressed.
    
    Keep your explanation instructive and appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
    ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
    `;
  }
  
  // Create a specialized skill level prompt
  function createSkillLevelPrompt(fen, evaluation, bestMoves, playerLevel) {
    const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
    
    // Basic template for all skill levels
    return `
    You are ChessCoach, providing chess analysis for a ${playerLevel} player.
    
    Position: ${fen}
    Engine Evaluation: ${evaluation || 'Not available'}
    Best Moves: ${formatBestMoves(bestMoves)}
    
    I need you to provide a comprehensive but skill-appropriate analysis of this position.
    
    Appropriate concepts for ${playerLevel} level: ${config.concepts.join(', ')}
    Appropriate chess terms: ${config.terms.join(', ')}
    ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
    
    For each position, always address:
    - Material balance and basic assessment
    - Key tactical and strategic elements
    - Best move explanation
    
    For this specific level (${playerLevel}), focus on:
    ${config.gamePhases.opening}
    ${config.gamePhases.middlegame}
    ${config.gamePhases.endgame}
    
    ${config.pieceValues}
    
    Make your analysis clear, concise, and educational for a ${playerLevel} player.
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
  
  // Create an endgame analysis prompt
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

  // Add this function to player-levels.js
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
  
  // ChatPrompt function implementation
function createChatPrompt(fen, evaluation, bestMoves, playerLevel, userQuestion, gamePhase) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  
  return `
  You are ChessCoach, a concise chess assistant for a ${playerLevel} level player.
  
  Chess Position: ${fen}
  Engine Evaluation: ${evaluation || 'Not available'}
  Best Moves: ${formatBestMoves(bestMoves)}
  Game Phase: ${gamePhase || 'unknown'}
  
  ## User Question
  "${userQuestion}"
  
  ## Response Guidelines
  1. Focus EXCLUSIVELY on answering the specific question asked - do not provide general position analysis unless requested
  2. Be extremely concise - limit your response to 3-5 sentences maximum
  3. For move-specific questions, directly address the strength or weakness of the move
  4. For position questions, focus only on the most critical elements relevant to the question
  5. Skip pleasantries and unnecessary explanations
  
  ## Response Format
  - Start directly with your answer - no introductions like "Sure, I'd be happy to..."
  - Use bullet points for multiple points
  - For move evaluations, start with a clear judgment (e.g., "e4 is strong because...")
  
  ## Expertise Level
  ${playerLevel === 'beginner' ? 
    'Use simple language. Focus on basic threats, material, and piece activity.' : 
    playerLevel === 'intermediate' ? 
    'Use moderate chess terminology. Include tactical patterns and positional considerations.' :
    'Use advanced chess concepts and precise evaluations.'}
  
  Appropriate terms for this level: ${config.terms.slice(0, 10).join(', ')}${config.terms.length > 10 ? '...' : ''}.
  ${config.avoidTerms.length > 0 ? `Avoid these concepts unless specifically asked: ${config.avoidTerms.slice(0, 5).join(', ')}${config.avoidTerms.length > 5 ? '...' : ''}.` : ''}
  
  Be precise and direct. Imagine you're speaking briefly during a timed chess game.
  `;
}

// Add GenericPrompt function implementation
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

module.exports = {
    playerLevelConfig,
    determineGamePhase,
    createOpeningPrompt,
    createMiddlegamePrompt,
    createEndgamePrompt,
    createTacticalPrompt,
    createSkillLevelPrompt,
    createCheckmatePrompt,
    createGameReportPrompt,
    createChatPrompt,
    createGenericPrompt,
    formatBestMoves
  };