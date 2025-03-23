import React, { useState, useEffect, useRef } from 'react';
import { getStockfishAnalysis, getGeminiExplanation } from '../services/api';
import { Chess } from 'chess.js';
import { speakText, prepareAnalysisForSpeech, stopSpeech } from '../utils/speechSynthesis';

const AnalysisPanel = ({ 
  fen, 
  onSelectMove, 
  onEvaluationChange,
  onBestMovesChange,
  onPlayerLevelChange,
  onAnalyzingChange,
  playerLevel: initialPlayerLevel = 'beginner'
}) => {
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerLevel, setPlayerLevel] = useState('advanced'); // Always use advanced level
  const [error, setError] = useState(null);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [depth, setDepth] = useState(22);
  const [modelInfo, setModelInfo] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [autoSpeak, setAutoSpeak] = useState(false);
  
  // Effect to update parent component with changes to evaluation
  useEffect(() => {
    if (onEvaluationChange) {
      onEvaluationChange(evaluation);
    }
  }, [evaluation, onEvaluationChange]);
  
  // Effect to update parent component with changes to bestMoves
  useEffect(() => {
    if (onBestMovesChange) {
      onBestMovesChange(bestMoves);
    }
  }, [bestMoves, onBestMovesChange]);
  
  // Effect to update parent component with changes to isAnalyzing
  useEffect(() => {
    if (onAnalyzingChange) {
      onAnalyzingChange(isAnalyzing);
    }
  }, [isAnalyzing, onAnalyzingChange]);
  
  // Cleanup speech synthesis when component unmounts
  useEffect(() => {
    return () => {
      // Cancel any ongoing speech when component unmounts
      stopSpeech();
    };
  }, []);
  
  // Player level is always 'advanced' now - this function is maintained 
  // for compatibility with parent components but doesn't change anything
  const handlePlayerLevelChange = (level) => {
    // No-op - player level is always 'advanced'
    if (onPlayerLevelChange) {
      onPlayerLevelChange('advanced');
    }
  };
  
  // Use refs to track the latest state for use in effect dependencies
  const lastAnalyzedFen = useRef('');
  const analysisTimeoutRef = useRef(null);
  
  const handleAnalyze = async (analysisDepth = depth) => {
    if (!fen || isAnalyzing) return;
    
    lastAnalyzedFen.current = fen;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const chess = new Chess(fen);
      const isCheckmate = chess.isCheckmate()

      if (isCheckmate){
        const winner = chess.turn() === 'w' ? 'Black' : 'White';
        setEvaluation(`Checkmate = ${winner} wins`);
        setBestMoves([{ 
          uci: "0000", 
          san: "Checkmate",
          isCheckmate: true,
          winner: winner
        }]);
        setIsAnalyzing(false);

        return;
      }
      
      // Start analysis with the specified depth
      console.log(`Starting analysis at depth ${depth}...`);
      
      // Set up a progress handler for analysis updates
      const analysisUpdateHandler = (progressResult) => {
        if (lastAnalyzedFen.current !== fen) return;
        
        const analysisDepth = progressResult.depth || 0;
        const source = progressResult.source || 'cloud';
        
        console.log(`Analysis update from ${source}: depth ${analysisDepth}, eval: ${progressResult.evaluation}`);
        
        // Always show results as they come in
        setEvaluation(progressResult.evaluation);
        
        if (progressResult.bestMoves && progressResult.bestMoves.length > 0) {
          // Make sure to copy the source and depth to each move
          const enhancedMoves = progressResult.bestMoves.map(move => ({
            ...move,
            source: source,
            depth: analysisDepth
          }));
          setBestMoves(enhancedMoves);
        }
        
        // Consider analysis complete when:
        // 1. We get a cloud result at or above target depth
        // 2. We get a completed flag from either source
        if ((source === 'cloud' && analysisDepth >= depth) || progressResult.completed) {
          setIsAnalyzing(false);
        }
      };
      
      // Call Stockfish analysis which manages both sources
      await getStockfishAnalysis(
        fen, 
        analysisDepth,
        analysisUpdateHandler
      );
    } catch (error) {
      console.error('Stockfish analysis error:', error);
      setError('Analysis unavailable. Try again or adjust depth.');
      setIsAnalyzing(false);
    }
    
    // In case we need to cancel while analysis is running
    return () => {
      // Mark this position as no longer being analyzed
      if (lastAnalyzedFen.current === fen) {
        setIsAnalyzing(false);
      }
    }
  };
  
  // Automatically analyze when the FEN changes if autoAnalyze is enabled
  useEffect(() => {
    if (!fen || !autoAnalyze) return;
    
    // Clear any pending analysis
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }
    
    // Don't analyze if we've already analyzed this position
    if (lastAnalyzedFen.current === fen) return;
    
    // Analyze immediately for maximum speed
    const analyzeCleanup = handleAnalyze();
    
    return () => {
      // Clean up by both clearing the timeout and calling the cleanup function from handleAnalyze
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
      if (typeof analyzeCleanup === 'function') {
        analyzeCleanup();
      }
    };
  }, [fen, autoAnalyze]);
  
  // State to track response time
  const [responseTime, setResponseTime] = useState(null);
  
  const handleGetExplanation = async (useDeepThink = false) => {
    if (!fen || isLoading) return;
   
    const isCheckmate = bestMoves.length === 1 && bestMoves[0].isCheckmate;
    if (!isCheckmate && bestMoves.length === 0) return;

    setIsLoading(true);
    setError(null);
    setExplanation('');
    setResponseTime(null);
    
    try {
      console.log(`Requesting explanation with ${useDeepThink ? 'Deep Think' : 'standard'} mode`);
      const clientStartTime = performance.now();

      const isGameReport = isCheckmate;

      // Always use advanced level for all users
      const result = await getGeminiExplanation(fen, evaluation, bestMoves, 'advanced', isGameReport, false, null, useDeepThink);
      
      const clientResponseTime = ((performance.now() - clientStartTime) / 1000).toFixed(2);
      console.log(`Response received in ${clientResponseTime}s (client-side measurement)`);
      
      if (result && result.explanation) {
        setExplanation(result.explanation);
      
        const finalResponseTime = result.responseTime || clientResponseTime;
        setResponseTime(finalResponseTime);
        
        // Store model information if available
        if (result.model || result.deepThinkMode !== undefined) {
          setModelInfo({
            model: result.model || (result.deepThinkMode ? 'gemini-2.0-pro-exp-02-05' : 'gemini-2.0-flash'),
            deepThinkMode: result.deepThinkMode === true
          });
        }
        
        console.log(`AI generated ${result.explanation.length} characters in ${finalResponseTime}s using ${result.model || 'unknown model'}`);
        
        // Automatically speak the explanation if autoSpeak is enabled
        if (autoSpeak) {
          handleSpeak(result.explanation);
        }
      } else {
        throw new Error('Empty or invalid response from AI service');
      }
    } catch (error) {
      console.error('Gemini explanation error:', error);
      
      const errorMessage = error.message.includes('AI analysis service') 
        ? error.message 
        : `Failed to get AI explanation: ${error.message}. Please try again.`;
      
      setError(errorMessage);
      
      setExplanation(`Unable to generate AI analysis for this position. Please try again later.`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle speaking the analysis out loud
  const handleSpeak = async (textToSpeak = explanation) => {
    if (!textToSpeak) return;
    
    try {
      // Stop any ongoing speech
      if (isSpeaking) {
        stopSpeech();
        setIsSpeaking(false);
        return;
      }
      
      // Process the text for better speech output
      const processedText = prepareAnalysisForSpeech(textToSpeak);
      
      setIsSpeaking(true);
      
      await speakText(processedText, {
        rate: speechRate,
        onStart: () => setIsSpeaking(true),
        onEnd: () => setIsSpeaking(false),
        onError: (error) => {
          console.error("Speech synthesis error:", error);
          setIsSpeaking(false);
          setError("Failed to use speech synthesis. Please check if your browser supports this feature.");
        }
      });
    } catch (error) {
      console.error("Failed to speak analysis:", error);
      setIsSpeaking(false);
      setError("Failed to use speech synthesis. Please check if your browser supports this feature.");
    }
  };
  
  // Handle speaking evaluation and best moves
  const handleSpeakEvaluation = () => {
    if (!bestMoves || bestMoves.length === 0) return;
    
    // Prepare a spoken version of the evaluation and best moves
    let evalSpeech = `The position evaluation is ${evaluation}. `;
    
    if (bestMoves && bestMoves.length > 0) {
      evalSpeech += `The best move is ${bestMoves[0].san || bestMoves[0].uci}. `;
      
      if (bestMoves.length > 1) {
        evalSpeech += `Alternative moves include ${bestMoves.slice(1, 3).map(move => move.san || move.uci).join(' and ')}.`;
      }
    }
    
    handleSpeak(evalSpeech);
  };

  return (
    <div className="bg-white rounded-xl shadow-md ring-1 ring-gray-200/50 p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Position Analysis</h3>
      
      <div className="evaluation mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-2">Evaluation</h4>
        <div className="eval-display flex items-center">
          <div className={`text-lg font-bold ${
            evaluation.includes('Mate') 
              ? evaluation.includes('Mated') ? 'text-red-600' : 'text-green-600'
              : parseFloat(evaluation) > 0 
                ? 'text-green-600' 
                : parseFloat(evaluation) < 0 
                  ? 'text-red-600' 
                  : 'text-gray-800'
          }`}>
            {evaluation.includes('Mate') 
              ? evaluation 
              : parseFloat(evaluation) > 0 
                ? '+' + Math.abs(parseFloat(evaluation)).toFixed(2) 
                : parseFloat(evaluation) < 0
                  ? '-' + Math.abs(parseFloat(evaluation)).toFixed(2)
                  : '0.00'
            }
          </div>
          
          {isAnalyzing && (
            <div className="ml-3 text-sm text-gray-600 flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-green-500 rounded-full border-t-transparent mr-2"></div>
              Analyzing...
            </div>
          )}
          
          {bestMoves.length > 0 && bestMoves[0]?.source && (
            <div className="ml-3 text-xs text-gray-500 flex items-center">
              {bestMoves[0].source === 'local' ? (
                <>
                  <span>Browser analysis at depth {bestMoves[0].depth || '?'}</span>
                  {isAnalyzing && (
                    <span className="ml-2 flex items-center">
                      <div className="animate-pulse h-2 w-2 bg-blue-400 rounded-full mr-1"></div>
                      <span className="text-blue-500">Cloud analysis in progress...</span>
                    </span>
                  )}
                </>
              ) : (
                <span>Cloud analysis at depth {bestMoves[0].depth || '?'}</span>
              )}
            </div>
          )}
        </div>
        
        {/* Vertical eval bar now shown to the left of the board */}
      </div>
      
      <div className="best-moves mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-2">Suggested Moves</h4>
        {bestMoves.length > 0 ? (
          <ul className="list-none p-0 border rounded-md divide-y shadow-sm">
            {bestMoves.map((move, index) => (
              <li 
                key={index} 
                className="py-2 px-3 cursor-pointer hover:bg-gray-100 flex items-center"
                onClick={() => onSelectMove && onSelectMove(move)}
              >
                <div className="move-number mr-3 bg-green-100 text-green-800 px-2 py-1 rounded-md font-medium text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{move.san || 'Unknown'}</div>
                  <div className="text-xs text-gray-600">{move.uci}</div>
                </div>
                <div className="ml-auto">
                  <button 
                    className="text-sm bg-gray-800 hover:bg-gray-900 text-white px-2 py-1 rounded shadow-sm transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectMove && onSelectMove(move);
                    }}
                  >
                    Play
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : isAnalyzing ? (
          <div className="p-4 bg-gray-50 text-center rounded-md shadow-sm">
            <div className="animate-spin h-6 w-6 border-2 border-gray-500 rounded-full border-t-transparent mx-auto mb-2"></div>
            <p className="text-gray-600">Analyzing position...</p>
          </div>
        ) : (
          <div className="p-4 bg-gray-50 text-center rounded-md shadow-sm">
            <p className="text-gray-600 italic">No suggested moves available</p>
            {!autoAnalyze && (
              <button
                onClick={() => handleAnalyze(depth)}
                className="mt-2 text-sm bg-gray-800 hover:bg-gray-900 text-white px-3 py-1 rounded shadow-sm transition-all duration-200"
              >
                Analyze Now
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="analysis-settings mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-2">Analysis Settings</h4>
        <div className="flex flex-wrap gap-3 bg-gray-50 p-3 rounded-md shadow-sm">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoAnalyze"
              checked={autoAnalyze}
              onChange={() => setAutoAnalyze(!autoAnalyze)}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="autoAnalyze" className="text-gray-800">Auto-analyze positions</label>
          </div>
          
          <div className="flex items-center ml-4">
            <label htmlFor="depth" className="mr-2 text-gray-800">Depth:</label>
            <select
              id="depth"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="py-1 px-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 text-gray-800"
            >
              <option value="12">12 (Fast)</option>
              <option value="18">18 (Balanced)</option>
              <option value="22">22 (Strong)</option>
              <option value="26">26 (Deeper)</option>
              <option value="32">32 (Maximum)</option>
            </select>
          </div>
          
          {!autoAnalyze && (
            <button 
              onClick={() => handleAnalyze(depth)} 
              disabled={isAnalyzing || !fen}
              className={`text-sm py-1 px-3 rounded-md shadow-sm transition-all duration-200 ${isAnalyzing || !fen ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-900 text-white'}`}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Now'}
            </button>
          )}
        </div>
      </div>

      <div className="ai-explanation mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-2">AI Coach Explanation</h4>
        <div className="controls flex flex-wrap gap-3 mb-4">
          <button 
            onClick={() => handleGetExplanation(false)} 
            disabled={isLoading || !fen || (bestMoves.length === 0 && !evaluation.includes('Checkmate'))}
            className={`py-2 px-4 rounded-md font-medium text-white transition-all duration-200 shadow-md
              ${isLoading || !fen || (bestMoves.length === 0 && !evaluation.includes('Checkmate')) 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gray-800 hover:bg-gray-900 hover:shadow-lg focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'}`}
          >
            {isLoading ? 'Loading explanation...' : evaluation.includes('Checkmate') ? 'Get Game Report' : 'Get AI Explanation'}
          </button>
          
          <button 
            onClick={() => handleGetExplanation(true)} 
            disabled={isLoading || !fen || (bestMoves.length === 0 && !evaluation.includes('Checkmate'))}
            className={`py-2 px-4 rounded-md font-medium text-white transition-all duration-200 shadow-md
              ${isLoading || !fen || (bestMoves.length === 0 && !evaluation.includes('Checkmate')) 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'}`}
          >
            {isLoading ? 'Loading explanation...' : 'Deep Think Analysis'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-600 bg-red-50 py-2 px-4 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <div className="explanation-content p-4 bg-gray-50 rounded-md shadow-sm text-gray-800 whitespace-pre-line">
          {isLoading ? (
            <p className="text-gray-600 italic">Getting AI explanation...</p>
          ) : explanation ? (
            <div>
              <p>{explanation}</p>
              {responseTime && (
                <p className="text-xs text-gray-500 mt-2 text-right">
                  Generated in {typeof responseTime === 'number' ? responseTime.toFixed(2) : responseTime}s
                  {modelInfo && (
                    <span className="ml-2">
                      using {modelInfo.deepThinkMode ? 
                        <span className="text-blue-600 font-medium">Gemini Pro 2.0 (Deep Think)</span> : 
                        <span>Gemini Flash 2.0</span>}
                    </span>
                  )}
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-600">First analyze the position, then click "Get AI Explanation" to receive personalized coaching.</p>
          )}
        </div>
      </div>
      
      <div className="voice-controls">
        <h4 className="text-md font-medium text-gray-700 mb-2">Voice Output</h4>
        <div className="bg-gray-50 p-3 rounded-md shadow-sm mb-4">
          <div className="flex flex-wrap gap-4 mb-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoSpeak"
                checked={autoSpeak}
                onChange={() => setAutoSpeak(!autoSpeak)}
                className="mr-2 h-4 w-4"
              />
              <label htmlFor="autoSpeak" className="text-gray-800">Auto-speak analysis</label>
            </div>
            
            <div className="flex items-center">
              <label htmlFor="speechRate" className="mr-2 text-gray-800">Speech Rate:</label>
              <select
                id="speechRate"
                value={speechRate}
                onChange={(e) => setSpeechRate(Number(e.target.value))}
                className="py-1 px-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-1 text-gray-800"
              >
                <option value="1.0">1x</option>
                <option value="1.5">1.5x</option>
                <option value="2.0">2x</option>
                <option value="2.5">2.5x</option>
                <option value="3.0">3x</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => handleSpeak()}
              disabled={!explanation || isLoading}
              className={`flex items-center py-2 px-4 rounded-md font-medium text-white transition-all duration-200 shadow-md ${
                !explanation || isLoading 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : isSpeaking
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-gray-700 hover:bg-gray-800'
              }`}
            >
              {isSpeaking ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                  Stop Speaking
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.414 1.414m-.293-4.95a7 7 0 011.414-3.95m2.879 2.879a3 3 0 00-4.243-4.243m2.121-2.121a7 7 0 0110 0l-5 5m-9.9 2.828a13 13 0 000 12.728">
                    </path>
                  </svg>
                  Speak Analysis
                </>
              )}
            </button>
            
            <button 
              onClick={handleSpeakEvaluation}
              disabled={!bestMoves || bestMoves.length === 0 || isSpeaking || isAnalyzing}
              className={`flex items-center py-2 px-4 rounded-md font-medium text-white transition-all duration-200 shadow-md ${
                !bestMoves || bestMoves.length === 0 || isSpeaking || isAnalyzing
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3"></path>
              </svg>
              Speak Evaluation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;