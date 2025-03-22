// Frontend/src/components/AnalysisPanel.jsx (updated)
import React, { useState } from 'react';
import { getStockfishAnalysis, getGeminiExplanation } from '../services/api';

const AnalysisPanel = ({ fen, onSelectMove }) => {
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [explanation, setExplanation] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playerLevel, setPlayerLevel] = useState('beginner');
  const [analysisType, setAnalysisType] = useState('general');
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
      const result = await getGeminiExplanation(
        fen, 
        evaluation, 
        bestMoves, 
        playerLevel,
        analysisType
      );
      setExplanation(result.explanation);
    } catch (error) {
      console.error('Gemini explanation error:', error);
      setError('Failed to get AI explanation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="analysis-panel">
      <h3>Position Analysis</h3>
      
      <div className="evaluation">
        <h4>Evaluation</h4>
        <div>{evaluation}</div>
      </div>
      <div className="best-moves">
        <h4>Suggested Moves</h4>
        <ul>
          {bestMoves.map((move, index) => (
            <li key={index} onClick={() => onSelectMove && onSelectMove(move)}>
              {move.uci} {move.san && `(${move.san})`}
            </li>
          ))}
        </ul>
      </div>
      
      <div className="ai-explanation">
        <h4>AI Coach Explanation</h4>
        <div className="controls">
          <div className="settings-row">
            <label>
              Skill Level:
              <select 
                value={playerLevel} 
                onChange={(e) => setPlayerLevel(e.target.value)}
                className="setting-select"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            
            <label>
              Analysis Type:
              <select 
                value={analysisType} 
                onChange={(e) => setAnalysisType(e.target.value)}
                className="setting-select"
              >
                <option value="general">General</option>
                <option value="tactical">Tactical</option>
                <option value="educational">Educational</option>
              </select>
            </label>
          </div>
          
          <div className="button-row">
            <button 
              onClick={handleAnalyze} 
              disabled={isAnalyzing || !fen}
              className="analyze-button"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze Position'}
            </button>
            
            <button 
              onClick={handleGetExplanation} 
              disabled={isLoading || !fen || bestMoves.length === 0}
              className="explain-button"
            >
              {isLoading ? 'Loading explanation...' : 'Get AI Explanation'}
            </button>
          </div>
        </div>
        
        {error && <div className="error" style={{ color: 'red', marginTop: '10px' }}>{error}</div>}
        
        <div className="explanation-content" style={{ 
          marginTop: '15px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '5px',
          whiteSpace: 'pre-line'
        }}>
          {isLoading ? (
            <p>Getting AI explanation...</p>
          ) : explanation ? (
            <p>{explanation}</p>
          ) : (
            <p>First analyze the position, then click "Get AI Explanation" to receive personalized coaching.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;