let stockfishWorker = null;
let stockfishReady = false;
let currentOnUpdate = null;
let currentAnalysisResolver = null;

let currentLocalDepth = 0;
let currentLocalEvaluation = '0.0';
let currentLocalMoves = [];

function initLocalStockfish() {
  if (stockfishWorker) {
    if (!stockfishReady) {
      stockfishWorker.postMessage('isready');
    }
    return;
  }
  
  try {
    stockfishWorker = new Worker('/stockfish-nnue-16-single.js');

    stockfishWorker.onmessage = (event) => {
      const message = event.data;

      if (typeof message === 'string') {
        if (message.includes('uciok') || message.includes('readyok')) {
          if (!stockfishReady) {
            console.log('Stockfish engine is ready (uciok/readyok received).');
            stockfishReady = true;
          }
        } else if (message.startsWith('info')) {
          parseStockfishInfo(message); // Parse info strings
          if (currentOnUpdate && currentLocalDepth > 0) { // Send updates if depth is meaningful
            currentOnUpdate({
              evaluation: currentLocalEvaluation,
              bestMoves: currentLocalMoves.slice(0, 5), // Send top 5 moves for updates
              depth: currentLocalDepth,
              source: 'local',
              completed: false // This is an intermediate update
            });
          }
        } else if (message.startsWith('bestmove')) {
          parseStockfishBestmove(message); // Parse bestmove
          if (currentOnUpdate) {
            currentOnUpdate({
              evaluation: currentLocalEvaluation,
              bestMoves: currentLocalMoves.slice(0, 5),
              depth: currentLocalDepth, // Should be the final depth
              source: 'local',
              completed: true
            });
          }
          if (currentAnalysisResolver) {
            currentAnalysisResolver({ // Resolve the main promise
              evaluation: currentLocalEvaluation,
              bestMoves: currentLocalMoves,
              depth: currentLocalDepth,
              source: 'local',
              completed: true
            });
            currentAnalysisResolver = null; // Reset resolver
          }
          stockfishReady = true; // Ready for next command
        }
      }
    };

    stockfishWorker.onerror = (error) => {
      console.error('Stockfish worker error:', error);
      stockfishReady = false;
      if (currentAnalysisResolver) {
        currentAnalysisResolver.reject(new Error('Stockfish worker error'));
        currentAnalysisResolver = null;
      }
      // Optionally try to re-initialize or notify the user
    };
    
    console.log('Local Stockfish engine (direct worker) initializing...');
    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('isready');

  } catch (error) {
    console.error('Failed to initialize local Stockfish worker:', error);
    stockfishReady = false;
  }
}

function parseStockfishInfo(infoString) {
  const depthMatch = infoString.match(/depth (\d+)/);
  if (depthMatch) currentLocalDepth = parseInt(depthMatch[1], 10);

  if (infoString.includes(' score cp ')) {
    const scoreMatch = infoString.match(/score cp ([-\d]+)/);
    if (scoreMatch) currentLocalEvaluation = (parseInt(scoreMatch[1], 10) / 100).toFixed(2).toString();
  } else if (infoString.includes(' score mate ')) {
    const mateMatch = infoString.match(/score mate ([-\d]+)/);
    if (mateMatch) {
      const mateVal = parseInt(mateMatch[1], 10);
      currentLocalEvaluation = mateVal > 0 ? `Mate in ${mateVal}` : `Mated in ${Math.abs(mateVal)}`;
    }
  }

  if (infoString.includes(' pv ')) {
    const pvMatch = infoString.match(/ pv (.+?)($| (?:multipv|info|nodes|nps|tbhits|wdl|hashfull|currmove|currmovenumber|cpuload|string))/);
    if (pvMatch && pvMatch[1]) {
      const moves = pvMatch[1].trim().split(' ');
      // For simplicity, we'll just store UCI moves. SAN conversion can happen in UI if needed with chess.js
      currentLocalMoves = moves.map(uci => ({ uci: uci, san: uci })); // Placeholder for SAN
    }
  }
}

function parseStockfishBestmove(bestmoveString) {
    const parts = bestmoveString.split(' ');
    if (parts.length >= 2 && parts[0] === 'bestmove') {
        const bestMoveUci = parts[1];
        // Ensure this best move is at the top of currentLocalMoves or add it
        if (!currentLocalMoves.find(m => m.uci === bestMoveUci)) {
            currentLocalMoves.unshift({ uci: bestMoveUci, san: bestMoveUci });
        }
    }
}


