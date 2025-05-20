// Enpassant/Frontend/src/services/api.js

let stockfishWorker = null;
let stockfishReady = false; // True when 'uciok' and 'readyok' have been received and options set
let isInitializing = false; // To prevent multiple initializations
let currentOnUpdate = null;
let currentAnalysisResolver = null;

let currentLocalDepth = 0;
let currentLocalEvaluation = '0.0';
let currentLocalMoves = []; // Stores { uci, san, pvString, pvArray, evaluation, depth }

function initLocalStockfish() {
  // If a worker exists or is already in the process of initializing, don't start over.
  if (stockfishWorker || isInitializing) {
    if (stockfishWorker && !stockfishReady) {
      // If worker exists but not ready, it might be waiting for 'isready' response
      // console.log('initLocalStockfish: Worker exists but not ready. Will rely on analyzeWithLocalStockfish to poke.');
    } else if (isInitializing) {
      // console.log('initLocalStockfish: Initialization already in progress.');
    }
    return;
  }

  isInitializing = true;
  console.log('[Stockfish Log] initLocalStockfish: Starting initialization...');

  try {
    stockfishWorker = new Worker('/stockfish-nnue-16-single.js'); // Ensure this path is correct

    stockfishWorker.onmessage = (event) => {
      const message = event.data;
      // console.log(`[Stockfish Raw Msg]: ${message}`); // Verbose

      if (typeof message === 'string') {
        if (message.includes('uciok')) {
          console.log('[Stockfish Log] Received uciok. Sending isready.');
          stockfishWorker.postMessage('isready');
        } else if (message.includes('readyok')) {
          console.log('[Stockfish Log] Received readyok.');
          if (!stockfishReady) { // Check stockfishReady to avoid redundant setup
            console.log('[Stockfish Log] Stockfish engine is ready. Setting MultiPV option.');
            stockfishWorker.postMessage('setoption name MultiPV value 5');
            // Consider 'readyok' after setoption as the true ready state,
            // but for many engines, they are ready to receive 'go' after options.
            // For simplicity, we'll assume it's ready here.
            stockfishReady = true;
            isInitializing = false; // Initialization complete
            console.log('[Stockfish Log] stockfishReady is now true.');
            // If an analysis was queued, analyzeWithLocalStockfish's tryAnalysis will pick it up.
          } else {
            console.log('[Stockfish Log] Received readyok, but stockfishReady was already true.');
             isInitializing = false; // Ensure this is reset
          }
        } else if (message.startsWith('info')) {
          parseStockfishInfo(message);
          if (currentOnUpdate && currentLocalDepth > 0) {
            const processedMoves = currentLocalMoves.filter(m => m && m.uci).map(m => ({
              uci: m.uci, san: m.san, pv: m.pvString, evaluation: m.evaluation,
              depth: m.depth || currentLocalDepth, source: 'local'
            })).slice(0, 5);
            currentOnUpdate({
              evaluation: currentLocalEvaluation, bestMoves: processedMoves,
              depth: currentLocalDepth, source: 'local', completed: false
            });
          }
        } else if (message.startsWith('bestmove')) {
          console.log('[Stockfish Log] Received bestmove.');
          parseStockfishBestmove(message);
          const finalProcessedMoves = currentLocalMoves.filter(m => m && m.uci).map(m => ({
            uci: m.uci, san: m.san, pv: m.pvString, evaluation: m.evaluation,
            depth: m.depth || currentLocalDepth, source: 'local'
          })).slice(0, 5);

          if (currentOnUpdate) {
            currentOnUpdate({
              evaluation: currentLocalEvaluation, bestMoves: finalProcessedMoves,
              depth: currentLocalDepth, source: 'local', completed: true
            });
          }
          if (currentAnalysisResolver && currentAnalysisResolver.resolve) {
            currentAnalysisResolver.resolve({
              evaluation: currentLocalEvaluation, bestMoves: finalProcessedMoves,
              depth: currentLocalDepth, source: 'local', completed: true
            });
          }
          currentAnalysisResolver = null; // Clear resolver after use
        }
      }
    };

    stockfishWorker.onerror = (error) => {
      console.error('[Stockfish Log] Worker onerror:', error);
      stockfishReady = false;
      isInitializing = false;
      if (stockfishWorker) {
        stockfishWorker.terminate(); // Terminate the faulty worker
      }
      stockfishWorker = null; // Allow re-creation on next call
      if (currentAnalysisResolver && currentAnalysisResolver.reject) {
        currentAnalysisResolver.reject(new Error('Stockfish worker error'));
      }
      currentAnalysisResolver = null;
    };

    stockfishWorker.onmessageerror = (error) => {
      console.error('[Stockfish Log] Worker onmessageerror:', error);
      // Similar handling to onerror might be needed if this indicates a critical issue
    };
    
    console.log('[Stockfish Log] initLocalStockfish: Sending uci.');
    stockfishWorker.postMessage('uci');

  } catch (error) {
    console.error('[Stockfish Log] Failed to initialize local Stockfish worker:', error);
    stockfishReady = false;
    isInitializing = false;
    stockfishWorker = null; // Ensure it's null so it can be retried
  }
}

