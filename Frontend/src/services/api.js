const GEMINI_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition';
const CLOUD_STOCKFISH_URL = 'http://34.42.200.208:8080'; // VM-based Stockfish server
const FUNCTION_STOCKFISH_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish';
// Use browser speech recognition as a fallback when cloud transcription fails
export const GEMINI_AUDIO_URL = 'https://us-central1-tidal-hack25tex-223.cloudfunctions.net/transcribeAudioWithGemini';
// Flag to check if the audio service is working
let audioServiceWorking = true;

const API_TIMEOUT = 10000;
const GEMINI_TIMEOUT = 60000;

// Configuration for analysis sources
const ANALYSIS_CONFIG = {
  preferVM: false, // Set to false to prefer the cloud function for better evaluations
  localFallback: true, // Set to true to enable local Stockfish fallback
  vmUrl: CLOUD_STOCKFISH_URL,
  cloudFunctionUrl: FUNCTION_STOCKFISH_URL,
  vmDepthBoost: 6 // Request higher depth from VM to get better evaluations
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize local Stockfish web worker if needed
let stockfishWorker = null;
let stockfishReady = false;
let currentOnUpdate = null;
let currentFen = null;
let currentLocalDepth = 0;

/**
 * Initialize the Stockfish web worker
 */
function initLocalStockfish() {
  if (stockfishWorker) return;
  
  try {
    stockfishWorker = new Worker('/stockfish-worker.js');
    
    stockfishWorker.onmessage = (e) => {
      const message = e.data;
      
      // Process Stockfish output
      if (typeof message === 'string') {
        if (message.startsWith('bestmove')) {
          // Analysis is complete, extract the best move
          const parts = message.split(' ');
          const bestMove = parts[1];
          
          // If we're in the middle of an active analysis, report completion
          if (currentOnUpdate && currentFen) {
            currentOnUpdate({
              evaluation: currentLocalEvaluation || '0.0',
              bestMoves: currentLocalMoves || [],
              depth: currentLocalDepth,
              source: 'local',
              completed: true
            });
          }
        } else if (message.startsWith('info') && message.includes('depth') && message.includes('score')) {
          // Extract information from the analysis info line
          handleStockfishInfo(message);
        }
      }
    };
    
    // Configure the engine
    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('setoption name Threads value 4');
    stockfishWorker.postMessage('setoption name Hash value 128');
    stockfishWorker.postMessage('setoption name MultiPV value 5');
    stockfishWorker.postMessage('isready');
    
    stockfishReady = true;
    console.log('Local Stockfish engine initialized');
  } catch (error) {
    console.error('Failed to initialize local Stockfish:', error);
    stockfishReady = false;
  }
}

// Track current analysis state for local engine
let currentLocalEvaluation = null;
let currentLocalMoves = [];

/**
 * Parse Stockfish info line to extract evaluation and move information
 */
function handleStockfishInfo(info) {
  try {
    // Only process multipv 1 (best line) or when starting a new set of multipv
    if (!info.includes('multipv 1') && !info.includes('depth')) return;
    
    // Extract depth
    const depthMatch = info.match(/depth (\d+)/);
    if (!depthMatch) return;
    
    const depth = parseInt(depthMatch[1], 10);
    currentLocalDepth = depth;
    
    // Extract score
    let evaluation = '0.0';
    if (info.includes('score cp')) {
      const scoreMatch = info.match(/score cp ([-\d]+)/);
      if (scoreMatch) {
        evaluation = (parseInt(scoreMatch[1], 10) / 100).toString();
      }
    } else if (info.includes('score mate')) {
      const mateMatch = info.match(/score mate ([-\d]+)/);
      if (mateMatch) {
        evaluation = `Mate in ${mateMatch[1]}`;
      }
    }
    
    currentLocalEvaluation = evaluation;
    
    // Extract PV (best move line)
    const pvMatch = info.match(/pv (.+?)($| info)/);
    if (!pvMatch) return;
    
    const moves = pvMatch[1].trim().split(' ');
    const bestMove = moves[0];
    
    // Add to moves if multipv 1 or replace existing
    let updatedMoves = [...currentLocalMoves];
    const moveIndex = info.includes('multipv') ? 
      parseInt(info.match(/multipv (\d+)/)[1], 10) - 1 : 0;
    
    // Ensure the array is big enough
    while (updatedMoves.length <= moveIndex) {
      updatedMoves.push({ uci: '', san: '', evaluation: '' });
    }
    
    updatedMoves[moveIndex] = {
      uci: bestMove,
      pv: moves.join(' '),
      evaluation: evaluation,
      source: 'local'
    };
    
    currentLocalMoves = updatedMoves;
    
    // Send progress update if callback is registered
    if (currentOnUpdate && currentFen && depth >= 8) {
      currentOnUpdate({
        evaluation,
        bestMoves: updatedMoves,
        depth,
        source: 'local',
        completed: false
      });
    }
  } catch (error) {
    console.error('Error parsing Stockfish info:', error);
  }
}

/**
 * Analyze a position with the local Stockfish engine
 */
function analyzeWithLocalStockfish(fen, depth = 18, onUpdate = null) {
  return new Promise((resolve) => {
    if (!stockfishReady) {
      initLocalStockfish();
    }
    
    if (!stockfishReady) {
      // Still not ready, fail gracefully
      resolve({
        evaluation: '0.0',
        bestMoves: [],
        depth: 0,
        source: 'local',
        completed: true,
        error: 'Local Stockfish engine not available'
      });
      return;
    }
    
    // Register the update callback
    currentOnUpdate = onUpdate;
    currentFen = fen;
    currentLocalDepth = 0;
    currentLocalEvaluation = '0.0';
    currentLocalMoves = [];
    
    // Start the analysis
    stockfishWorker.postMessage('stop');
    stockfishWorker.postMessage('position fen ' + fen);
    stockfishWorker.postMessage('go depth ' + depth);
    
    // Wait for a short time to see if we get a quick result
    setTimeout(() => {
      resolve({
        evaluation: currentLocalEvaluation || '0.0',
        bestMoves: currentLocalMoves || [],
        depth: currentLocalDepth,
        source: 'local',
        completed: currentLocalDepth >= depth
      });
    }, 500);
  });
}

/**
 * Get Stockfish analysis for a position
 * Will attempt to use VM server first, then cloud function, then local Stockfish
 */
export const getStockfishAnalysis = async (fen, depth = 32, onUpdate = null) => {
  try {
    console.log(`Starting analysis with target depth ${depth}...`);
    const startTime = performance.now();
    
    // Start local analysis in parallel if enabled
    let localAnalysisPromise = null;
    if (ANALYSIS_CONFIG.localFallback) {
      console.log('Starting local Stockfish analysis in parallel');
      localAnalysisPromise = analyzeWithLocalStockfish(fen, depth, onUpdate);
    }
    
    // Determine primary server URL - VM or Cloud Function
    const primaryUrl = ANALYSIS_CONFIG.preferVM ? ANALYSIS_CONFIG.vmUrl : ANALYSIS_CONFIG.cloudFunctionUrl;
    const backupUrl = ANALYSIS_CONFIG.preferVM ? ANALYSIS_CONFIG.cloudFunctionUrl : ANALYSIS_CONFIG.vmUrl;
    
    // Use the VM endpoint first if preferVM is true
    let result = null;
    let cloudError = null;
    
    // Try the primary server first (VM or Function)
    try {
      console.log(`Trying primary server (${ANALYSIS_CONFIG.preferVM ? 'VM' : 'Function'}) analysis...`);
      result = await tryServerAnalysis(primaryUrl, fen, depth, onUpdate);
      console.log(`Primary server analysis successful at depth ${result.depth}`);
    } catch (err) {
      console.warn(`Primary server analysis failed: ${err.message}`);
      cloudError = err;
      
      // If primary fails, try the backup server (Function or VM)
      try {
        console.log(`Trying backup server (${!ANALYSIS_CONFIG.preferVM ? 'VM' : 'Function'}) analysis...`);
        result = await tryServerAnalysis(backupUrl, fen, depth, onUpdate);
        console.log(`Backup server analysis successful at depth ${result.depth}`);
      } catch (backupErr) {
        console.error(`Backup server analysis failed: ${backupErr.message}`);
        
        // If both cloud options fail, and local analysis was started, wait for its result
        if (localAnalysisPromise) {
          console.log('Using local analysis results as fallback');
          return await localAnalysisPromise;
        }
        
        // If no local analysis, throw the original error
        throw cloudError;
      }
    }
    
    // We have a successful cloud result, cancel local analysis if it was started
    if (localAnalysisPromise && stockfishWorker) {
      console.log('Cloud analysis succeeded, stopping local analysis');
      stockfishWorker.postMessage('stop');
    }
    
    // Return the cloud result
    return result;
  } catch (error) {
    console.error('Stockfish API error:', error);
    throw error; // Re-throw to be handled by the caller
  }
};

/**
 * Try to analyze a position using either the VM or Cloud Function Stockfish server
 */
async function tryServerAnalysis(serverUrl, fen, depth, onUpdate) {
  // Apply depth boost if using VM server
  const isVmServer = serverUrl === ANALYSIS_CONFIG.vmUrl;
  const effectiveDepth = isVmServer ? depth + ANALYSIS_CONFIG.vmDepthBoost : depth;
  
  // Check for cached cloud results first
  try {
    // For proper caching, we should initially check if we have the target depth available
    const statusUrl = `${serverUrl}/status/${encodeURIComponent(fen)}?minDepth=${effectiveDepth}`;
    
    console.log(`Checking for cached analysis at target depth ${effectiveDepth} from ${isVmServer ? 'VM' : 'Cloud Function'}: ${statusUrl}`);
    let cachedResult = null;
    
    try {
      const cachedResponse = await fetchWithTimeout(statusUrl, { method: 'GET' }, 3000);
      
      if (cachedResponse.ok) {
        cachedResult = await cachedResponse.json();
        console.log(`Found cached analysis at depth ${cachedResult.depth}`);
        
        // Add source information
        cachedResult.source = 'cloud';
        
        if (onUpdate) {
          onUpdate(cachedResult);
        }
        
        // Only use cached result if it meets our depth requirements
        if (cachedResult.depth >= (isVmServer ? depth : effectiveDepth)) {
          console.log(`Using cached result with depth ${cachedResult.depth} directly`);
          return cachedResult;
        }
      } else {
        console.warn(`Cache check returned status ${cachedResponse.status} - continuing to full analysis`);
      }
    } catch (fetchError) {
      console.warn(`Error fetching cached results: ${fetchError.message}`);
    }
      
    // Check if we have a valid cached result before continuing with polling
    if (cachedResult) {
      // Continue with polling for deeper analysis using the cached result as baseline
      console.log(`Using cached result as baseline at depth ${cachedResult.depth}, continuing analysis`);
      let currentDepth = cachedResult.depth;
      let lastResult = cachedResult;
      
      // Continue the cloud analysis with polling
      return new Promise((resolve) => {
        let maxPolls = 20;
        
        const pollInterval = setInterval(async () => {
          try {
            // Always look for a deeper analysis
            const minDepthForPoll = currentDepth + 1;
            
            const statusUrl = `${serverUrl}/status/${encodeURIComponent(fen)}?minDepth=${minDepthForPoll}`;
            console.log(`Polling for updates with minDepth=${minDepthForPoll}`);
            const pollResponse = await fetch(statusUrl);
            
            if (pollResponse.ok) {
              const updatedResult = await pollResponse.json();
              updatedResult.source = 'cloud';
              
              // Update UI with progress
              if (updatedResult.depth >= currentDepth) {
                console.log(`Updated analysis at depth ${updatedResult.depth}`);
                onUpdate(updatedResult);
                
                // Only update depth tracking if it actually increased
                if (updatedResult.depth > currentDepth) {
                  currentDepth = updatedResult.depth;
                  lastResult = updatedResult;
                }
                
                // If we reached target depth or analysis is complete, we're done
                if (currentDepth >= (isVmServer ? depth : effectiveDepth) || updatedResult.completed) {
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
            lastResult.source = 'cloud';
            resolve(lastResult);
          }
        }, 200); // Poll every 200ms
      });
    }
    
    console.log('No usable cached analysis found, proceeding with full analysis');
    
  } catch (cacheError) {
    // Ignore cache check errors, proceed with full analysis
    console.log('Error in cache checking process:', cacheError);
    console.log('Performing full analysis');
  }
  
  // Start a new analysis in the cloud using the appropriate depth value
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fen, depth: effectiveDepth }), // Use boosted depth for VM, normal for Cloud Function
  });
  
  if (!response.ok) {
    throw new Error(`Stockfish analysis failed: ${response.status} ${response.statusText}`);
  }
  
  const initialResult = await response.json();
  initialResult.source = 'cloud';
  
  if (onUpdate) {
    onUpdate(initialResult);
  }
  
  if (initialResult.depth >= depth || !onUpdate) {
    return initialResult;
  }
  
  // Continue polling for deeper analysis
  return new Promise((resolve) => {
    let currentDepth = initialResult.depth;
    let lastResult = initialResult;
    let maxPolls = 20;
    
    const pollInterval = setInterval(async () => {
      try {
        const minDepthForPoll = currentDepth + 1;
        
        const statusUrl = `${serverUrl}/status/${encodeURIComponent(fen)}?minDepth=${minDepthForPoll}`;
        console.log(`Polling for updates with minDepth=${minDepthForPoll} from ${isVmServer ? 'VM' : 'Cloud Function'}`);
        const pollResponse = await fetch(statusUrl);
        
        if (pollResponse.ok) {
          const updatedResult = await pollResponse.json();
          updatedResult.source = 'cloud';
          
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
            if (currentDepth >= (isVmServer ? depth : effectiveDepth) || updatedResult.completed) {
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
        lastResult.source = 'cloud';
        resolve(lastResult);
      }
    }, 200); // Poll every 200ms
  });
}

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
    
    // Always use the direct GEMINI_URL to avoid URL transformation issues
    console.log(`Attempting to use endpoint: ${GEMINI_URL}`);
    
    const response = await fetchWithTimeout(GEMINI_URL, requestData, GEMINI_TIMEOUT);
    
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

/**
 * Send audio recording to Gemini for transcription
 * @param {Blob} audioBlob - The recorded audio blob
 * @param {string} fen - The current chess position FEN (for context)
 * @returns {Promise<string>} - Promise that resolves with the transcribed text
 */
export const sendAudioToGemini = async (audioBlob, fen) => {
    try {
      // If we've already determined the service isn't working, fail fast
      if (!audioServiceWorking) {
        throw new Error('Audio transcription service is not available');
      }
  
      // Check audio size - fail early if it's empty
      if (!audioBlob || audioBlob.size < 1000) {
        console.error('Audio blob is too small:', audioBlob?.size || 0, 'bytes');
        throw new Error('Audio recording is too short or empty. Please try again and speak clearly.');
      }
  
      console.log(`Sending audio for transcription (${Math.round(audioBlob.size / 1024)} KB)...`);
      const startTime = performance.now();
      
      // Create a FormData object to send the audio file
      const formData = new FormData();
      
      // Make sure to use a proper filename with extension
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Add chess context
      if (fen) {
        formData.append('fen', fen);
        formData.append('context', 'chess');
      }
      
      // Use a longer timeout for audio processing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      try {
        console.log(`Sending audio to ${GEMINI_AUDIO_URL}...`);
        
        // Add debugging log to view the form data
        console.log('FormData entries:');
        for (const pair of formData.entries()) {
          // Don't log the actual audio content, just its existence
          if (pair[0] === 'audio') {
            console.log('audio: [Blob data]', pair[1].size, 'bytes');
          } else {
            console.log(pair[0] + ': ' + pair[1]);
          }
        }
        
        const response = await fetch(GEMINI_AUDIO_URL, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
          mode: 'cors',
          headers: {
            'Accept': 'application/json'
          },
          credentials: 'omit'
        });
        
        // Clear the timeout since we got a response
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`Audio transcription failed with status: ${response.status}`);
          
          // Try to get more detailed error information
          let errorDetail = '';
          try {
            const errorData = await response.json();
            errorDetail = errorData.error || errorData.message || '';
          } catch (e) {
            // If we can't parse JSON, try to get text
            try {
              errorDetail = await response.text();
            } catch (textError) {
              errorDetail = 'Unknown error';
            }
          }
          
          // Mark the service as not working if we get a server error
          if (response.status === 0 || response.status >= 500) {
            audioServiceWorking = false;
            console.warn('Audio transcription service marked as unavailable');
          }
          
          throw new Error(`Failed to transcribe audio: ${response.status} ${errorDetail}`);
        }
        
        const result = await response.json();
        const processingTime = Math.round((performance.now() - startTime) / 1000);
        
        if (!result.transcription) {
          console.error('No transcription in response:', result);
          throw new Error('No transcription returned from server');
        }
        
        // Service is working if we get here
        audioServiceWorking = true;
        console.log(`Audio transcribed in ${processingTime}s: "${result.transcription}"`);
        
        // If result has a geminiResponse, return both
        if (result.geminiResponse) {
          return {
            transcription: result.transcription,
            geminiResponse: result.geminiResponse
          };
        }
        
        return result.transcription;
      } catch (error) {
        // Make sure to clear the timeout if there's an error
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      
      // If we get a network error or CORS error, mark the service as not working
      if (error.message.includes('Failed to fetch') || 
          error.message.includes('NetworkError') ||
          error.message.includes('CORS')) {
        audioServiceWorking = false;
        console.warn('Audio transcription service marked as unavailable due to network error');
      }
      
      throw error;
    }
  };