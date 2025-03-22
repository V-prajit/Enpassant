import React, { useState } from 'react';
import { getAnalysis, testAnalysis } from '../services/api';

const AnalysisPanel = ({ fen, onSelectMove }) => {
  const [evaluationScore, setEvaluationScore] = useState('0.0');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playerLevel, setPlayerLevel] = useState('beginner');
  const [error, setError] = useState(null);
  const [bestMoves, setBestMoves] = useState([
    { san: 'e4', uci: 'e2e4' },
    { san: 'Nf3', uci: 'g1f3' },
    { san: 'd4', uci: 'd2d4' }
  ]);
  
  const handleAnalyze = async () => {
    if (!fen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getAnalysis(fen, evaluationScore, bestMoves, playerLevel);
      setExplanation(result.explanation);
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Failed to analyze position. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAnalyze = async () => {
    if (!fen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await testAnalysis(fen, playerLevel);
      setExplanation(result.explanation);
    } catch (error) {
      setError('Test analysis failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 rounded-md shadow-sm">
      <h3 className="text-lg font-bold mb-4">Position Analysis</h3>
      
      <div className="evaluation mb-4">
        <h4 className="text-md font-bold mb-2">Evaluation</h4>
        <div className="text-lg">{evaluationScore}</div>
      </div>
      
      <div className="best-moves mb-4">
        <h4 className="text-md font-bold mb-2">Suggested Moves</h4>
        <ul className="list-none p-0">
          {bestMoves.map((move, index) => (
            <li key={index} className="py-1">
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
            disabled={isLoading || !fen}
            className={`bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Analyzing...' : 'Get Analysis'}
          </button>
          
          <button 
            onClick={handleTestAnalyze} 
            disabled={isLoading || !fen}
            className={`bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Test Analysis
          </button>
        </div>
        
        {error && <div className="text-red-500 mb-4">{error}</div>}
        
        <div className="explanation-content p-4 bg-gray-100 rounded-md whitespace-pre-line">
          {isLoading ? (
            <p>Analyzing position...</p>
          ) : explanation ? (
            <p>{explanation}</p>
          ) : (
            <p>Click "Get Analysis" to analyze this position.</p>
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
