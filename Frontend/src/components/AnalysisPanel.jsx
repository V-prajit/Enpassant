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
  const [depth, setDepth] = useState(15);
  
  // Use refs to track the latest state for use in effect dependencies
  const lastAnalyzedFen = useRef('');
  const analysisTimeoutRef = useRef(null);
  
  // Handle Stockfish analysis
  const handleAnalyze = async (analysisDepth = depth) => {
    if (!fen || isAnalyzing) return;
    
    // Save the FEN we're analyzing to avoid duplicate calls
    lastAnalyzedFen.current = fen;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      // Get Stockfish analysis
      const result = await getStockfishAnalysis(fen, analysisDepth);
      
      // Ensure we're still looking at the same position
      if (lastAnalyzedFen.current === fen) {
        // Update state with results
        setEvaluation(result.evaluation);
        setBestMoves(result.bestMoves);
      }
    } catch (error) {
      console.error('Stockfish analysis error:', error);
      setError('Failed to analyze position with Stockfish');
    } finally {
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
    
    // Add a small delay to prevent excessive API calls during rapid moves
    analysisTimeoutRef.current = setTimeout(() => {
      handleAnalyze();
    }, 500);
    
    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [fen, autoAnalyze]);
  
  // Handle Gemini explanation
  const handleGetExplanation = async () => {
    if (!fen || isLoading || bestMoves.length === 0) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getGeminiExplanation(fen, evaluation, bestMoves, playerLevel);
      setExplanation(result.explanation);
    } catch (error) {
      console.error('Gemini explanation error:', error);
      setError('Failed to get AI explanation');
    } finally {
      setIsLoading(false);
    }
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
        </div>
        
        {/* Visual evaluation bar */}
        {!evaluation.includes('Mate') && (
          <div className="mt-2 h-4 w-full bg-gray-200 rounded overflow-hidden">
            <div 
              className={`h-full ${parseFloat(evaluation) >= 0 ? 'bg-green-600' : 'bg-red-600'}`} 
              style={{ 
                width: `${Math.min(Math.abs(parseFloat(evaluation)) * 10, 50) + 50}%`,
                marginLeft: parseFloat(evaluation) >= 0 ? '50%' : `${50 - Math.min(Math.abs(parseFloat(evaluation)) * 10, 50)}%`
              }}
            ></div>
          </div>
        )}
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
              <option value="10">10 (Fast)</option>
              <option value="15">15 (Balanced)</option>
              <option value="20">20 (Deep)</option>
              <option value="22">22 (Max)</option>
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
          <select 
            value={playerLevel} 
            onChange={(e) => setPlayerLevel(e.target.value)}
            className="py-2 px-4 rounded-md border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all duration-200"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          
          <button 
            onClick={handleGetExplanation} 
            disabled={isLoading || !fen || bestMoves.length === 0}
            className={`py-2 px-4 rounded-md font-medium text-white transition-all duration-200 shadow-md
              ${isLoading || !fen || bestMoves.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-900 hover:shadow-lg focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'}`}
          >
            {isLoading ? 'Loading explanation...' : 'Get AI Explanation'}
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
            <p>{explanation}</p>
          ) : (
            <p className="text-gray-600">First analyze the position, then click "Get AI Explanation" to receive personalized coaching.</p>
          )}
        </div>
      </div>
      
      <div className="voice-controls">
        <h4 className="text-md font-medium text-gray-700 mb-2">Voice Commands</h4>
        <p className="text-gray-600 mb-2">Voice controls will be implemented in milestone 3</p>
        <button 
          disabled 
          className="bg-gray-300 text-gray-500 py-2 px-4 rounded-md cursor-not-allowed shadow-sm"
        >
          Start Listening
        </button>
      </div>
    </div>
  );
};

export default AnalysisPanel;