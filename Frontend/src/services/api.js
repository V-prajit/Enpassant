// Frontend/src/services/api.js

// Cloud Function endpoints
const GEMINI_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const STOCKFISH_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish';

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
 * Get Stockfish analysis for a chess position with progressive updates
 * @param {string} fen - FEN string of the position
 * @param {number} depth - Target analysis depth
 * @param {function} onUpdate - Optional callback for receiving progressive updates
 * @returns {Promise} - Final analysis results
 */
export const getStockfishAnalysis = async (fen, depth = 32, onUpdate = null) => {
  try {
    console.log(`Starting analysis with target depth ${depth}...`);
    const startTime = performance.now();
    
    // First call to start analysis - returns quickly
    const response = await fetch(STOCKFISH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ fen, depth }),
    });
    
    if (!response.ok) {
      throw new Error(`Stockfish analysis failed: ${response.status} ${response.statusText}`);
    }
    
    // Initial result comes back fast (chess.com style)
    const initialResult = await response.json();
    const initialTime = Math.round(performance.now() - startTime);
    console.log(`Initial analysis in ${initialTime}ms at depth ${initialResult.depth}`);
    
    // If caller wants updates, provide the initial result immediately
    if (onUpdate) {
      onUpdate(initialResult);
    }
    
    // If we already got a deep enough analysis or if nobody wants updates, we're done
    if (initialResult.depth >= depth || !onUpdate) {
      return initialResult;
    }
    
    // Start polling for deeper analysis in the background more frequently - every 50ms
    return new Promise((resolve) => {
      let currentDepth = initialResult.depth;
      let lastResult = initialResult;
      let maxPolls = 20; // Increase poll limit for more updates
      
      const pollInterval = setInterval(async () => {
        try {
          // Check for updated analysis with minimum depth requirement
          const statusUrl = `${STOCKFISH_URL.replace(/\/$/, '')}/status/${encodeURIComponent(fen)}?minDepth=${currentDepth + 1}`;
          const pollResponse = await fetch(statusUrl);
          
          if (pollResponse.ok) {
            const updatedResult = await pollResponse.json();
            
            // Update more frequently - even with small progress
            if (updatedResult.depth >= currentDepth) {
              // Always update UI to show progress being made
              console.log(`Updated analysis at depth ${updatedResult.depth}`);
              onUpdate(updatedResult);
              
              // Only update depth tracking if it actually increased
              if (updatedResult.depth > currentDepth) {
                currentDepth = updatedResult.depth;
                lastResult = updatedResult;
              }
              
              // If we reached target depth or analysis is complete, we're done
              if (currentDepth >= depth || updatedResult.completed) {
                clearInterval(pollInterval);
                resolve(updatedResult);
              }
            }
          }
        } catch (err) {
          console.warn('Poll error:', err);
        }
        
        // Decrease remaining polls
        maxPolls--;
        if (maxPolls <= 0) {
          clearInterval(pollInterval);
          resolve(lastResult);
        }
      }, 50); // Poll much more frequently (50ms instead of 200ms)
    });
  } catch (error) {
    console.error('Stockfish API error:', error);
    throw error; // Re-throw to be handled by the caller
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
    console.log(`Getting explanation for ${playerLevel} level...`);
    const startTime = performance.now();
    
    // Direct call to cloud function
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fen,
        evaluation,
        bestMoves,
        playerLevel
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Gemini explanation failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const genTime = Math.round(performance.now() - startTime);
    console.log(`Explanation generated in ${genTime}ms`);
    
    return result;
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // Fallback to mock explanation if cloud function fails
    return getMockAnalysis(fen, playerLevel);
  }
};

/**
 * For backward compatibility - combines both Stockfish and Gemini in one call
 * @param {string} fen - FEN string
 * @param {string} evaluation - Stockfish evaluation
 * @param {Array} bestMoves - Best moves
 * @param {string} playerLevel - Skill level
 * @returns {Promise} - Analysis with explanation
 */
export const getAnalysis = async (fen, evaluation, bestMoves, playerLevel = 'beginner') => {
  return getGeminiExplanation(fen, evaluation, bestMoves, playerLevel);
};

/**
 * Test endpoint that uses mock responses if real backend is unavailable
 */
export const testAnalysis = async (fen, playerLevel = 'beginner') => {
  // First try to get Stockfish analysis
  const stockfishResult = await getStockfishAnalysis(fen);
  
  // Then get Gemini explanation
  return getGeminiExplanation(
    fen, 
    stockfishResult.evaluation, 
    stockfishResult.bestMoves, 
    playerLevel
  );
};