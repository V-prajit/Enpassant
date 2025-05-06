import CONFIG from '../config';

console.log('Running in offline mode - using only local Stockfish engine');

let stockfishWorker = null;
let stockfishReady = false;
let currentOnUpdate = null;
let currentFen = null;
let currentLocalDepth = 0;
let currentLocalEvaluation = null;
let currentLocalMoves = [];

export const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

function initLocalStockfish() {
  if (stockfishWorker) return;
  
  try {
    stockfishWorker = new Worker('/stockfish-worker.js');
    
    stockfishWorker.onmessage = (e) => {
      const message = e.data;
      
      if (typeof message === 'string') {
        if (message.startsWith('bestmove')) {
          const parts = message.split(' ');
          const bestMove = parts[1];
          
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
          handleStockfishInfo(message);
        } else if (message.startsWith('Loaded Stockfish')) {
          console.log('Stockfish engine loaded:', message);
          stockfishReady = true;
        } else if (message.startsWith('error:')) {
          console.error('Stockfish worker error:', message);
          stockfishReady = false;
        }
      }
    };
    
    stockfishWorker.postMessage('uci');
    stockfishWorker.postMessage('setoption name Threads value 4');
    stockfishWorker.postMessage('setoption name Hash value 128');
    stockfishWorker.postMessage('setoption name MultiPV value 5');
    stockfishWorker.postMessage('isready');
    
    console.log('Local Stockfish engine initializing...');
  } catch (error) {
    console.error('Failed to initialize local Stockfish:', error);
    stockfishReady = false;
  }
}

function handleStockfishInfo(info) {
  try {
    if (!info.includes('multipv 1') && !info.includes('depth')) return;
    
    const depthMatch = info.match(/depth (\d+)/);
    if (!depthMatch) return;
    
    const depth = parseInt(depthMatch[1], 10);
    currentLocalDepth = depth;
    
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
    
    const pvMatch = info.match(/pv (.+?)($| info)/);
    if (!pvMatch) return;
    
    const moves = pvMatch[1].trim().split(' ');
    const bestMove = moves[0];
    
    let updatedMoves = [...currentLocalMoves];
    const moveIndex = info.includes('multipv') ? 
      parseInt(info.match(/multipv (\d+)/)[1], 10) - 1 : 0;
    
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

function analyzeWithLocalStockfish(fen, depth = 18, onUpdate = null) {
  return new Promise((resolve) => {
    if (!stockfishReady) {
      initLocalStockfish();
      
      setTimeout(() => {
        if (!stockfishReady) {
          console.warn('Stockfish not ready after initialization attempt');
          resolve({
            evaluation: '0.0',
            bestMoves: [],
            depth: 0,
            source: 'local',
            completed: true,
            error: 'Local Stockfish engine not available'
          });
        } else {
          analyzeWithLocalStockfish(fen, depth, onUpdate)
            .then(resolve);
        }
      }, 1000);
      return;
    }
    
    currentOnUpdate = onUpdate;
    currentFen = fen;
    currentLocalDepth = 0;
    currentLocalEvaluation = '0.0';
    currentLocalMoves = [];
    
    stockfishWorker.postMessage('stop');
    stockfishWorker.postMessage('position fen ' + fen);
    stockfishWorker.postMessage('go depth ' + depth);
    
    setTimeout(() => {
      resolve({
        evaluation: currentLocalEvaluation || '0.0',
        bestMoves: currentLocalMoves || [],
        depth: currentLocalDepth,
        source: 'local',
        completed: currentLocalDepth >= depth
      });
    }, 300);
  });
}

export const getStockfishAnalysis = async (fen, depth = 18, onUpdate = null) => {
  try {
    console.log(`Starting analysis with target depth ${depth}...`);
    const startTime = performance.now();
    
    console.log('Starting local Stockfish analysis...');
    const localResult = await analyzeWithLocalStockfish(fen, depth, onUpdate);
    
    console.log(`Analysis completed in ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
    return localResult;
  } catch (error) {
    console.error('Analysis error:', error);
    throw error;
  }
};

function createLocalExplanation(fen, evaluation, bestMoves, isCheckmate) {
  const fenParts = fen.split(' ');
  const turn = fenParts[1] === 'w' ? 'White' : 'Black';
  
  let evalText = '';
  if (evaluation) {
    try {
      const evalValue = parseFloat(evaluation);
      if (!isNaN(evalValue)) {
        if (evalValue > 0.5) {
          evalText = 'White has an advantage of about ' + Math.abs(evalValue).toFixed(1) + ' pawns';
        } else if (evalValue < -0.5) {
          evalText = 'Black has an advantage of about ' + Math.abs(evalValue).toFixed(1) + ' pawns';
        } else {
          evalText = 'The position is roughly equal';
        }
      } else if (evaluation.includes('Mate')) {
        evalText = `There is a forced mate sequence`;
      }
    } catch (e) {
    }
  }
  
  let explanation = `Position Analysis:\n\n`;
  explanation += `It's ${turn}'s turn to move. `;
  
  if (evalText) {
    explanation += `${evalText}. `;
  }
  
  if (isCheckmate) {
    explanation += `This position is checkmate. The game is over.`;
  } else if (bestMoves && bestMoves.length > 0) {
    const bestMove = bestMoves[0].san || bestMoves[0].uci;
    explanation += `\n\nThe engine suggests ${bestMove} as the best move. `;
    
    if (bestMoves.length > 1) {
      const alternativeMoves = bestMoves.slice(1, 3).map(move => move.san || move.uci).join(' or ');
      explanation += `Alternative options include ${alternativeMoves}.`;
    }
  }
  
  explanation += `\n\n(This is an offline analysis - your app is running without cloud services.)`;
  
  return explanation;
}

export const getGeminiExplanation = async (fen, evaluation, bestMoves, playerLevel = 'advanced', isGameReport = false, isCheckmate = false, userQuestion = null, useDeepThink = false) => {
  console.log('Using local fallback explanation (offline mode)');
  
  if (!isCheckmate) {
    isCheckmate = evaluation.includes('Checkmate') || (bestMoves.length > 0 && bestMoves[0]?.isCheckmate);
  }
  
  return {
    explanation: createLocalExplanation(fen, evaluation, bestMoves, isCheckmate),
    responseTime: 0.1,
    model: 'offline-mode'
  };
};

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
    utterance.rate = options.rate || CONFIG.SPEECH?.defaultRate || 1.0;
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

initLocalStockfish();