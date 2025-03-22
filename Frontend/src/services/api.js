// Frontend/src/services/api.js

const PRODUCTION_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const LOCAL_URL = 'http://localhost:8080';

// Mock position explanations for different chess positions
const positionExplanations = {
  // Starting position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': `
This is the starting position of a chess game.

As a beginner player, your main goals are:
1. Control the center of the board with pawns (e4 or d4 are strong first moves)
2. Develop your knights and bishops to active squares
3. Castle early to protect your king
4. Connect your rooks by moving the queen

White has the first move advantage. Common openings include 1.e4 (King's Pawn), 1.d4 (Queen's Pawn), or 1.Nf3 (Réti Opening).
  `,

  // White pawn promotion position
  '7k/1P6/8/8/8/8/8/K7': `
This position shows a white pawn on the 7th rank about to promote.

As a beginner player, this is a critical moment:
1. Moving the pawn to b8 will allow promotion, typically to a queen
2. Promotion to a queen gives you a massive material advantage
3. After promotion, focus on checkmating the opponent's king
4. Be careful of stalemate positions - make sure the king has legal moves

This is a winning position for White with proper play.
  `,

  // Black pawn promotion position
  'k7/8/8/8/8/8/1p6/K7': `
This position has a black pawn on the 2nd rank ready to promote.

As a beginner player, you should:
1. Advance the pawn to b1 and promote to a queen
2. Be careful of stalemate - make sure White's king has legal moves after you promote
3. With your new queen, you can quickly checkmate the white king
4. Keep your king safe while you execute the checkmate

This is a winning position for Black with accurate play.
  `,

  // Ruy Lopez position
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': `
This position resembles the Ruy Lopez opening after 1.e4 e5 2.Nf3 Nc6.

As a beginner player, understanding this popular opening helps:
1. White has developed the knight to a good square, attacking Black's e5 pawn
2. Black has defended with the knight, also developing a piece
3. White often continues with 3.Bb5, pinning the knight
4. This is one of the oldest and most respected openings in chess

Both sides are developing their pieces toward the center, following good opening principles.
  `,
};

/**
 * Get a mock analysis for a chess position
 * @param {string} fen - FEN string of the position
 * @param {string} playerLevel - Skill level (beginner, intermediate, advanced)
 * @returns {object} - Mock analysis result
 */
function getMockAnalysis(fen, playerLevel = 'beginner') {
  // Extract just the board position part of FEN (the part before the first space)
  const boardPosition = fen.split(' ')[0];
  
  // Try to find an exact match for the position
  let explanation = positionExplanations[boardPosition];
  
  // If no exact match, provide a generic response
  if (!explanation) {
    explanation = `
Chess position analysis for this position.

As a ${playerLevel} player, here are key considerations:
1. Evaluate the material balance
2. Look for tactical opportunities and threats
3. Develop your pieces toward the center
4. Consider pawn structure and king safety

Focus on finding the best moves through calculation and applying chess principles.
    `;
  }
  
  return {
    explanation: explanation.trim(),
  };
}

/**
 * Simulate a network delay
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after the delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Try to connect to backends with fallback to mock service
 * @param {Object} data - Request data
 * @returns {Promise} - Promise resolving to response
 */
async function fetchWithFallback(data) {
  // First try local backend
  try {
    console.log('Trying local backend...');
    const localResponse = await fetch(LOCAL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(data),
    });
    
    if (localResponse.ok) {
      console.log('Successfully connected to local backend');
      return await localResponse.json();
    }
  } catch (error) {
    console.log('Local backend not available:', error.message);
  }
  
  // Next try production backend
  try {
    console.log('Trying production backend...');
    const prodResponse = await fetch(PRODUCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify(data),
    });
    
    if (prodResponse.ok) {
      console.log('Successfully connected to production backend');
      return await prodResponse.json();
    }
  } catch (error) {
    console.log('Production backend not available:', error.message);
  }

  // Finally, fall back to mock responses
  console.log('Using mock responses as fallback');
  
  // Simulate network delay between 500-1500ms
  const delayTime = 500 + Math.random() * 1000;
  await delay(delayTime);
  
  return getMockAnalysis(data.fen, data.playerLevel);
}

/**
 * Get AI-powered analysis for a chess position
 * 
 * @param {string} fen - FEN string representing the chess position
 * @param {string} evaluation - Stockfish evaluation (e.g. "+0.5")
 * @param {Array} bestMoves - Array of best moves, each with san and uci properties
 * @param {string} playerLevel - Skill level of player (beginner, intermediate, advanced)
 * @returns {Promise} - Promise resolving to the analysis result
 */
export const getAnalysis = async (fen, evaluation, bestMoves, playerLevel = 'beginner') => {
  return fetchWithFallback({
    fen,
    evaluation, 
    bestMoves,
    playerLevel,
  });
};

/**
 * Test endpoint that uses mock responses if real backend is unavailable
 */
export const testAnalysis = async (fen, playerLevel = 'beginner') => {
  return fetchWithFallback({ 
    fen,
    playerLevel
  });
};