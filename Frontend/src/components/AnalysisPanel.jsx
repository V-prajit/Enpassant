import React, { useState, useEffect, useRef } from 'react';
import { getStockfishAnalysis, getGeminiExplanation } from '../services/api';

const AnalysisPanel = ({ fen, onSelectMove }) => {
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerLevel, setPlayerLevel] = useState('beginner');
  const [error, setError] = useState(null);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [depth, setDepth] = useState(22);
  
  // Use refs to track the latest state for use in effect dependencies
  const lastAnalyzedFen = useRef('');
  const analysisTimeoutRef = useRef(null);
  
  // Handle progressive Stockfish analysis (chess.com style)
  const handleAnalyze = async (analysisDepth = depth) => {
    if (!fen || isAnalyzing) return;
    
    // Save the FEN we're analyzing to avoid duplicate calls
    lastAnalyzedFen.current = fen;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Progressive analysis with callback for updates
      await getStockfishAnalysis(
        fen, 
        analysisDepth,
        // This callback receives progressive updates as analysis deepens
        (progressResult) => {
          // Only update if we're still analyzing the same position
          if (lastAnalyzedFen.current === fen) {
            console.log(`Progressive update: depth ${progressResult.depth}, eval: ${progressResult.evaluation}`);
            
            // Update UI immediately with each depth increase
            setEvaluation(progressResult.evaluation);
            
            // Only update moves if we have them
            if (progressResult.bestMoves && progressResult.bestMoves.length > 0) {
              setBestMoves(progressResult.bestMoves);
            }
            
            // Continue showing analyzing state until we get a very deep result
            // This gives users feedback that analysis is still improving
            if (progressResult.depth >= 18 || progressResult.completed) {
              setIsAnalyzing(false);
            }
          }
        }
      );
    } catch (error) {
      console.error('Stockfish analysis error:', error);
      setError('Analysis unavailable. Try again or adjust depth.');
      setIsAnalyzing(false);
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
    handleAnalyze();
    
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [fen, autoAnalyze]);
  
  // State to track response time
  const [responseTime, setResponseTime] = useState(null);
  
  // Handle Gemini explanation
  const handleGetExplanation = async () => {
    if (!fen || isLoading || bestMoves.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    setExplanation(''); // Clear previous explanation
    setResponseTime(null); // Reset response time
    
    try {
      console.log(`Requesting explanation for ${playerLevel} level player`);
      const clientStartTime = performance.now();
      
      // Make sure we're passing the correct level
      const result = await getGeminiExplanation(fen, evaluation, bestMoves, playerLevel);
      
      const clientResponseTime = ((performance.now() - clientStartTime) / 1000).toFixed(2);
      console.log(`Response received in ${clientResponseTime}s (client-side measurement)`);
      
      if (result && result.explanation) {
        setExplanation(result.explanation);
        
        // If server provided response time, use it, otherwise use client-side measurement
        const finalResponseTime = result.responseTime || clientResponseTime;
        setResponseTime(finalResponseTime);
        console.log(`AI generated ${result.explanation.length} characters in ${finalResponseTime}s`);
      } else {
        throw new Error('Empty or invalid response from AI service');
      }
    } catch (error) {
      console.error('Gemini explanation error:', error);
      
      // Display a more detailed error message for clarity
      const errorMessage = error.message.includes('AI analysis service') 
        ? error.message 
        : `Failed to get AI explanation: ${error.message}. Please try again.`;
      
      setError(errorMessage);
      
      // Also show a fallback message in the explanation area
      setExplanation(`Unable to generate AI analysis for this position at ${playerLevel} level. Please try again later or select a different skill level.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="analysis-panel">
      <div className="analysis-panel-header">ENIGMA Analysis</div>
      
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-300 mb-2">Evaluation</h4>
        <div className="eval-display flex items-center">
          <div className={`text-xl font-bold ${
            evaluation.includes('Mate') 
              ? evaluation.includes('Mated') ? 'text-red-400' : 'text-green-400'
              : parseFloat(evaluation) > 0 
                ? 'text-green-400' 
                : parseFloat(evaluation) < 0 
                  ? 'text-red-400' 
                  : 'text-gray-200'
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
            <div className="ml-3 text-sm text-gray-400 flex items-center">
              <div className="animate-spin h-4 w-4 border-2 border-accent-color rounded-full border-t-transparent mr-2"></div>
              Analyzing...
            </div>
          )}
        </div>
        
        {/* Visual evaluation bar (horizontal for mobile design) */}
        {!evaluation.includes('Mate') && (
          <div className="mt-2 h-3 w-full bg-[rgba(255,255,255,0.05)] rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-[var(--negative-eval)]" 
              style={{ 
                width: `${50 - Math.min(Math.abs(parseFloat(evaluation)) * 8, 50)}%`
              }}
            ></div>
            <div 
              className="h-full border-l border-r border-gray-700" 
              style={{ 
                width: '0.5%'
              }}
            ></div>
            <div 
              className="h-full bg-[var(--positive-eval)]" 
              style={{ 
                width: `${Math.min(Math.abs(parseFloat(evaluation)) * 8, 50) + 49.5}%`,
              }}
            ></div>
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-300 mb-2">Suggested Moves</h4>
        {bestMoves.length > 0 ? (
          <ul className="list-none p-0 border border-[rgba(255,255,255,0.1)] rounded-[var(--border-radius-md)] divide-y divide-[rgba(255,255,255,0.05)] shadow-md">
            {bestMoves.map((move, index) => (
              <li 
                key={index} 
                className="py-2 px-3 cursor-pointer hover:bg-[rgba(255,255,255,0.05)] flex items-center"
                onClick={() => onSelectMove && onSelectMove(move)}
              >
                <div className="move-number mr-3 bg-[rgba(76,201,240,0.2)] text-[var(--accent-color)] px-2 py-1 rounded-md font-medium text-sm">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-gray-200">{move.san || 'Unknown'}</div>
                  <div className="text-xs text-gray-400">{move.uci}</div>
                </div>
                <div className="ml-auto">
                  <button 
                    className="enigma-button text-sm py-1 px-2"
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
          <div className="p-6 bg-[rgba(255,255,255,0.05)] text-center rounded-[var(--border-radius-md)] shadow-md">
            <div className="animate-spin h-8 w-8 border-2 border-accent-color rounded-full border-t-transparent mx-auto mb-3"></div>
            <p className="text-gray-300">Analyzing position...</p>
          </div>
        ) : (
          <div className="p-6 bg-[rgba(255,255,255,0.05)] text-center rounded-[var(--border-radius-md)] shadow-md">
            <p className="text-gray-400 italic">No suggested moves available</p>
            {!autoAnalyze && (
              <button
                onClick={() => handleAnalyze(depth)}
                className="mt-4 enigma-button"
              >
                Analyze Now
              </button>
            )}
          </div>
        )}
      </div>
      
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-300 mb-2">Analysis Settings</h4>
        <div className="flex flex-wrap gap-3 bg-[rgba(255,255,255,0.05)] p-3 rounded-[var(--border-radius-md)] shadow-md">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="autoAnalyze"
              checked={autoAnalyze}
              onChange={() => setAutoAnalyze(!autoAnalyze)}
              className="mr-2 h-4 w-4 accent-[var(--accent-color)]"
            />
            <label htmlFor="autoAnalyze" className="text-gray-300">Auto-analyze positions</label>
          </div>
          
          <div className="flex items-center ml-4">
            <label htmlFor="depth" className="mr-2 text-gray-300">Depth:</label>
            <select
              id="depth"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="py-1 px-2 rounded-md border border-[rgba(255,255,255,0.1)] bg-[var(--surface-color)] text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-color"
            >
              <option value="12">12 (Fast)</option>
              <option value="18">18 (Balanced)</option>
              <option value="22">22 (Strong)</option>
              <option value="26">26 (Deeper)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-300 mb-2">AI Coach Explanation</h4>
        <div className="flex flex-wrap gap-3 mb-4">
          <select 
            value={playerLevel} 
            onChange={(e) => setPlayerLevel(e.target.value)}
            className="py-2 px-4 rounded-[var(--border-radius-sm)] border border-[rgba(255,255,255,0.1)] bg-[var(--surface-color)] text-gray-300 focus:outline-none focus:ring-2 focus:ring-accent-color"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          
          <button 
            onClick={handleGetExplanation} 
            disabled={isLoading || !fen || bestMoves.length === 0}
            className={`enigma-button py-2 px-4 ${isLoading || !fen || bestMoves.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Loading explanation...' : 'Get AI Explanation'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-400 bg-[rgba(239,68,68,0.1)] py-2 px-4 rounded-md mb-4">
            {error}
          </div>
        )}
        
        <div className="p-4 bg-[rgba(255,255,255,0.05)] rounded-[var(--border-radius-md)] shadow-md text-gray-300 whitespace-pre-line min-h-[120px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin h-5 w-5 border-2 border-accent-color rounded-full border-t-transparent mr-3"></div>
              <p>Getting AI explanation...</p>
            </div>
          ) : explanation ? (
            <div>
              <p>{explanation}</p>
              {responseTime && (
                <p className="text-xs text-gray-500 mt-2 text-right">
                  Generated in {typeof responseTime === 'number' ? responseTime.toFixed(2) : responseTime}s
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center">First analyze the position, then click "Get AI Explanation" to receive personalized coaching.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;