const GEMINI_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const STOCKFISH_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish';


const API_TIMEOUT = 10000;
const GEMINI_TIMEOUT = 60000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const getStockfishAnalysis = async (fen, depth = 32, onUpdate = null) => {
  try {
    console.log(`Starting analysis with target depth ${depth}...`);
    const startTime = performance.now();
    
    // First, check if we have a cached analysis available
    try {
      // Use a lower minDepth to increase likelihood of cache hit
      const minDepth = Math.max(8, depth - 10);
      const statusUrl = `${STOCKFISH_URL}/status/${encodeURIComponent(fen)}?minDepth=${minDepth}`;
      
      console.log(`Checking for cached analysis at URL: ${statusUrl}`);
      const cachedResponse = await fetchWithTimeout(statusUrl, { method: 'GET' }, 3000);
      
      if (cachedResponse.ok) {
        const cachedResult = await cachedResponse.json();
        const cachedTime = Math.round(performance.now() - startTime);
        console.log(`Found cached analysis in ${cachedTime}ms at depth ${cachedResult.depth} (requested min: ${minDepth})`);
        
        if (onUpdate) {
          onUpdate(cachedResult);
        }
        
        // If the cached result meets or exceeds our needs, use it directly
        if (cachedResult.depth >= depth || cachedResult.completed) {
          console.log(`Using cached result with depth ${cachedResult.depth} directly`);
          return cachedResult;
        }
        
        // Otherwise, we got a good head start and will continue with polling
        console.log(`Using cached result as baseline at depth ${cachedResult.depth}, continuing analysis`);
        currentDepth = cachedResult.depth;
        lastResult = cachedResult;
      }
    } catch (cacheError) {
      // Ignore cache check errors, just proceed with full analysis
      console.log('No cached analysis found or error checking cache:', cacheError);
      console.log('Performing full analysis');
    }
    
    // Start or continue the analysis
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
    
    const initialResult = await response.json();
    const initialTime = Math.round(performance.now() - startTime);
    console.log(`Initial analysis in ${initialTime}ms at depth ${initialResult.depth}`);
    
    if (onUpdate) {
      onUpdate(initialResult);
    }
    
    if (initialResult.depth >= depth || !onUpdate) {
      return initialResult;
    }
    
    return new Promise((resolve) => {
      let currentDepth = initialResult.depth;
      let lastResult = initialResult;
      let maxPolls = 20;
      
      const pollInterval = setInterval(async () => {
        try {
          // Set minimum depth for polling to just one more than current depth
          const minDepthForPoll = currentDepth + 1;
          const statusUrl = `${STOCKFISH_URL}/status/${encodeURIComponent(fen)}?minDepth=${minDepthForPoll}`;
          console.log(`Polling for updates with minDepth=${minDepthForPoll}`);
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

export const getGeminiExplanation = async (fen, evaluation, bestMoves, playerLevel = 'advanced', isGameReport = false, isCheckmate = false, userQuestion = null, useDeepThink = false) => {
  try {
    console.log(`Getting explanation for ${playerLevel} level...`);
    const startTime = performance.now();
    
    // Check for checkmate if not already specified
    if (!isCheckmate) {
      isCheckmate = evaluation.includes('Checkmate') || (bestMoves.length > 0 && bestMoves[0]?.isCheckmate);
    }
    const gameReportRequested = isGameReport || isCheckmate;

    let checkmateWinner = null;
    if (isCheckmate) {
        if (evaluation.includes('Checkmate')) {
          // Extract winner from evaluation string, if it exists and is properly formatted
          const parts = evaluation.split('-');
          if (parts.length > 1 && parts[1]) {
            checkmateWinner = parts[1].trim();
          } else {
            checkmateWinner = "Unknown"; // Fallback if format is unexpected
          }
        } else if (bestMoves.length > 0 && bestMoves[0]?.winner) {
          // Get winner from bestMoves
          checkmateWinner = bestMoves[0].winner;
        } else {
          checkmateWinner = "Unknown"; // Default fallback
        }
      }

    const requestBody = {
      fen,
      evaluation,
      bestMoves,
      playerLevel,
      isCheckmate: isCheckmate,
      isGameReport: gameReportRequested,
      checkmateWinner: checkmateWinner,
      useDeepThink: useDeepThink // Add the Deep Think option
    };
    
    // Add user question to the request if provided
    if (userQuestion) {
      requestBody.userQuestion = userQuestion;
    }

    const requestData = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    };
    
    const fixedUrl = STOCKFISH_URL.replace('analyzeWithStockfish', 'analyzeChessPosition');
    console.log(`Attempting to use endpoint: ${fixedUrl}`);
    
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
    
    throw new Error(`The AI analysis service is currently unavailable. Please try again later or contact support if the issue persists. (Error: ${error.message})`);
  }
};

export const getAnalysis = async (fen, evaluation, bestMoves, playerLevel = 'beginner') => {
  return getGeminiExplanation(fen, evaluation, bestMoves, playerLevel);
};

