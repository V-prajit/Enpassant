// src/services/api.js

// API URLs
const GEMINI_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const STOCKFISH_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish';
const LOCAL_GEMINI_URL = 'http://localhost:8080';
const LOCAL_STOCKFISH_URL = 'http://localhost:8081';

/**
 * Helper function to simulate network delay
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} - Promise that resolves after delay
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get Stockfish analysis for a chess position
 * @param {string} fen - FEN string of the position
 * @param {number} depth - Analysis depth
 * @returns {Promise} - Stockfish analysis
 */
export const getStockfishAnalysis = async (fen, depth = 15) => {
  try {
    // First try local Stockfish server
    try {
      console.log('Trying local Stockfish server...');
      const localResponse = await fetch(LOCAL_STOCKFISH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:5173'
        },
        body: JSON.stringify({ fen, depth }),
      });
      
      if (localResponse.ok) {
        console.log('Successfully connected to local Stockfish server');
        return await localResponse.json();
      }
    } catch (error) {
      console.log('Local Stockfish server not available:', error.message);
    }
    
    // Try production Stockfish server
    console.log('Trying production Stockfish server...');
    const prodResponse = await fetch(STOCKFISH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({ fen, depth }),
    });
    
    if (!prodResponse.ok) {
      throw new Error('Failed to get Stockfish analysis');
    }
    
    console.log('Successfully connected to production Stockfish server');
    return await prodResponse.json();
  } catch (error) {
    console.error('Stockfish API error:', error);
    
    // Return mock analysis
    console.log('Using mock Stockfish analysis');
    
    // Simulate network delay
    await delay(500);
    
    return getMockStockfishAnalysis(fen);
  }
};

/**
 * Get AI explanation for a chess position
 * @param {string} fen - FEN string of the position
 * @param {string} evaluation - Stockfish evaluation
 * @param {Array} bestMoves - Best moves from Stockfish
 * @param {string} playerLevel - Skill level
 * @returns {Promise} - AI explanation
 */
export const getGeminiExplanation = async (fen, evaluation, bestMoves, playerLevel = 'beginner') => {
  try {
    // First try local Gemini server
    try {
      console.log('Trying local Gemini server...');
      const localResponse = await fetch(LOCAL_GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:5173'
        },
        body: JSON.stringify({
          fen,
          evaluation,
          bestMoves,
          playerLevel
        }),
      });
      
      if (localResponse.ok) {
        console.log('Successfully connected to local Gemini server');
        return await localResponse.json();
      }
    } catch (error) {
      console.log('Local Gemini server not available:', error.message);
    }
    
    // Try production Gemini server
    console.log('Trying production Gemini server...');
    const prodResponse = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({
        fen,
        evaluation,
        bestMoves,
        playerLevel
      }),
    });
    
    if (!prodResponse.ok) {
      throw new Error('Failed to get Gemini explanation');
    }
    
    console.log('Successfully connected to production Gemini server');
    return await prodResponse.json();
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Return mock explanation
    console.log('Using mock explanation');
    
    // Simulate network delay
    await delay(1000);
    
    return {
      explanation: `Mock analysis for ${playerLevel} player. This position offers opportunities to control the center and develop your pieces. Consider the pawn structure and king safety in your next moves.`,
      playerLevel
    };
  }
};

/**
 * Generate mock Stockfish analysis
 * @param {string} fen - FEN string
 * @returns {object} - Mock analysis
 */
function getMockStockfishAnalysis(fen) {
  return {
    fen,
    evaluation: '0.3',
    bestMoves: [
      { uci: 'e2e4', san: 'e4' },
      { uci: 'g1f3', san: 'Nf3' },
      { uci: 'd2d4', san: 'd4' }
    ],
    depth: 15
  };
}