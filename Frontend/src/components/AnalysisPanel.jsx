import React from 'react';

const AnalysisPanel = ({ fen }) => {
  const evaluationScore = '0.0';
  const bestMoves = [
    { san: 'e4', uci: 'e2e4' },
    { san: 'Nf3', uci: 'g1f3' },
    { san: 'd4', uci: 'd2d4' }
  ];
  
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
        <p>
          This position is balanced with equal opportunities for both sides.
          White's control of the center gives slight initiative.
          (This is a placeholder for Gemini-generated explanations)
        </p>
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