// Enpassant/Frontend/src/services/api.js
import { devLog, devWarn, devError } from '../utils/logger';

let stockfishWorker = null;
let stockfishReady = false; // True when 'uciok' and 'readyok' have been received and options set
let isInitializing = false; // To prevent multiple initializations
let currentOnUpdate = null;
let currentAnalysisResolver = null;

let currentLocalDepth = 0; // Overall depth reported by the engine for the main line
let currentLocalEvaluation = '0.0'; // Evaluation of the principal variation
let currentLocalMoves = []; // Stores { uci, san, pvString, pvArray, evaluation, depth, lineDepth }

// Function to send UCI options to Stockfish
async function setStockfishOption(name, value) {
  if (stockfishWorker && stockfishReady) {
    const command = `setoption name ${name} value ${value}`;
    devLog(`[Stockfish Log] Sending option: ${command}`);
    stockfishWorker.postMessage(command);
    // It's good practice to wait for 'isready' or a confirmation if the engine provides one,
    // but for simplicity here, we'll assume options are set synchronously or queued by the engine.
    // For critical options, one might need a more robust way to confirm they've been applied.
    await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
  } else {
    devWarn(`[Stockfish Log] Cannot set option '${name}': Stockfish not ready or worker not initialized.`);
  }
}

function initLocalStockfish(initialOptions = {}) {
  if (stockfishWorker || isInitializing) {
    if (stockfishWorker && !stockfishReady) {
      // devLog('initLocalStockfish: Worker exists but not ready. Will rely on analyzeWithLocalStockfish to poke.');
    } else if (isInitializing) {
      // devLog('initLocalStockfish: Initialization already in progress.');
    }
    return;
  }

  isInitializing = true;
  devLog('[Stockfish Log] initLocalStockfish: Starting initialization...');

  try {
    stockfishWorker = new Worker('/stockfish-nnue-16-single.js'); // Ensure this path is correct

    stockfishWorker.onmessage = (event) => {
      const message = event.data;
      // devLog(`[Stockfish Raw Msg]: ${message}`); // Verbose

      if (typeof message === 'string') {
        if (message.includes('uciok')) {
          devLog('[Stockfish Log] Received uciok. Setting initial options and sending isready.');
          // Set initial options like MultiPV before confirming ready
          stockfishWorker.postMessage('setoption name MultiPV value 5'); // Default MultiPV
          if (initialOptions.threads) {
            stockfishWorker.postMessage(`setoption name Threads value ${initialOptions.threads}`);
          }
          if (initialOptions.hash) {
            stockfishWorker.postMessage(`setoption name Hash value ${initialOptions.hash}`);
          }
          stockfishWorker.postMessage('isready');
        } else if (message.includes('readyok')) {
          devLog('[Stockfish Log] Received readyok.');
          if (!stockfishReady) {
            stockfishReady = true;
            isInitializing = false;
            devLog('[Stockfish Log] stockfishReady is now true.');
          } else {
             isInitializing = false;
          }
        } else if (message.startsWith('info')) {
          parseStockfishInfo(message);
          if (currentOnUpdate) { // Removed currentLocalDepth > 0 condition to allow updates even at depth 0 if info comes
            const processedMoves = currentLocalMoves.filter(m => m && m.uci).map(m => ({
              uci: m.uci, san: m.san, pv: m.pvString, evaluation: m.evaluation,
              depth: m.lineDepth || currentLocalDepth, // Use line-specific depth
              source: 'local'
            })).slice(0, 5); // Ensure we only take up to MultiPV value

            currentOnUpdate({
              evaluation: currentLocalEvaluation, // Overall position eval
              bestMoves: processedMoves,
              depth: currentLocalDepth, // Max depth reached for the main line
              source: 'local', completed: false
            });
          }
        } else if (message.startsWith('bestmove')) {
          devLog('[Stockfish Log] Received bestmove.');
          parseStockfishBestmove(message);
          const finalProcessedMoves = currentLocalMoves.filter(m => m && m.uci).map(m => ({
            uci: m.uci, san: m.san, pv: m.pvString, evaluation: m.evaluation,
            depth: m.lineDepth || currentLocalDepth, // Use line-specific depth
            source: 'local'
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
          currentAnalysisResolver = null;
        }
      }
    };

    stockfishWorker.onerror = (error) => {
      devError('[Stockfish Log] Worker onerror:', error);
      stockfishReady = false;
      isInitializing = false;
      if (stockfishWorker) {
        stockfishWorker.terminate();
      }
      stockfishWorker = null;
      if (currentAnalysisResolver && currentAnalysisResolver.reject) {
        currentAnalysisResolver.reject(new Error('Stockfish worker error'));
      }
      currentAnalysisResolver = null;
    };
    
    devLog('[Stockfish Log] initLocalStockfish: Sending uci.');
    stockfishWorker.postMessage('uci');

  } catch (error) {
    devError('[Stockfish Log] Failed to initialize local Stockfish worker:', error);
    stockfishReady = false;
    isInitializing = false;
    stockfishWorker = null;
  }
}

function parseStockfishInfo(infoString) {
  const overallDepthMatch = infoString.match(/depth (\d+)/);
  if (overallDepthMatch) {
      currentLocalDepth = Math.max(currentLocalDepth, parseInt(overallDepthMatch[1], 10));
  }
  // seldepth is also available but usually not displayed as primary depth

  let lineEvaluationValue = currentLocalEvaluation; // Default to overall if specific line eval isn't found
  const cpScoreMatch = infoString.match(/score cp ([-\d]+)/);
  const mateScoreMatch = infoString.match(/score mate ([-\d]+)/);

  if (cpScoreMatch) {
    lineEvaluationValue = (parseInt(cpScoreMatch[1], 10) / 100).toFixed(2).toString();
  } else if (mateScoreMatch) {
    const mateVal = parseInt(mateScoreMatch[1], 10);
    lineEvaluationValue = mateVal > 0 ? `M${mateVal}` : `M-${Math.abs(mateVal)}`;
  }
  
  const multipvMatch = infoString.match(/multipv (\d+)/);
  const mpvIndex = multipvMatch ? parseInt(multipvMatch[1], 10) - 1 : 0;

  // Update overall evaluation if this is the primary line (multipv 1 or no multipv specified)
  if (mpvIndex === 0) {
    currentLocalEvaluation = lineEvaluationValue;
  }

  // Ensure currentLocalMoves array is large enough
  while (currentLocalMoves.length <= mpvIndex) {
    currentLocalMoves.push({ uci: '', san: '', pvString: '', pvArray: [], evaluation: '0.0', depth: 0, lineDepth: 0 });
  }
  
  // Store line-specific depth
  const lineDepthMatch = infoString.match(/depth (\d+)/); // Re-check depth for this specific line info
  const currentLineDepth = lineDepthMatch ? parseInt(lineDepthMatch[1], 10) : (currentLocalMoves[mpvIndex]?.lineDepth || 0);


  currentLocalMoves[mpvIndex] = {
      ...(currentLocalMoves[mpvIndex] || {}), // Preserve existing data if any
      evaluation: lineEvaluationValue,
      lineDepth: Math.max(currentLocalMoves[mpvIndex]?.lineDepth || 0, currentLineDepth) // Update with the max depth seen for this line
  };


  const pvRegEx = / pv (.+?)($| (?:nodes|nps|tbhits|wdl|hashfull|currmove|currmovenumber|cpuload|string|score|depth|seldepth|time|currlc|upperbound|lowerbound))/;
  const pvDataMatch = infoString.match(pvRegEx);
  if (pvDataMatch && pvDataMatch[1]) {
    const pvArray = pvDataMatch[1].trim().split(' ');
    currentLocalMoves[mpvIndex].uci = pvArray[0] || currentLocalMoves[mpvIndex].uci;
    currentLocalMoves[mpvIndex].san = pvArray[0] || currentLocalMoves[mpvIndex].san; // Placeholder, SAN conversion needed elsewhere
    currentLocalMoves[mpvIndex].pvString = pvArray.join(' ');
    currentLocalMoves[mpvIndex].pvArray = pvArray;
  }

  // Keep only the top N lines (e.g., 5, matching MultiPV setting)
  if (currentLocalMoves.length > 5) {
    currentLocalMoves = currentLocalMoves.slice(0, 5);
  }
}


function parseStockfishBestmove(bestmoveString) {
    const parts = bestmoveString.split(' ');
    if (parts.length >= 2 && parts[0] === 'bestmove') {
        const bestMoveUci = parts[1];
        // Ponder move might also be available if Ponder UCI option is true
        // const ponderMatch = bestmoveString.match(/ponder (\S+)/);
        // const ponderMove = ponderMatch ? ponderMatch[1] : null;

        // The bestmove often corresponds to the first PV line.
        // We ensure the move that engine decided as 'bestmove' is at the top.
        let bestMoveLineIndex = currentLocalMoves.findIndex(m => m.uci === bestMoveUci);

        if (bestMoveLineIndex !== -1) {
            // Move the confirmed best line to the top if it's not already
            if (bestMoveLineIndex > 0) {
                const bestLine = currentLocalMoves.splice(bestMoveLineIndex, 1)[0];
                currentLocalMoves.unshift(bestLine);
            }
        } else {
            // If bestmove is not in current PVs (e.g. if multipv was low or search was shallow)
            // Add it as the primary line.
            currentLocalMoves.unshift({
                uci: bestMoveUci, san: bestMoveUci, // SAN needs conversion
                pvString: bestMoveUci, // Potentially add ponder if available
                pvArray: [bestMoveUci],
                evaluation: currentLocalEvaluation, // Use overall eval
                lineDepth: currentLocalDepth // Use overall depth
            });
        }
        // Ensure list doesn't exceed MultiPV limit
        currentLocalMoves = currentLocalMoves.slice(0, 5);
    }
}


let analysisQueue = Promise.resolve();

// Function to stop ongoing Stockfish analysis
export const stopStockfishAnalysis = () => {
  if (stockfishWorker && stockfishReady) {
    devLog('[Stockfish Log] Sending: stop');
    stockfishWorker.postMessage('stop');
    if (currentAnalysisResolver && currentAnalysisResolver.reject) {
      // Optional: Reject the current promise if analysis is externally stopped
      // currentAnalysisResolver.reject(new Error('Analysis stopped externally'));
      // currentAnalysisResolver = null;
    }
  }
};

function analyzeWithLocalStockfish(fen, depth = 18, options = {}, onUpdate = null) {
  const analysisPromise = analysisQueue.then(() => {
    return new Promise(async (resolve, reject) => {
      devLog(`[Stockfish Log] analyzeWithLocalStockfish: Queued for FEN: ${fen}, Depth: ${depth}`);
      
      if (!stockfishWorker && !isInitializing) {
        devLog("[Stockfish Log] analyzeWithLocalStockfish: Worker is null and not initializing. Calling initLocalStockfish.");
        initLocalStockfish(options);
      } else if (stockfishWorker && !stockfishReady && !isInitializing) {
        devLog("[Stockfish Log] analyzeWithLocalStockfish: Worker exists but not ready. Sending 'isready'.");
        stockfishWorker.postMessage('isready');
      }

      let attempts = 0;
      const maxAttempts = 150; // 15 seconds (150 * 100ms)
      
      const tryAnalysis = async () => {
        if (stockfishReady) {
          devLog(`[Stockfish Log] analyzeWithLocalStockfish: Stockfish is ready. Starting analysis for FEN: ${fen}`);
          currentOnUpdate = onUpdate;
          currentAnalysisResolver = { resolve, reject };
          currentLocalDepth = 0;
          currentLocalEvaluation = '0.0';
          currentLocalMoves = [];

          // Apply options before starting analysis for this specific run
          if (options.threads) await setStockfishOption('Threads', options.threads);
          if (options.hash) await setStockfishOption('Hash', options.hash);
          // MultiPV is typically set once at init or can be changed here too
          // await setStockfishOption('MultiPV', options.multiPV || 5);


          stockfishWorker.postMessage('stop'); // Stop any previous search
          stockfishWorker.postMessage('ucinewgame'); // Good practice, though not strictly necessary for every 'go'
          stockfishWorker.postMessage('position fen ' + fen);
          
          if (depth === "infinite" || depth === 0) { // 0 can mean infinite for some UIs
            devLog('[Stockfish Log] Sending: go infinite');
            stockfishWorker.postMessage('go infinite');
          } else {
            devLog(`[Stockfish Log] Sending: go depth ${depth}`);
            stockfishWorker.postMessage('go depth ' + depth);
          }
        } else {
          attempts++;
          if (attempts > maxAttempts) {
            devWarn(`[Stockfish Log] analyzeWithLocalStockfish: Stockfish not ready after ${maxAttempts} attempts for FEN: ${fen}. Rejecting.`);
            reject(new Error(`Stockfish engine timed out. isInitializing: ${isInitializing}, stockfishReady: ${stockfishReady}`));
          } else {
            if (attempts % 20 === 0) {
                 devLog(`[Stockfish Log] analyzeWithLocalStockfish: Waiting for stockfishReady... (Attempt ${attempts}/${maxAttempts}) isInitializing: ${isInitializing}`);
            }
            if (!stockfishWorker && !isInitializing) {
                devLog("[Stockfish Log] analyzeWithLocalStockfish: Worker became null while waiting. Re-initializing.");
                initLocalStockfish(options); // Pass options to re-init
            } else if (stockfishWorker && !isInitializing && !stockfishReady) {
                if (attempts % 10 === 0) stockfishWorker.postMessage('isready');
            }
            setTimeout(tryAnalysis, 100);
          }
        }
      };
      await tryAnalysis();
    });
  });
  analysisQueue = analysisPromise.catch(() => {});
  return analysisPromise;
}

export const getStockfishAnalysis = async (fen, depth = 18, options = {}, onUpdate = null) => {
  devLog(`[Stockfish API] getStockfishAnalysis called for FEN: ${fen}, Depth: ${depth}, Options: ${JSON.stringify(options)}`);
  
  if (!stockfishWorker && !isInitializing) {
    initLocalStockfish(options); // Pass initial options if worker is being created now
  }

  try {
    const result = await analyzeWithLocalStockfish(fen, depth, options, onUpdate);
    devLog(`[Stockfish API] Analysis completed. Depth: ${result.depth}, Eval: ${result.evaluation}, Top PV: ${result.bestMoves[0]?.pv}`);
    return result;
  } catch (error) {
    devError('[Stockfish API] Error in getStockfishAnalysis:', error);
    return {
      evaluation: 'Error', bestMoves: [], depth: 0,
      source: 'local', completed: true, error: error.message 
    };
  }
};

// --- Speech Synthesis Functions (Unchanged, ensure they are present in your actual file) ---
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
      devLog("[Speech Log] Cancelling ongoing speech for new request...");
      synth.cancel();
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
      devLog("[Speech Log] Speech started for text:", text.substring(0, 50) + "...");
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      devLog("[Speech Log] Speech ended.");
      if (options.onEnd) options.onEnd();
      resolve();
    };

    utterance.onerror = (event) => {
      devError("[Speech Log] Speech synthesis error:", event.error);
      if (options.onError) options.onError(event);
      reject(event);
    };

    try {
        synth.speak(utterance);
    } catch (e) {
        devError("[Speech Log] Error calling synth.speak:", e);
        reject(e);
    }
}


export const stopSpeech = () => {
  if (synth && synth.speaking) {
    devLog("[Speech Log] stopSpeech called, cancelling active speech.");
    synth.cancel();
  }
};

// --- Gemini API Call (Unchanged, ensure this is complete from your file) ---
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
    devWarn('[Gemini API] VITE_GEMINI_URL is not set. Using mock Gemini response.');
    return {
      explanation: `Mock explanation for FEN: ${fen}. Player level: ${playerLevel}. Deep Think: ${useDeepThink}. Question: ${userQuestion || 'N/A'}. Evaluation: ${evaluation}. Best Moves: ${JSON.stringify(bestMoves)}`,
      responseTime: 0.1,
      model: 'offline-mock',
      deepThinkMode: useDeepThink,
      gamePhase: 'unknown'
    };
  }

  try {
    devLog(`[Gemini API] Requesting Gemini explanation from: ${geminiApiUrl}`);
    const response = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fen,
        evaluation,
        bestMoves,
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
      devError('[Gemini API] Error from Gemini explanation service:', errorData);
      throw new Error(errorData.error || `Failed to get explanation. Status: ${response.status}`);
    }

    const result = await response.json();
    devLog('[Gemini API] Gemini explanation received successfully.');
    return result;

  } catch (error) {
    devError('[Gemini API] Error calling Gemini explanation API:', error);
    return {
      explanation: `Error fetching explanation: ${error.message}. Please check the console for details.`,
      responseTime: 0,
      error: true
    };
  }
};