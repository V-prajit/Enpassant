import React from 'react';
import { getAnalysis, testAnalysis } from '../services/api';
const AnalysisPanel = ({ fen }) => {
  const [evaluationScore, setEvaluationScore] = useState('0.0');
  const [explanation, setExplanation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playerLevel, setPlayerLevel] = useState('beginner');
  const [error, setError] = useState(null);
  const bestMoves = [
    { san: 'e4', uci: 'e2e4' },
    { san: 'Nf3', uci: 'g1f3' },
    { san: 'd4', uci: 'd2d4' }
  ];
  
  const handleAnalyze = async () =>{
    if (!fen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getAnalysis(fen, evaluationScore, bestMoves, playerLevel);
      setExplanation(result.explanation);
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Failed to analyze position. Try the test endpoint instead.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAnalyze = async () => {
    if (!fen) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await testAnalysis(fen);
      setExplanation(result.explanation);
    } catch (error) {
      setError('Test analysis failed');
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="analysis-panel">
      <h3>Position Analysis</h3>
      
      <div className="evaluation">
        <h4>Evaluation</h4>
        <div>{evaluationScore}</div>
      </div>
      
      <div className="best-moves">
        <h4>Suggested Moves</h4>
        <ul>
          {bestMoves.map((move, index) => (
            <li key={index}>
              {move.san} ({move.uci})
            </li>
          ))}
        </ul>
      </div>
      
      <div className="ai-explanation">
        <h4>AI Explanation</h4>
        <div className="controls">
          <select 
            value={playerLevel} 
            onChange={(e) => setPlayerLevel(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          
          <button 
            onClick={handleAnalyze} 
            disabled={isLoading || !fen}
          >
            {isLoading ? 'Analyzing...' : 'Get Analysis'}
          </button>
          
          <button 
            onClick={handleTestAnalyze} 
            disabled={isLoading || !fen}
          >
            Test API
          </button>
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <div className="explanation-content">
          {isLoading ? (
            <p>Analyzing position...</p>
          ) : explanation ? (
            <p>{explanation}</p>
          ) : (
            <p>Click "Get Analysis" to analyze this position.</p>
          )}
        </div>
      </div>
      
      <div className="voice-controls">
        <h4>Voice Commands</h4>
        <p>Voice controls will be implemented in milestone 3</p>
        <button disabled>Start Listening</button>
      </div>
    </div>
  );
};

export default AnalysisPanel;