function parseStockfishInfo(infoString) {
  const depthMatch = infoString.match(/depth (\d+)/);
  const selDepthMatch = infoString.match(/seldepth (\d+)/);
  const lineDepth = depthMatch ? parseInt(depthMatch[1], 10) : currentLocalDepth;
  if (depthMatch) currentLocalDepth = Math.max(currentLocalDepth, lineDepth);

  let lineEvaluation = currentLocalEvaluation;
  if (infoString.includes(' score cp ')) {
    const scoreMatch = infoString.match(/score cp ([-\d]+)/);
    if (scoreMatch) lineEvaluation = (parseInt(scoreMatch[1], 10) / 100).toFixed(2).toString();
  } else if (infoString.includes(' score mate ')) {
    const mateMatch = infoString.match(/score mate ([-\d]+)/);
    if (mateMatch) {
      const mateVal = parseInt(mateMatch[1], 10);
      lineEvaluation = mateVal > 0 ? `Mate in ${mateVal}` : `Mated in ${Math.abs(mateVal)}`;
    }
  }

  const multipvMatchImmediate = infoString.match(/multipv (\d+)/);
  if ((multipvMatchImmediate && parseInt(multipvMatchImmediate[1],10) === 1) || (currentLocalMoves.length === 0 && !multipvMatchImmediate) ) {
    currentLocalEvaluation = lineEvaluation;
  }

  const multipvMatch = infoString.match(/multipv (\d+)/);
  const mpvIndex = multipvMatch ? parseInt(multipvMatch[1], 10) - 1 : 0;

  while (currentLocalMoves.length <= mpvIndex) {
    currentLocalMoves.push({ uci: '', san: '', pvString: '', pvArray: [], evaluation: '0.0', depth: 0 });
  }
  
  currentLocalMoves[mpvIndex] = currentLocalMoves[mpvIndex] || { uci: '', san: '', pvString: '', pvArray: [], evaluation: '0.0', depth: 0 };
  currentLocalMoves[mpvIndex].evaluation = lineEvaluation;
  currentLocalMoves[mpvIndex].depth = lineDepth;

  if (infoString.includes(' pv ')) {
    const pvRegEx = / pv (.+?)($| (?:nodes|nps|tbhits|wdl|hashfull|currmove|currmovenumber|cpuload|string|score|depth|seldepth|time|currlc|upperbound|lowerbound))/;
    const pvDataMatch = infoString.match(pvRegEx);
    if (pvDataMatch && pvDataMatch[1]) {
      const pvArray = pvDataMatch[1].trim().split(' ');
      currentLocalMoves[mpvIndex].uci = pvArray[0] || currentLocalMoves[mpvIndex].uci; // Keep old if new is empty
      currentLocalMoves[mpvIndex].san = pvArray[0] || currentLocalMoves[mpvIndex].san; // Placeholder
      currentLocalMoves[mpvIndex].pvString = pvArray.join(' ');
      currentLocalMoves[mpvIndex].pvArray = pvArray;
    }
  }
   if (currentLocalMoves.length > 5) {
    currentLocalMoves = currentLocalMoves.slice(0, 5);
  }
}

