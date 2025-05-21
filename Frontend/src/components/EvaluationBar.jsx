// Enpassant/Frontend/src/components/EvaluationBar.jsx
import React, { useEffect, useState } from 'react';

const EvaluationBar = ({ evaluation, isAnalyzing, orientation = 'white' }) => {
  // displayEval will hold the actual text like "+0.5", "M5", "..."
  const [displayEvalText, setDisplayEvalText] = useState("0.0");
  const [showSpinningIcon, setShowSpinningIcon] = useState(false);

  useEffect(() => {
    if (evaluation === "..." || evaluation === null) {
      setDisplayEvalText("..."); // Show placeholder
      setShowSpinningIcon(true);  // Show spinner when evaluation is "..."
    } else {
      setDisplayEvalText(evaluation); // Set the actual evaluation text
      setShowSpinningIcon(false); // Hide spinner once a concrete evaluation is received
    }
  }, [evaluation]); // Re-run when the 'evaluation' prop changes

  let numericEval = 0;
  let mateNumber = null;
  let isGameOver = false; // For checkmate or draw text
  let isMateForWhite = true; // For mate score direction

  if (typeof displayEvalText === 'string') {
    const lowerEval = displayEvalText.toLowerCase().trim();

    if (lowerEval === "...") {
      // Keep numericEval as 0, bar will be neutral
    } else if (lowerEval.includes('checkmate')) {
      isGameOver = true;
      isMateForWhite = !lowerEval.includes('black'); // "White wins" or "Black loses" implies white has mate advantage
    } else if (lowerEval === "draw") {
      isGameOver = true;
      numericEval = 0;
    } else if (lowerEval === "error") {
      isGameOver = true; // Treat as a distinct state
      numericEval = 0; // Neutral bar
    } else {
      const mateMatch = lowerEval.match(/^m(-?\d+)$/i); // Matches M5, M-3
      if (mateMatch) {
        mateNumber = parseInt(mateMatch[1], 10);
        isMateForWhite = mateNumber > 0;
      } else {
        const evalValue = parseFloat(lowerEval); // Handles "+0.5", "-1.2", "0.0"
        if (!isNaN(evalValue)) {
          numericEval = evalValue;
        }
      }
    }
  } else if (typeof displayEvalText === 'number') { // Should not happen if prop is string
    numericEval = displayEvalText;
  }

  let currentDisplayText = '0.0';
  if (displayEvalText === "...") {
    currentDisplayText = "...";
  } else if (mateNumber !== null) {
    currentDisplayText = `M${Math.abs(mateNumber)}`;
  } else if (isGameOver) {
    if (displayEvalText.toLowerCase() === "draw") currentDisplayText = "½-½";
    else if (displayEvalText.toLowerCase() === "error") currentDisplayText = "ERR";
    else currentDisplayText = isMateForWhite ? "1-0" : "0-1"; // Simplified mate representation
  } else {
    if (numericEval > 0) currentDisplayText = `+${Math.abs(numericEval).toFixed(1)}`;
    else if (numericEval < 0) currentDisplayText = `-${Math.abs(numericEval).toFixed(1)}`;
    else currentDisplayText = "0.0";
  }

  let blackPercentage = 50;
  if (displayEvalText === "..." || displayEvalText.toLowerCase() === "error" || displayEvalText.toLowerCase() === "draw") {
    blackPercentage = 50;
  } else if (mateNumber !== null) {
    blackPercentage = isMateForWhite ? 0 : 100;
  } else if (isGameOver) { // Checkmate specific
    blackPercentage = isMateForWhite ? 0 : 100;
  }
  else {
    const evalPercentage = Math.min(Math.abs(numericEval) * 5, 100) / 2;
    blackPercentage = numericEval >= 0 ? 50 - evalPercentage : 50 + evalPercentage;
  }

  const displayClass =
    (mateNumber !== null || (isGameOver && displayEvalText.toLowerCase() !== "draw" && displayEvalText.toLowerCase() !== "error" && displayEvalText !== "..."))
      ? (isMateForWhite ? 'bg-white/80 text-black' : 'bg-black/80 text-white')
      : (numericEval > 0
          ? 'bg-white/80 text-black'
          : numericEval < 0
            ? 'bg-black/80 text-white'
            : (displayEvalText === "..." ? 'bg-gray-400/80 text-gray-700 animate-pulse' : 'bg-gray-400/80 text-gray-800'));


  const isWhiteBottom = orientation === 'white';

  return (
    <div className="evaluation-bar-container h-[450px] w-6 mr-3 flex flex-col relative rounded-md overflow-hidden shadow-md bg-gray-200">
      {/* Bar rendering */}
      {isWhiteBottom ? (
        <>
          <div className="bg-black" style={{ height: `${blackPercentage}%`, transition: 'height 0.2s ease-out' }} />
          <div className="h-[2px] bg-gray-500 absolute left-0 right-0" style={{ top: '50%', zIndex: 1 }} />
          <div className="bg-white" style={{ height: `${100 - blackPercentage}%`, transition: 'height 0.2s ease-out' }} />
        </>
      ) : (
        <>
          <div className="bg-white" style={{ height: `${100 - blackPercentage}%`, transition: 'height 0.2s ease-out' }} />
          <div className="h-[2px] bg-gray-500 absolute left-0 right-0" style={{ top: '50%', zIndex: 1 }} />
          <div className="bg-black" style={{ height: `${blackPercentage}%`, transition: 'height 0.2s ease-out' }} />
        </>
      )}
      
      {/* Text and Spinner Overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        {/* Evaluation Text */}
        <div className={`text-xs font-bold px-1 py-0.5 rounded-sm shadow-sm ${displayClass} ${isAnalyzing && !showSpinningIcon ? 'opacity-90' : ''}`}>
          {currentDisplayText}
        </div>
        
        {/* Spinning Icon: shows if engine is "isAnalyzing" AND we are specifically in the "..." loading state */}
        {isAnalyzing && showSpinningIcon && (
          <div className="absolute inset-0 flex items-center justify-center bg-transparent">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
          </div>
        )}
      </div>
      
       {/* Subtle pulsing bar overlay if analyzing but not showing main spinner icon - indicates ongoing calculation */}
       {isAnalyzing && !showSpinningIcon && (
        <div className="absolute inset-0 animate-pulse pointer-events-none">
          <div className="h-full w-full bg-gradient-to-b from-slate-400/20 via-slate-500/5 to-slate-400/20 opacity-60"></div>
        </div>
      )}

      {/* Ticks (unchanged) */}
      <div className="absolute top-0 left-0 right-0 bottom-0 pointer-events-none z-0">
        {/* ... ticks ... */}
      </div>
    </div>
  );
};

export default EvaluationBar;