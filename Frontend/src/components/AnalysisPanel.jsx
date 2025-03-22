import React, { useState } from 'react';
import { getStockfishAnalysis, getGeminiExplanation } from '../services/api';

const AnalysisPanel = ({ fen, onSelectMove }) => {
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerLevel, setPlayerLevel] = useState('beginner');
  const [error, setError] = useState(null);
  
  // Handle Stockfish analysis
  const handleAnalyze = async () => {
    if (!fen || isAnalyzing) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const result = await getStockfishAnalysis(fen, 15);
      setEvaluation(result.evaluation);
      setBestMoves(result.bestMoves);
    } catch (error) {
      console.error('Stockfish analysis error:', error);
      setError('Failed to analyze position with Stockfish');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
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
        <div className="text-lg font-semibold text-gray-800 bg-gray-50 py-2 px-4 rounded-md shadow-sm">
          {evaluation}
        </div>
      </div>
      
      <div className="best-moves mb-6">
        <h4 className="text-md font-medium text-gray-700 mb-2">Suggested Moves</h4>
        {bestMoves.length === 0 ? (
          <p className="text-gray-600 italic">No moves available. Click "Analyze Position" to get suggestions.</p>
        ) : (
          <ul className="list-none p-0 space-y-2">
            {bestMoves.map((move, index) => (
              <li 
                key={index} 
                className="py-2 px-4 bg-gray-50 rounded-md shadow-sm text-gray-800 hover:bg-gray-100 transition-colors duration-200 cursor-pointer"
                onClick={() => onSelectMove && onSelectMove(move)}
              >
                {move.san} <span className="text-gray-600">({move.uci})</span>
              </li>
            ))}
          </ul>
        )}
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
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !fen}
            className={`py-2 px-4 rounded-md font-medium text-white transition-all duration-200 shadow-md
              ${isAnalyzing || !fen ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-900 hover:shadow-lg focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'}`}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
          </button>
          
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