function parseStockfishBestmove(bestmoveString) {
    const parts = bestmoveString.split(' ');
    if (parts.length >= 2 && parts[0] === 'bestmove') {
        const bestMoveUci = parts[1];
        const ponderMatch = bestmoveString.match(/ponder (\S+)/);
        const ponderMove = ponderMatch ? ponderMatch[1] : null;

        let bestMoveLineIndex = currentLocalMoves.findIndex(m => m.uci === bestMoveUci);

        if (bestMoveLineIndex !== -1) {
            const bestLine = currentLocalMoves.splice(bestMoveLineIndex, 1)[0];
            currentLocalMoves.unshift(bestLine);
        } else {
            currentLocalMoves.unshift({
                uci: bestMoveUci, san: bestMoveUci, 
                pvString: ponderMove ? `${bestMoveUci} ${ponderMove}` : bestMoveUci,
                pvArray: ponderMove ? [bestMoveUci, ponderMove] : [bestMoveUci],
                evaluation: currentLocalEvaluation, depth: currentLocalDepth
            });
        }
        currentLocalMoves = currentLocalMoves.slice(0, 5);
    }
}

let analysisQueue = Promise.resolve(); // Sequential promise queue for analysis requests

function analyzeWithLocalStockfish(fen, depth = 18, onUpdate = null) {
  // Chain onto the existing queue
  const analysisPromise = analysisQueue.then(() => {
    return new Promise((resolve, reject) => {
      console.log(`[Stockfish Log] analyzeWithLocalStockfish: Queued for FEN: ${fen}, Depth: ${depth}`);
      
      if (!stockfishWorker && !isInitializing) {
        console.log("[Stockfish Log] analyzeWithLocalStockfish: Worker is null and not initializing. Calling initLocalStockfish.");
        initLocalStockfish(); // Attempt to initialize if not already
      } else if (stockfishWorker && !stockfishReady && !isInitializing) {
        // If worker exists but isn't ready (and not currently trying to init), poke it.
        console.log("[Stockfish Log] analyzeWithLocalStockfish: Worker exists but not ready. Sending 'isready'.");
        stockfishWorker.postMessage('isready');
      }


      let attempts = 0;
      const maxAttempts = 100; // Increased to 10 seconds (100 * 100ms)
      
      const tryAnalysis = () => {
        if (stockfishReady) {
          console.log(`[Stockfish Log] analyzeWithLocalStockfish: Stockfish is ready. Starting analysis for FEN: ${fen}`);
          currentOnUpdate = onUpdate;
          currentAnalysisResolver = { resolve, reject };
          currentLocalDepth = 0;
          currentLocalEvaluation = '0.0';
          currentLocalMoves = [];

          stockfishWorker.postMessage('stop');
          stockfishWorker.postMessage('ucinewgame');
          // MultiPV is set after readyok in initLocalStockfish
          stockfishWorker.postMessage('position fen ' + fen);
          stockfishWorker.postMessage('go depth ' + depth);
        } else {
          attempts++;
          if (attempts > maxAttempts) {
            console.warn(`[Stockfish Log] analyzeWithLocalStockfish: Stockfish not ready after ${maxAttempts} attempts for FEN: ${fen}. Rejecting.`);
            reject(new Error(`Stockfish engine timed out. isInitializing: ${isInitializing}, stockfishReady: ${stockfishReady}`));
          } else {
            if (attempts % 20 === 0) { // Log progress periodically
                 console.log(`[Stockfish Log] analyzeWithLocalStockfish: Waiting for stockfishReady... (Attempt ${attempts}/${maxAttempts}) isInitializing: ${isInitializing}`);
            }
            if (!stockfishWorker && !isInitializing) { // If worker died and we are not trying to re-init
                console.log("[Stockfish Log] analyzeWithLocalStockfish: Worker became null while waiting. Re-initializing.");
                initLocalStockfish();
            } else if (stockfishWorker && !isInitializing && !stockfishReady) {
                // Periodically send 'isready' if stuck and not initializing
                if (attempts % 10 === 0) stockfishWorker.postMessage('isready');
            }
            setTimeout(tryAnalysis, 100);
          }
        }
      };
      tryAnalysis();
    });
  });
  // Update the queue to this new promise
  analysisQueue = analysisPromise.catch(() => {}); // Catch to ensure queue continues
  return analysisPromise;
}

