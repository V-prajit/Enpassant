import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getStockfishAnalysis, getGeminiExplanation, stopSpeech, stopStockfishAnalysis as stopEngineAnalysis } from '../services/api';
import { Chess } from 'chess.js';
import { devLog, devError } from '../utils/logger';
import CONFIG from '../config';
import { Bot, Cpu, Zap, AlertTriangle, Settings2, Brain, PowerOff, Play } from 'lucide-react';

const AnalysisPanel = ({
  fen,
  onSelectMove,
  onEvaluationChange, // This is Layout's setEvaluation
  onBestMovesChange,
  onAnalyzingChange,
}) => {
  // Internal state for evaluation, primarily to trigger effects if needed,
  // but we will call onEvaluationChange directly from the update handler.
  const [localPositionEvaluation, setLocalPositionEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [isStockfishAnalyzing, setIsStockfishAnalyzing] = useState(false);
  const [isGeminiLoading, setIsGeminiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [autoAnalyze, setAutoAnalyze] = useState(true);

  const [depth, setDepth] = useState(CONFIG.ANALYSIS.defaultDepth);
  const [threads, setThreads] = useState(1);
  const [hashSize, setHashSize] = useState(16);
  const [useInfiniteDepth, setUseInfiniteDepth] = useState(false);

  const [modelInfo, setModelInfo] = useState(null);
  const [responseTime, setResponseTime] = useState(null);

  const chessRef = useRef(new Chess());
  const analysisTimeoutRef = useRef(null);

  const prevFenRef = useRef(fen);
  const prevAutoAnalyzeRef = useRef(autoAnalyze);
  const prevDepthRef = useRef(depth);
  const prevUseInfiniteRef = useRef(useInfiniteDepth);
  const prevThreadsRef = useRef(threads);
  const prevHashSizeRef = useRef(hashSize);
  const activeAnalysisParamsRef = useRef(null);

  // Effect to pass internal bestMoves state to parent (Layout)
  useEffect(() => {
    if (onBestMovesChange) onBestMovesChange(bestMoves);
  }, [bestMoves, onBestMovesChange]);

  // Effect to pass internal isStockfishAnalyzing state to parent (Layout)
  useEffect(() => {
    if (onAnalyzingChange) onAnalyzingChange(isStockfishAnalyzing);
  }, [isStockfishAnalyzing, onAnalyzingChange]);

  useEffect(() => {
    return () => {
      stopSpeech();
      stopEngineAnalysis();
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, []);

  const uciToSanLight = useCallback((uciMove, currentFen) => {
    if (!uciMove || uciMove.length < 4) return uciMove;
    try {
      chessRef.current.load(currentFen);
      const move = chessRef.current.move(uciMove, { sloppy: true });
      return move ? move.san : uciMove;
    } catch (e) {
      return uciMove;
    }
  }, []);

  const handleAnalyze = useCallback(async (currentFen, analysisParams) => {
    if (!currentFen) {
        devLog("[AnalysisPanel] handleAnalyze: No FEN provided, skipping.");
        setIsStockfishAnalyzing(false);
        activeAnalysisParamsRef.current = null;
        if (onEvaluationChange) onEvaluationChange("0.0"); // Reset eval bar on no FEN
        return;
    }

    stopEngineAnalysis();
    await new Promise(resolve => setTimeout(resolve, 50));

    activeAnalysisParamsRef.current = { fen: currentFen, ...analysisParams };
    setIsStockfishAnalyzing(true);
    setError(null);
    setBestMoves([]);

    if (onEvaluationChange) {
            onEvaluationChange("..."); // Use "..." or null or a specific constant
        }
        setLocalPositionEvaluation("...");

    const tempChessInstance = new Chess(currentFen);
    if (tempChessInstance.isCheckmate() || tempChessInstance.isDraw() || tempChessInstance.isStalemate()) {
        const gameStatus = tempChessInstance.isCheckmate()
          ? `Checkmate: ${tempChessInstance.turn() === 'w' ? 'Black' : 'White'} wins`
          : "Draw";
        devLog(`[AnalysisPanel] handleAnalyze: Game ended. Status: ${gameStatus}`);
        if (onEvaluationChange) onEvaluationChange(gameStatus);
        setLocalPositionEvaluation(gameStatus);
        setBestMoves([{ uci: "GAME_END", san: gameStatus, depth: 0 }]);
        setIsStockfishAnalyzing(false);
        activeAnalysisParamsRef.current = null;
        return;
    }

    devLog(`[AnalysisPanel] handleAnalyze: Starting analysis for FEN: ${currentFen}, Params: ${JSON.stringify(analysisParams)}`);

    try {
      const analysisUpdateHandler = (progressResult) => {
        if (!activeAnalysisParamsRef.current || activeAnalysisParamsRef.current.fen !== currentFen) {
            devLog("[AnalysisPanel] analysisUpdateHandler: Stale update for different FEN. Ignoring.");
            return;
        }
        
        const newEval = progressResult.evaluation || '0.0';
        devLog(`[AnalysisPanel] analysisUpdateHandler received eval: ${newEval}, depth: ${progressResult.depth}`);
        
        if (onEvaluationChange) {
            onEvaluationChange(newEval);
        }
        setLocalPositionEvaluation(newEval);

        if (progressResult.bestMoves && progressResult.bestMoves.length > 0) {
          const enhancedMoves = progressResult.bestMoves.map(move => ({
            ...move,
            san: uciToSanLight(move.uci, currentFen),
            depth: move.depth || progressResult.depth || 0,
            source: progressResult.source || 'local'
          }));
          setBestMoves(enhancedMoves);
        }

        if (progressResult.completed) {
            devLog(`[AnalysisPanel] handleAnalyze: 'bestmove' (completed) received for FEN: ${currentFen}. Infinite: ${analysisParams.useInfinite}`);
            if (!analysisParams.useInfinite) {
                setIsStockfishAnalyzing(false);
                activeAnalysisParamsRef.current = null;
            }
        }
      };

      await getStockfishAnalysis(
        currentFen,
        analysisParams.useInfinite ? "infinite" : analysisParams.depth,
        { threads: analysisParams.threads, hash: analysisParams.hashSize },
        analysisUpdateHandler
      );

      if (!analysisParams.useInfinite && activeAnalysisParamsRef.current?.fen === currentFen) {
          if (isStockfishAnalyzing) { // Check if it's still true
            devLog("[AnalysisPanel] handleAnalyze: Finite search promise resolved, ensuring isStockfishAnalyzing is false.");
            setIsStockfishAnalyzing(false);
            activeAnalysisParamsRef.current = null;
          }
      }

    } catch (error) {
      devError('[AnalysisPanel] Stockfish analysis error in handleAnalyze:', error);
      setError(`Analysis error: ${error.message}`);
      setIsStockfishAnalyzing(false);
      activeAnalysisParamsRef.current = null;
      if (onEvaluationChange) onEvaluationChange("Error");
      setLocalPositionEvaluation("Error");
    }
  }, [uciToSanLight, onEvaluationChange]);

  useEffect(() => {
    const currentSettings = { depth, useInfinite: useInfiniteDepth, threads, hashSize };

    const fenActuallyChanged = fen !== prevFenRef.current;
    const autoAnalyzeToggledOn = autoAnalyze && !prevAutoAnalyzeRef.current;
    const autoAnalyzeToggledOff = !autoAnalyze && prevAutoAnalyzeRef.current;
    const settingsActuallyChanged = depth !== prevDepthRef.current ||
                                 useInfiniteDepth !== prevUseInfiniteRef.current ||
                                 threads !== prevThreadsRef.current ||
                                 hashSize !== prevHashSizeRef.current;
    
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    let shouldStop = false;
    let shouldStart = false;

    if (!fen) {
        shouldStop = true;
        if(isStockfishAnalyzing) setIsStockfishAnalyzing(false);
        activeAnalysisParamsRef.current = null;
    } else {
        if (fenActuallyChanged) {
            shouldStop = true; 
            if (autoAnalyze) shouldStart = true;
        } else if (settingsActuallyChanged) {
            shouldStop = true;
            if (autoAnalyze) shouldStart = true;
        } else if (autoAnalyzeToggledOn) {
           // If auto-analyze is turned on, start analysis if not already running for current settings
            if (!isStockfishAnalyzing || 
                !activeAnalysisParamsRef.current || 
                activeAnalysisParamsRef.current.fen !== fen ||
                activeAnalysisParamsRef.current.depth !== currentSettings.depth ||
                activeAnalysisParamsRef.current.useInfinite !== currentSettings.useInfinite ||
                activeAnalysisParamsRef.current.threads !== currentSettings.threads ||
                activeAnalysisParamsRef.current.hashSize !== currentSettings.hashSize) {
                shouldStop = true; // Stop any different analysis
                shouldStart = true;
            }
        } else if (autoAnalyzeToggledOff) {
            shouldStop = true;
        }
    }
    
    if (shouldStop && isStockfishAnalyzing) { // Only stop if it was actually analyzing or if explicitly told to stop
        devLog(`[AnalysisPanel] useEffect: Stopping analysis. isStockfishAnalyzing was ${isStockfishAnalyzing}`);
        stopEngineAnalysis();
        if (!shouldStart) { // If not immediately starting a new one
            setIsStockfishAnalyzing(false);
            activeAnalysisParamsRef.current = null;
        }
    } else if (shouldStop && !isStockfishAnalyzing && autoAnalyzeToggledOff) {
        // If auto analyze was turned off and nothing was running, ensure state is clean
        activeAnalysisParamsRef.current = null;
    }


    if (shouldStart && fen && autoAnalyze) {
      devLog(`[AnalysisPanel] useEffect: Queueing new analysis for FEN: ${fen} with params: ${JSON.stringify(currentSettings)}`);
      analysisTimeoutRef.current = setTimeout(() => {
        if (autoAnalyze && fen && // Check conditions again inside timeout, in case they changed
            (!activeAnalysisParamsRef.current || // No active analysis
             activeAnalysisParamsRef.current.fen !== fen || // Or FEN changed
             activeAnalysisParamsRef.current.depth !== currentSettings.depth ||
             activeAnalysisParamsRef.current.useInfinite !== currentSettings.useInfinite ||
             activeAnalysisParamsRef.current.threads !== currentSettings.threads ||
             activeAnalysisParamsRef.current.hashSize !== currentSettings.hashSize ||
             !isStockfishAnalyzing // Or analysis was stopped for some reason
            )
        ) {
            handleAnalyze(fen, currentSettings);
        } else if (autoAnalyze && fen && activeAnalysisParamsRef.current && isStockfishAnalyzing) {
            devLog("[AnalysisPanel] useEffect: Analysis already running with correct params. Skipping new timeout start.");
        }

      }, CONFIG.ANALYSIS.analysisDelay);
    }

    prevFenRef.current = fen;
    prevAutoAnalyzeRef.current = autoAnalyze;
    prevDepthRef.current = depth;
    prevUseInfiniteRef.current = useInfiniteDepth;
    prevThreadsRef.current = threads;
    prevHashSizeRef.current = hashSize;

    return () => {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
    };
  }, [fen, autoAnalyze, depth, useInfiniteDepth, threads, hashSize, handleAnalyze]); // handleAnalyze added back. Its definition is memoized.

  const handleGetExplanation = async (useGeminiDeepThink = false) => {
    if (!fen || isGeminiLoading) return;
    const currentEvalForGemini = localPositionEvaluation; // Use the most recent local evaluation
    if (bestMoves.length === 0 && !currentEvalForGemini.includes('Checkmate') && !currentEvalForGemini.includes('Draw')) {
        setError("Please analyze the position with Stockfish first to provide context for AI explanation.");
        return;
    }

    setIsGeminiLoading(true);
    setError(null);
    setExplanation('');
    setResponseTime(null);

    try {
      devLog(`Requesting Gemini explanation with ${useGeminiDeepThink ? 'Deep Think' : 'standard'} mode. Evaluation being sent: ${currentEvalForGemini}`);
      const clientStartTime = performance.now();
      
      const tempChess = new Chess(fen);
      const isCheckmateForGemini = tempChess.isCheckmate();
      const isGameReportForGemini = isCheckmateForGemini || tempChess.isDraw();

      const result = await getGeminiExplanation(
        fen,
        currentEvalForGemini, // Send the most up-to-date evaluation
        bestMoves,
        CONFIG.defaultPlayerLevel,
        isGameReportForGemini,
        isCheckmateForGemini,
        null,
        useGeminiDeepThink
      );

      const clientResponseTime = ((performance.now() - clientStartTime) / 1000).toFixed(2);
      devLog(`Gemini response received in ${clientResponseTime}s (client-side measurement)`);

      if (result && result.explanation) {
        setExplanation(result.explanation);
        const finalResponseTime = result.responseTime || clientResponseTime;
        setResponseTime(finalResponseTime);
        if (result.model || result.deepThinkMode !== undefined) {
          setModelInfo({
            model: result.model || (result.deepThinkMode ? 'gemini-pro' : 'gemini-flash'),
            deepThinkMode: result.deepThinkMode === true
          });
        }
      } else {
        throw new Error(result.error || 'Empty or invalid response from AI service');
      }
    } catch (error) {
      devError('Gemini explanation error:', error);
      const errorMessage = error.message.includes('AI analysis service')
        ? error.message
        : `Failed to get AI explanation: ${error.message}.`;
      setError(errorMessage);
      setExplanation(`Unable to generate AI analysis. ${errorMessage}`);
    } finally {
      setIsGeminiLoading(false);
    }
  };
  
  const handleManualAnalyzeToggle = () => {
    if (isStockfishAnalyzing) {
        devLog("[AnalysisPanel] Manual Stop Analysis Clicked.");
        stopEngineAnalysis();
        setIsStockfishAnalyzing(false);
        activeAnalysisParamsRef.current = null;
    } else {
        devLog("[AnalysisPanel] Manual Start Analysis Clicked.");
        if (autoAnalyze) setAutoAnalyze(false); 
        handleAnalyze(fen, { depth, useInfinite: useInfiniteDepth, threads, hashSize });
    }
  };

  // JSX remains the same as the previous version
  return (
    <div className="bg-white rounded-xl shadow-md ring-1 ring-gray-200/50 p-4 md:p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 flex items-center"><Bot size={24} className="mr-2 text-blue-600"/>Position Analysis</h3>

      <div className="analysis-settings mb-4 p-3 bg-gray-50 rounded-md shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 items-center">
          <div>
            <label htmlFor="depth" className="block text-sm font-medium text-gray-700 mb-1">Depth ({useInfiniteDepth ? "Infinite" : depth})</label>
            <div className="flex items-center">
              <input
                type="range" id="depth" min="1" max="40" value={depth}
                onChange={(e) => { setDepth(Number(e.target.value)); if(useInfiniteDepth) setUseInfiniteDepth(false);}}
                disabled={useInfiniteDepth}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mr-2 accent-blue-600 disabled:opacity-50"
              />
              <input
                type="checkbox" id="infiniteDepth" checked={useInfiniteDepth}
                onChange={(e) => setUseInfiniteDepth(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="infiniteDepth" className="ml-2 text-sm text-gray-700">Infinite</label>
            </div>
          </div>

          <div>
            <label htmlFor="threads" className="block text-sm font-medium text-gray-700 mb-1">Threads</label>
            <input
              type="number" id="threads" min="1" max="16" value={threads}
              onChange={(e) => setThreads(Number(e.target.value))}
              className="w-full py-1 px-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="hashSize" className="block text-sm font-medium text-gray-700 mb-1">Hash (MB)</label>
            <input
              type="number" id="hashSize" min="16" max="1024" step="16" value={hashSize}
              onChange={(e) => setHashSize(Number(e.target.value))}
              className="w-full py-1 px-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex items-center justify-between md:col-span-1">
             <div className="flex items-center">
                <input
                type="checkbox" id="autoAnalyze" checked={autoAnalyze}
                onChange={(e) => setAutoAnalyze(e.target.checked)}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
                />
                <label htmlFor="autoAnalyze" className="text-sm text-gray-700">Auto-analyze</label>
            </div>
            <button
                onClick={handleManualAnalyzeToggle}
                disabled={!fen}
                className={`py-1.5 px-3 rounded-md shadow-sm transition-all duration-200 flex items-center text-sm ${
                    !fen ? 'bg-gray-300 text-gray-500 cursor-not-allowed' :
                    isStockfishAnalyzing 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
                title={isStockfishAnalyzing ? "Stop Analysis" : "Start Analysis"}
            >
                {isStockfishAnalyzing ? <PowerOff size={16} className="mr-1.5"/> : <Play size={16} className="mr-1.5"/>}
                {isStockfishAnalyzing ? 'Stop' : 'Analyze'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="suggested-moves mb-4">
        <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center"><Cpu size={20} className="mr-2 text-gray-600"/>Stockfish Analysis</h4>
        {isStockfishAnalyzing && bestMoves.length === 0 && (
          <div className="p-3 bg-gray-50 text-center rounded-md shadow-sm">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent mx-auto mb-1"></div>
            <p className="text-sm text-gray-600">Initializing analysis...</p>
          </div>
        )}
        {bestMoves.length > 0 ? (
          <div className="space-y-2">
            {bestMoves.filter(move => move.san || move.uci).slice(0, 5).map((move, index) => (
              <button
                key={index}
                onClick={() => onSelectMove && onSelectMove(move)}
                className="w-full text-left px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 transition-colors duration-150 flex justify-between items-center"
                title={`PV: ${move.pv || move.uci}`}
              >
                <div>
                  <span className="text-sm font-semibold text-blue-700">{index + 1}. {move.san || move.uci}</span>
                  <span className="text-xs text-gray-500 ml-2 truncate block sm:inline">(Depth: {move.depth || 'N/A'})</span>
                </div>
                <span className={`text-sm font-medium ${parseFloat(move.evaluation) > 0 ? 'text-green-600' : parseFloat(move.evaluation) < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  {move.evaluation}
                </span>
              </button>
            ))}
          </div>
        ) : !isStockfishAnalyzing && (
          <div className="p-3 bg-gray-50 text-center rounded-md shadow-sm">
            <p className="text-sm text-gray-500 italic">No analysis data. {autoAnalyze ? "Waiting for move or change settings..." : "Click 'Analyze'."}</p>
          </div>
        )}
      </div>
      
      <div className="ai-explanation">
        <h4 className="text-md font-medium text-gray-700 mb-2 flex items-center"><Brain size={20} className="mr-2 text-purple-600"/>AI Coach Explanation</h4>
        <div className="controls flex flex-col sm:flex-row gap-2 mb-3">
          <button
            onClick={() => handleGetExplanation(false)}
            disabled={isGeminiLoading || !fen || (bestMoves.length === 0 && !localPositionEvaluation.includes('Checkmate') && !localPositionEvaluation.includes('Draw'))}
            className={`w-full sm:w-auto flex-1 py-2 px-3 rounded-md font-medium text-white transition-all duration-200 shadow-sm flex items-center justify-center ${
              isGeminiLoading || !fen || (bestMoves.length === 0 && !localPositionEvaluation.includes('Checkmate') && !localPositionEvaluation.includes('Draw'))
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-1'
            }`}
          >
            <Settings2 size={16} className="mr-2"/>{isGeminiLoading ? 'Thinking...' : 'Explain (Flash)'}
          </button>
          <button
            onClick={() => handleGetExplanation(true)}
            disabled={isGeminiLoading || !fen || (bestMoves.length === 0 && !localPositionEvaluation.includes('Checkmate') && !localPositionEvaluation.includes('Draw'))}
            className={`w-full sm:w-auto flex-1 py-2 px-3 rounded-md font-medium text-white transition-all duration-200 shadow-sm flex items-center justify-center ${
              isGeminiLoading || !fen || (bestMoves.length === 0 && !localPositionEvaluation.includes('Checkmate') && !localPositionEvaluation.includes('Draw'))
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1'
            }`}
          >
           <Zap size={16} className="mr-2"/> {isGeminiLoading ? 'Thinking Deeply...' : 'Deep Think'}
          </button>
        </div>

        {error && (
          <div className="text-red-600 bg-red-50 py-2 px-3 rounded-md mb-3 text-sm flex items-center">
            <AlertTriangle size={16} className="mr-2"/>{error}
          </div>
        )}

        <div className="explanation-content p-3 bg-gray-50 rounded-md shadow-sm text-sm text-gray-800 whitespace-pre-line min-h-[100px]">
          {isGeminiLoading ? (
            <p className="text-gray-500 italic">Generating AI explanation...</p>
          ) : explanation ? (
            <div>
              <p>{explanation}</p>
              {responseTime && (
                <p className="text-xs text-gray-400 mt-2 text-right">
                  Generated in {typeof responseTime === 'number' ? responseTime.toFixed(2) : responseTime}s
                  {modelInfo && (
                    <span className="ml-1">
                      using {modelInfo.deepThinkMode ?
                        <span className="text-indigo-600 font-medium">Gemini Pro</span> :
                        <span>Gemini Flash</span>}
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-500 italic">Analyze with Stockfish, then click for an AI explanation.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;