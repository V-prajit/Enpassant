import React, { useState, useEffect } from 'react';
import Chessboard from './Chessboard';
import MoveHistory from './MoveHistory';
import AnalysisPanel from './AnalysisPanel';
import useChessGame from '../hooks/useChessGame';

const Layout = () => {
  const { 
    fen, 
    history, 
    lastMove, 
    makeMove, 
    undoMove, 
    initGame,
    getLegalMoves,
    playMove,
    turn
  } = useChessGame();

  const [boardOrientation, setBoardOrientation] = useState('white');
  const [logoLoaded, setLogoLoaded] = useState(false);

  // Logo animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setLogoLoaded(true);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleSelectMove = (move) => {
    if (move && move.uci) {
      const from = move.uci.substring(0, 2);
      const to = move.uci.substring(2, 4);
      const promotion = move.uci.length > 4 ? move.uci[4] : undefined;
      makeMove(from, to, promotion);
    }
  };

  const handleMoveClick = (moveObj) => {
    console.log('Clicked move in history:', moveObj);
  };

  const toggleOrientation = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
  };

  const loadPromotionTest = () => {
    console.log("Loading white promotion test position");
    initGame('7k/1P6/8/8/8/8/8/K7 w - - 0 1');
  };

  // Calculate evaluation for the evaluation bar visualization
  const evalBarPercentage = () => {
    // This would be replaced with actual evaluation from Stockfish
    const currentEval = 0.1; // Example value between -1 and 1
    const normalizedEval = Math.max(-1, Math.min(1, currentEval)); // Clamp between -1 and 1
    return 50 + (normalizedEval * 50); // Convert to percentage (0-100%)
  };

  return (
    <div className="max-w-[1400px] mx-auto p-5">
      {/* Header Bar */}
      <header className="enigma-header">
        <div className={`enigma-logo ${logoLoaded ? 'loaded' : ''}`}>
          <span>E</span>
          <span>N</span>
          <span>I</span>
          <span>G</span>
          <span>M</span>
          <span>A</span>
        </div>
        <div className="user-profile">
          {/* Icon will go here */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
            <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd" />
          </svg>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-wrap lg:flex-nowrap gap-5 enigma-layout">
        {/* Left column - Chess Board & Controls */}
        <div className="lg:w-2/5 w-full board-container flex flex-col">
          {/* Board area with evaluation bar */}
          <div className="flex mb-4">
            <div className="eval-bar">
              <div 
                className="eval-bar-inner" 
                style={{ height: `${evalBarPercentage()}%` }}
              ></div>
            </div>
            
            <Chessboard 
              fen={fen} 
              lastMove={lastMove} 
              onMove={makeMove}
              orientation={boardOrientation}
              getLegalMoves={getLegalMoves}
            />
          </div>
          
          {/* Control buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <button 
              className="enigma-button"
              onClick={() => initGame()}
            >
              New Game
            </button>
            <button 
              className="enigma-button"
              onClick={undoMove}
            >
              Undo Move
            </button>
            <button 
              className="enigma-button"
              onClick={toggleOrientation}
            >
              Flip Board
            </button>
            <button 
              className="enigma-button"
              onClick={() => initGame('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3')}
            >
              Load Position
            </button>
          </div>
          
          {/* Move History (bottom left) */}
          <div className="bento-card mt-4">
            <MoveHistory history={history} onMoveClick={handleMoveClick} />
          </div>
        </div>
        
        {/* Right column - Analysis Panel */}
        <div className="lg:w-3/5 w-full analysis-container">
          <div className="bento-card h-full">
            <AnalysisPanel fen={fen} onSelectMove={handleSelectMove} />
            
            {/* Think Deeper button */}
            <button className="think-deeper mt-6 w-full">
              Think Deeper!
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-.53 14.03a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06l-1.72 1.72V8.25a.75.75 0 00-1.5 0v5.69l-1.72-1.72a.75.75 0 00-1.06 1.06l3 3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* Game status indicator */}
      <div className="mt-4 text-center text-sm text-gray-400">
        Current turn: <span className="font-bold text-white">{turn === 'w' ? 'White' : 'Black'}</span>
      </div>
    </div>
  );
};

export default Layout;