const API_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';

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
  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen,
        evaluation, 
        bestMoves,
        playerLevel,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get analysis');
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

/**
 * Test endpoint that doesn't require Gemini API
 * Useful for development and testing
 */
export const testAnalysis = async (fen) => {
  try {
    const response = await fetch(`${API_URL}/api/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen }),
    });
    
    if (!response.ok) {
      throw new Error('Test analysis failed');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Test API Error:', error);
    throw error;
  }
};