export const getStockfishAnalysis = async (fen, depth = 18, onUpdate = null) => {
  console.log(`[Stockfish API] getStockfishAnalysis called for FEN: ${fen}, Depth: ${depth}`);
  // Ensure worker is initialized once globally if not already.
  // Subsequent calls will use the existing worker via analyzeWithLocalStockfish.
  if (!stockfishWorker && !isInitializing) {
    initLocalStockfish();
  }
  
  try {
    const result = await analyzeWithLocalStockfish(fen, depth, onUpdate);
    console.log(`[Stockfish API] Analysis completed. Depth: ${result.depth}, Eval: ${result.evaluation}, Top PV: ${result.bestMoves[0]?.pv}`);
    return result;
  } catch (error) {
    console.error('[Stockfish API] Error in getStockfishAnalysis:', error);
    return {
      evaluation: 'Error', bestMoves: [], depth: 0,
      source: 'local', completed: true, error: error.message
    };
  }
};


// --- Speech Synthesis Functions (copied from your previous version, ensure they are complete) ---
export const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export const prepareAnalysisForSpeech = (analysis) => {
  if (!analysis) return "";
  
  const handleFormatting = (text) => {
    let processed = text.replace(/\*\*([^*]+)\*\*/g, ", $1, ");
    processed = processed.replace(/^\s*\*\s+/gm, ". Bullet point: ");
    return processed;
  };

  let processedText = analysis
    .replace(/\+(\d+\.\d+)/g, "plus $1")
    .replace(/-(\d+\.\d+)/g, "minus $1")
    .replace(/([KQNBR]?)x([a-h]\d)/g, "$1 takes $2 ")
    .replace(/([a-h])x([a-h]\d)/g, "$1 takes $2 ")
    .replace(/\+$/g, " check")
    .replace(/\#$/g, " checkmate")
    .replace(/O-O-O/g, "Queen side castle")
    .replace(/O-O/g, "King side castle")
    .replace(/([a-h])(\d)/g, "$1 $2")
    .replace(/([KQNBR])([a-h])(\d)/g, "$1 to $2 $3")
    .replace(/\bK\b/g, "King")
    .replace(/\bQ\b/g, "Queen")
    .replace(/\bR\b/g, "Rook")
    .replace(/\bB\b/g, "Bishop")
    .replace(/\bN\b/g, "Knight")
    .replace(/\s+K\s+/g, " King ")
    .replace(/\s+Q\s+/g, " Queen ")
    .replace(/\s+R\s+/g, " Rook ")
    .replace(/\s+B\s+/g, " Bishop ")
    .replace(/\s+N\s+/g, " Knight ")
    .replace(/[Mm]ate in (\d+)/g, "Mate in $1 moves")
    .replace(/e\.p\./g, "en passant");


  return handleFormatting(processedText);
};

export const speakText = (text, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!synth) {
      const error = new Error("Speech synthesis not supported in this browser");
      if (options.onError) options.onError(error);
      return reject(error);
    }

    if (synth.speaking) {
      console.log("[Speech Log] Cancelling ongoing speech for new request...");
      synth.cancel();
      // Add a slight delay to ensure cancel completes before new speech starts
      // This can sometimes help with abrupt cutoffs or issues on some browsers
      setTimeout(() => startSpeech(text, options, resolve, reject), 50);
    } else {
      startSpeech(text, options, resolve, reject);
    }
  });
};

