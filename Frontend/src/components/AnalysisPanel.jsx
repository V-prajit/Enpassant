import React, { useState, useEffect, useRef } from 'react';
import { getStockfishAnalysis, getGeminiExplanation } from '../services/api';
import { Chess } from 'chess.js';

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

  return (
    <div className="bg-white rounded-xl shadow-md ring-1 ring-gray-200/50 p-6 transition-all duration-300 hover:shadow-lg">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Position Analysis</h3>
      
      <div className="best-moves mb-6">
  <h4 className="text-md font-medium text-gray-700 mb-2">Suggested Moves</h4>
  {bestMoves.filter(move => move.san).length > 0 ? (
    <div className="flex gap-3">
      {bestMoves.filter(move => move.san).slice(0, 5).map((move, index) => (
        <button
          key={index}
          onClick={() => onSelectMove && onSelectMove(move)}
          className="px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-100 transition-colors duration-200"
        >
          <span className="text-sm font-bold text-green-600">
            {move.san}
          </span>
        </button>
      ))}
    </div>
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
        <div className="controls flex flex-wrap gap-3 mb-4">
          
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
    </div>
  );
};

export default AnalysisPanel;