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
      // Get Stockfish analysis
      const result = await getStockfishAnalysis(fen, 15);
      
      // Update state with results
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
    if (!fen || isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Get AI explanation
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
    <div className="bg-white p-5 rounded-md shadow-sm">
      <h3 className="text-lg font-bold mb-4">Position Analysis</h3>
      
      <div className="evaluation mb-4">
        <h4 className="text-md font-bold mb-2">Evaluation</h4>
        <div className="text-lg">{evaluation}</div>
      </div>
      
      <div className="best-moves mb-4">
        <h4 className="text-md font-bold mb-2">Suggested Moves</h4>
        <ul className="list-none p-0">
          {bestMoves.map((move, index) => (
            <li 
              key={index} 
              className="py-1 cursor-pointer hover:bg-gray-100"
              onClick={() => onSelectMove && onSelectMove(move)}
            >
              {move.san} ({move.uci})
            </li>
          ))}
        </ul>
      </div>
      
      <div className="ai-explanation mb-4">
        <h4 className="text-md font-bold mb-2">AI Coach Explanation</h4>
        <div className="controls flex flex-wrap gap-3 mb-4">
          <select 
            value={playerLevel} 
            onChange={(e) => setPlayerLevel(e.target.value)}
            className="py-2 px-4 rounded-md border border-gray-200"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          
          <button 
            onClick={handleAnalyze} 
            disabled={isAnalyzing || !fen}
            className={`bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
          </button>
          
          <button 
            onClick={handleGetExplanation} 
            disabled={isLoading || !fen || bestMoves.length === 0}
            className={`bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Loading explanation...' : 'Get AI Explanation'}
          </button>
        </div>
        
        {error && <div className="text-red-500 mb-4">{error}</div>}
        
        <div className="explanation-content p-4 bg-gray-100 rounded-md whitespace-pre-line">
          {isLoading ? (
            <p>Getting AI explanation...</p>
          ) : explanation ? (
            <p>{explanation}</p>
          ) : (
            <p>First analyze the position, then click "Get AI Explanation" to receive personalized coaching.</p>
          )}
        </div>
      </div>
      
      <div className="voice-controls mb-4">
        <h4 className="text-md font-bold mb-2">Voice Commands</h4>
        <p>Voice controls will be implemented in milestone 3</p>
        <button disabled className="bg-gray-300 text-gray-500 py-2 px-4 rounded-md cursor-not-allowed">Start Listening</button>
      </div>
    </div>
  );
};

export default AnalysisPanel;