function startSpeech(text, options, resolve, reject) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = options.pitch || 1.0;
    utterance.rate = options.rate || 1.0;
    utterance.volume = options.volume || 1.0;

    if (options.voice) {
      const voices = synth.getVoices();
      // Ensure voices are loaded, might be async on some browsers
      if (voices.length === 0) {
        synth.onvoiceschanged = () => {
            const updatedVoices = synth.getVoices();
            const selectedVoice = updatedVoices.find(voice => voice.name === options.voice);
            if (selectedVoice) utterance.voice = selectedVoice;
            synth.speak(utterance);
        };
      } else {
        const selectedVoice = voices.find(voice => voice.name === options.voice);
        if (selectedVoice) utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => {
      console.log("[Speech Log] Speech started for text:", text.substring(0, 50) + "...");
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      console.log("[Speech Log] Speech ended.");
      if (options.onEnd) options.onEnd();
      resolve();
    };

    utterance.onerror = (event) => {
      console.error("[Speech Log] Speech synthesis error:", event.error);
      if (options.onError) options.onError(event);
      reject(event);
    };

    try {
        synth.speak(utterance);
    } catch (e) {
        console.error("[Speech Log] Error calling synth.speak:", e);
        reject(e);
    }
}


export const stopSpeech = () => {
  if (synth && synth.speaking) {
    console.log("[Speech Log] stopSpeech called, cancelling active speech.");
    synth.cancel();
  }
};

// --- Gemini API Call (ensure this is complete from your file) ---
export const getGeminiExplanation = async (
  fen,
  evaluation,
  bestMoves,
  playerLevel = 'beginner',
  isGameReport = false,
  isCheckmate = false,
  userQuestion = null,
  useDeepThink = false
) => {
  const geminiApiUrl = import.meta.env.VITE_GEMINI_URL;

  if (!geminiApiUrl) {
    console.warn('[Gemini API] VITE_GEMINI_URL is not set. Using mock Gemini response.');
    return {
      explanation: `Mock explanation for FEN: ${fen}. Player level: ${playerLevel}. Deep Think: ${useDeepThink}. Question: ${userQuestion || 'N/A'}. Evaluation: ${evaluation}. Best Moves: ${JSON.stringify(bestMoves)}`,
      responseTime: 0.1,
      model: 'offline-mock',
      deepThinkMode: useDeepThink,
      gamePhase: 'unknown'
    };
  }

  try {
    console.log(`[Gemini API] Requesting Gemini explanation from: ${geminiApiUrl}`);
    const response = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen,
        evaluation,
        bestMoves, // This will now include the 'pv' field
        playerLevel,
        isGameReport,
        isCheckmate,
        checkmateWinner: isCheckmate ? (fen.split(' ')[1] === 'w' ? 'Black' : 'White') : null,
        userQuestion,
        useDeepThink
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP error! status: ${response.status}`);
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch(e) {
        errorData = { error: errorText };
      }
      console.error('[Gemini API] Error from Gemini explanation service:', errorData);
      throw new Error(errorData.error || `Failed to get explanation. Status: ${response.status}`);
    }

    const result = await response.json();
    console.log('[Gemini API] Gemini explanation received successfully.');
    return result;

  } catch (error) {
    console.error('[Gemini API] Error calling Gemini explanation API:', error);
    return {
      explanation: `Error fetching explanation: ${error.message}. Please check the console for details.`,
      responseTime: 0,
      error: true
    };
  }
};