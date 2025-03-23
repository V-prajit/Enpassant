// Frontend/src/services/api.js

// Cloud Function endpoints
const GEMINI_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const STOCKFISH_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish';


// Standard timeout for API calls
const API_TIMEOUT = 10000;  // 10 seconds
const GEMINI_TIMEOUT = 60000;  // 60 seconds - Gemini 2.0 Pro may need more time

// No mock data needed - we're using the real API

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
/**
 * Create a fetch request with timeout
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} - Promise that resolves with fetch response or rejects on timeout
 */
const fetchWithTimeout = async (url, options, timeout = API_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit'
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getGeminiExplanation = async (fen, evaluation, bestMoves, playerLevel = 'beginner') => {
  try {
    console.log(`Getting explanation for ${playerLevel} level...`);
    const startTime = performance.now();
    
    // Create a fix for the Gemini analysis cloud function
    // By explicitly calling the "analyzeChessPosition" function in the same project
    // that has the working Stockfish function
    const requestData = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        fen,
        evaluation,
        bestMoves,
        playerLevel
      })
    };
    
    // Use the same endpoint format as the stockfish one, which is working
    const fixedUrl = STOCKFISH_URL.replace('analyzeWithStockfish', 'analyzeChessPosition');
    console.log(`Attempting to use endpoint: ${fixedUrl}`);
    
    // Use the longer timeout for Gemini 2.0 Pro
    const response = await fetchWithTimeout(fixedUrl, requestData, GEMINI_TIMEOUT);
    
    if (!response.ok) {
      throw new Error(`Gemini explanation failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    const genTime = Math.round(performance.now() - startTime);
    console.log(`Explanation generated in ${genTime}ms`);
    
    return result;
  } catch (error) {
    console.error('Gemini API error:', error);
    
    // If there was an issue, throw a clear error to display to the user
    throw new Error(`The AI analysis service is currently unavailable. Please try again later or contact support if the issue persists. (Error: ${error.message})`);
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