function analyzeWithLocalStockfish(fen, depth = 18, onUpdate = null) {
  return new Promise((resolve, reject) => {
    if (!stockfishWorker || !stockfishReady) {
      initLocalStockfish(); // Initialize if not already

      let attempts = 0;
      const maxAttempts = 50; // Wait up to 5 seconds
      const checkReadyInterval = setInterval(() => {
        attempts++;
        if (stockfishReady) {
          clearInterval(checkReadyInterval);
          currentOnUpdate = onUpdate;
          currentAnalysisResolver = { resolve, reject }; // Store resolver
          currentLocalDepth = 0;
          currentLocalEvaluation = '0.0';
          currentLocalMoves = [];
          
          stockfishWorker.postMessage('stop'); // Stop any previous search
          stockfishWorker.postMessage('ucinewgame');
          stockfishWorker.postMessage('position fen ' + fen);
          stockfishWorker.postMessage('go depth ' + depth);
        } else if (attempts > maxAttempts) {
          clearInterval(checkReadyInterval);
          console.warn("Stockfish not ready after initialization attempt and timeout.");
          reject(new Error("Stockfish engine timed out during initialization."));
        }
      }, 100);
      return;
    }

    // If already ready
    currentOnUpdate = onUpdate;
    currentAnalysisResolver = { resolve, reject }; // Store resolver
    currentLocalDepth = 0;
    currentLocalEvaluation = '0.0';
    currentLocalMoves = [];
    
    stockfishWorker.postMessage('stop');
    stockfishWorker.postMessage('ucinewgame');
    stockfishWorker.postMessage('position fen ' + fen);
    stockfishWorker.postMessage('go depth ' + depth);
  });
}

export const getStockfishAnalysis = async (fen, depth = 18, onUpdate = null) => {
  console.log(`Requesting local Stockfish analysis for FEN: ${fen} at depth ${depth}...`);
  try {
    if (!stockfishWorker) {
        initLocalStockfish();
    }
    const result = await analyzeWithLocalStockfish(fen, depth, onUpdate);
    console.log(`Local Stockfish analysis completed. Depth: ${result.depth}, Eval: ${result.evaluation}`);
    return result;
  } catch (error) {
    console.error('Error in getStockfishAnalysis:', error);
    // Return a structure indicating failure but allowing UI to handle it
    return {
      evaluation: 'Error',
      bestMoves: [],
      depth: 0,
      source: 'local',
      completed: true,
      error: error.message
    };
  }
};

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
    console.warn('VITE_GEMINI_URL is not set. Using mock Gemini response.');
    return {
      explanation: `Mock explanation for FEN: ${fen}. Player level: ${playerLevel}. Deep Think: ${useDeepThink}. Question: ${userQuestion || 'N/A'}. Evaluation: ${evaluation}. Best Moves: ${JSON.stringify(bestMoves)}`,
      responseTime: 0.1,
      model: 'offline-mock',
      deepThinkMode: useDeepThink,
      gamePhase: 'unknown'
    };
  }

  try {
    console.log(`Requesting Gemini explanation from: ${geminiApiUrl}`);
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
      const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
      console.error('Error from Gemini explanation service:', errorData);
      throw new Error(errorData.error || `Failed to get explanation from Gemini service. Status: ${response.status}`);
    }

    const result = await response.json();
    console.log('Gemini explanation received:', result);
    return result;

  } catch (error) {
    console.error('Error calling Gemini explanation API:', error);
    return {
      explanation: `Error fetching explanation: ${error.message}. Please check the console for details.`,
      responseTime: 0,
      error: true
    };
  }
};

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
    .replace(/[Mm]ate in (\d+)/g, "Mate in $1 moves");

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
      synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = options.pitch || 1.0;
    utterance.rate = options.rate || 1.0;
    utterance.volume = options.volume || 1.0;

    if (options.voice) {
      const voices = synth.getVoices();
      const selectedVoice = voices.find(voice => voice.name === options.voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onstart = () => {
      if (options.onStart) options.onStart();
    };

    utterance.onend = () => {
      if (options.onEnd) options.onEnd();
      resolve();
    };

    utterance.onerror = (event) => {
      if (options.onError) options.onError(event);
      reject(event);
    };

    synth.speak(utterance);
  });
};

export const stopSpeech = () => {
  if (synth && synth.speaking) {
    synth.cancel();
  }
};