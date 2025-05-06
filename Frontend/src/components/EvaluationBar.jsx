import React, { useEffect, useState } from 'react';

const EvaluationBar = ({ evaluation, isAnalyzing, orientation = 'white' }) => {
  const [displayEval, setDisplayEval] = useState(evaluation || '0.0');
  
  useEffect(() => {
    if (evaluation) {
      setDisplayEval(evaluation);
    }
  }, [evaluation]);
  
  let numericEval = 0;
  let mateNumber = null;
  let isGameOver = false;
  let isMateForWhite = true;

  if (typeof displayEval === 'string') {
    const lowerEval = displayEval.toLowerCase().trim();
    
    if (lowerEval.includes('black')) {
      isMateForWhite = false;
    } else if (lowerEval.includes('white')) {
      isMateForWhite = true;
    }
    
    const hasDigit = /\d/.test(lowerEval);
    if (lowerEval.includes('checkmate') && !hasDigit) {
      isGameOver = true;
    } else {
      const mateMatch = lowerEval.match(/(?:mate(?:s)?(?: in)?\s*|m)(\d+)/i);
      if (mateMatch) {
        mateNumber = parseInt(mateMatch[1], 10);
        if (!isMateForWhite) {
          mateNumber = -mateNumber;
        }
      } else {
        if (lowerEval.startsWith('+')) {
          numericEval = parseFloat(lowerEval.slice(1)) || 0;
        } else if (lowerEval.startsWith('-')) {
          numericEval = parseFloat(lowerEval) || 0;
        } else {
          numericEval = parseFloat(lowerEval) || 0;
        }
      }
    }
  } else if (typeof displayEval === 'number') {
    numericEval = displayEval;
  }
  
  if (mateNumber !== null) {
    isMateForWhite = mateNumber > 0;
  }

  let displayText = '';
  if (mateNumber !== null) {
    displayText = `M${Math.abs(mateNumber)}`;
  } else if (isGameOver) {
    displayText = isMateForWhite ? "♔" : "♚";
  } else {
    if (numericEval > 0) {
      displayText = `+${Math.abs(numericEval).toFixed(1)}`;
    } else if (numericEval < 0) {
      displayText = `-${Math.abs(numericEval).toFixed(1)}`;
    } else {
      displayText = "0.0";
    }
  }

  let blackPercentage = 50;
  if (mateNumber !== null || isGameOver) {
    blackPercentage = isMateForWhite ? 0 : 100;
  } else {
    // Scaling formula: 5% of bar per pawn advantage, max 50%
    // This creates a non-linear scale that's more visually useful
    const evalPercentage = Math.min(Math.abs(numericEval) * 5, 100) / 2;
    blackPercentage = numericEval >= 0 ? 50 - evalPercentage : 50 + evalPercentage;
  }

  const displayClass =
    (mateNumber !== null || isGameOver)
      ? (isMateForWhite ? 'bg-white/80 text-black' : 'bg-black/80 text-white')
      : (numericEval > 0
          ? 'bg-white/80 text-black'
          : numericEval < 0
            ? 'bg-black/80 text-white'
            : 'bg-gray-400/80 text-gray-800');

  const isWhiteBottom = orientation === 'white';

  return (
    <div className="evaluation-bar-container h-[450px] w-6 mr-3 flex flex-col relative rounded-md overflow-hidden shadow-md">
      {isWhiteBottom ? (
        <>
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
            style={{ top: '50%' }}
          />
          {/* White side (bottom) */}
          <div 
            className="bg-white border border-gray-200"
            style={{ 
              height: `${100 - blackPercentage}%`,
              transition: 'height 0.5s ease'
            }}
          />
        </>
      ) : (
        <>
          {/* White side (top) */}
          <div 
            className="bg-white border border-gray-200"
            style={{ 
              height: `${100 - blackPercentage}%`,
              transition: 'height 0.5s ease'
            }}
          />
          {/* Center line */}
          <div 
            className="h-[2px] bg-gray-400 absolute left-0 right-0"
            style={{ top: '50%' }}
          />
          {/* Black side (bottom) */}
          <div 
            className="bg-black"
            style={{ 
              height: `${blackPercentage}%`,
              transition: 'height 0.5s ease'
            }}
          />
        </>
      )}
      
      {/* Evaluation text overlay */}
      <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center">
        <div className={`text-xs font-bold px-1 py-1 rounded-sm ${displayClass}`}>
          {displayText}
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
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '20%' }}></div>
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '40%' }}></div>
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '60%' }}></div>
        <div className="absolute w-full h-[1px] bg-gray-300" style={{ top: '80%' }}></div>
      </div>
    </div>
  );
};

export default EvaluationBar;