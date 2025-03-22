// Frontend/src/services/api.js
const PRODUCTION_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const LOCAL_URL = 'http://localhost:8080';

/**
 * Try to connect first to local backend, then fallback to production
 * @param {string} endpoint - API endpoint path
 * @param {Object} data - Request data
 * @returns {Promise} - Promise resolving to response
 */
async function fetchWithFallback(endpoint, data) {
  try {
    // First try local development server
    const localResponse = await fetch(`${LOCAL_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (localResponse.ok) {
      console.log('Successfully connected to local backend');
      return await localResponse.json();
    }
    
    console.log('Local backend failed, trying production...');
    
    // Fallback to production
    const prodResponse = await fetch(`${PRODUCTION_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!prodResponse.ok) {
      throw new Error('Both local and production APIs failed');
    }
    
    console.log('Successfully connected to production backend');
    return await prodResponse.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
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
  return fetchWithFallback('', {
    fen,
    evaluation, 
    bestMoves,
    playerLevel,
  });
};

/**
 * Test endpoint that doesn't require Gemini API
 * Useful for development and testing
 */
export const testAnalysis = async (fen) => {
  return fetchWithFallback('', { fen });
};