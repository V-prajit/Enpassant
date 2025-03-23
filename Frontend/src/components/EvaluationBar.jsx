import React from 'react';

const EvaluationBar = ({ evaluation, isAnalyzing, orientation = 'white' }) => {
  // Handle conversion of evaluation to a numeric value
  let numericEval = 0;
  let isCheckmate = false;
  let isMateForWhite = false;
  
  if (typeof evaluation === 'string') {
    if (evaluation.includes('Mate') || evaluation.includes('Checkmate')) {
      isCheckmate = true;
      isMateForWhite = !evaluation.includes('Black wins');
    } else {
      try {
        numericEval = parseFloat(evaluation);
      } catch (e) {
        numericEval = 0;
      }
    }
  } else if (typeof evaluation === 'number') {
    numericEval = evaluation;
  }
  
  // Positive values are good for white, negative for black
  // For the visual display, we need to convert this to a percentage
  const evalPercentage = Math.min(Math.abs(numericEval) * 5, 100) / 2; // 5% per pawn, max 50%
  
  // The vertical evaluation bar shows white on top, black on bottom
  // But we need to reverse this based on board orientation
  const isWhiteBottom = orientation === 'white';
  
  // Black advantage makes the bar higher (more black), white advantage makes it lower (more white)
  // The percentage is for the black portion
  let blackPercentage = 50 - evalPercentage;
  if (numericEval < 0) blackPercentage = 50 + evalPercentage;
  
  // In case of checkmate
  if (isCheckmate) {
    blackPercentage = isMateForWhite ? 0 : 100;
  }
  
  return (
    <div className="evaluation-bar-container h-[450px] w-6 mr-3 flex flex-col relative rounded-md overflow-hidden shadow-md">
      {/* Black side (top) */}
      <div 
        className="bg-black"
        style={{ 
          height: `${blackPercentage}%`,
          transition: 'height 0.5s ease'
        }}
      />
      {/* Center line */}
      <div 
        className="h-[2px] bg-gray-400 absolute left-0 right-0"
        style={{ 
          top: '50%',
        }}
      />
      {/* White side (bottom) */}
      <div 
        className="bg-white flex-grow border border-gray-200"
        style={{ 
          height: `${100 - blackPercentage}%`,
          transition: 'height 0.5s ease'
        }}
      />
      
      {/* Evaluation text overlay */}
      <div 
        className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center"
      >
        <div 
          className={`text-xs font-bold px-1 py-1 rounded-sm ${
            numericEval > 0 ? 'bg-white/80 text-black' :
            numericEval < 0 ? 'bg-black/80 text-white' :
            'bg-gray-400/80 text-gray-800'
          }`}
        >
          {isCheckmate 
            ? (isMateForWhite ? "♔" : "♚") 
            : numericEval > 0 
              ? "+" + Math.abs(numericEval).toFixed(1)
              : numericEval < 0
                ? "-" + Math.abs(numericEval).toFixed(1)
                : "0.0"
          }
        </div>
        
        {/* Loading indicator overlay */}
        {isAnalyzing && (
          <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
            <div className="animate-pulse h-full w-full bg-gradient-to-b from-black/10 to-white/10 absolute"></div>
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>
      
      {/* Evaluation ticks */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none">
        {/* +3 line */}
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '20%' }}></div>
        {/* +1 line */}
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '40%' }}></div>
        {/* -1 line */}
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '60%' }}></div>
        {/* -3 line */}
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '80%' }}></div>
      </div>
    </div>
  );
};

export default EvaluationBar;