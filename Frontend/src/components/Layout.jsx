import React, { useState, useEffect, useCallback } from 'react';
import Chessboard from './Chessboard';
import MoveHistory from './MoveHistory';
import AnalysisPanel from './AnalysisPanel';
import ChatInterface from './ChatInterface';
import EvaluationBar from './EvaluationBar';
import useChessGame from '../hooks/useChessGame';
import { PlusCircle, RotateCcw, RefreshCw, Edit } from 'lucide-react';
import FenModal from './FenModal';
import { stopStockfishAnalysis } from '../services/api'; // Import the stop function

const Layout = () => {
  const {
    fen,
    history,
    lastMove,
    makeMove: chessJsMakeMove,
    undoMove: chessJsUndoMove,
    initGame: chessJsInitGame,
    getLegalMoves,
    playMove,
    turn
  } = useChessGame();

  const [boardOrientation, setBoardOrientation] = useState('white');
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Overall analyzing state for UI
  const [showFenInput, setShowFenInput] = useState(false);
  const [fenInput, setFenInput] = useState('');

  // Wrapped game actions to include stopping analysis
  const makeMove = useCallback((from, to, promotion) => {
    stopStockfishAnalysis(); // Stop analysis before making a move
    return chessJsMakeMove(from, to, promotion);
  }, [chessJsMakeMove]);

  const undoMove = useCallback(() => {
    stopStockfishAnalysis();
    return chessJsUndoMove();
  }, [chessJsUndoMove]);

  const initGame = useCallback((newFen) => {
    stopStockfishAnalysis();
    chessJsInitGame(newFen);
     // Clear analysis display for new game/FEN
    setEvaluation('0.0');
    setBestMoves([]);
  }, [chessJsInitGame]);


  const handleSelectMoveFromAnalysis = (move) => {
    if (move && move.uci) {
      // stopStockfishAnalysis(); // AnalysisPanel's useEffect on FEN will handle restart
      const from = move.uci.substring(0, 2);
      const to = move.uci.substring(2, 4);
      const promotion = move.uci.length > 4 ? move.uci[4] : undefined;
      chessJsMakeMove(from, to, promotion); // Use original makeMove here
    }
  };

  const handleMoveClickInHistory = (moveObj) => {
    // This would typically involve navigating the game to that point.
    // For now, just logging. If implementing time travel, ensure analysis updates.
    console.log('Clicked move in history:', moveObj);
    // Example: initGame(moveObj.after); // if moveObj contains the FEN after the move
  };

  const toggleOrientation = () => {
    setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
  };

  const handleSetFen = () => {
    if (fenInput.trim() !== '') {
      initGame(fenInput.trim()); // Use the wrapped initGame
      setFenInput('');
      setShowFenInput(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-4 md:p-5 bg-gray-100 rounded-lg shadow-lg relative">
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-gray-800 border-b-2 border-gray-300 pb-2 mb-4 md:mb-6">
        Enpassant
      </h1>

      <div className="mb-2 text-sm md:text-base">
        <span className="font-bold text-gray-700">Current turn:</span> {turn === 'w' ? 'White' : 'Black'}
      </div>
      
      <div className="flex flex-col lg:flex-row flex-wrap gap-4 md:gap-5">
        {/* Left Column: Chessboard, Buttons, and Move History */}
        <div className="flex-1 min-w-[300px] sm:min-w-[350px] md:min-w-[400px]">
          <div className="flex items-start space-x-2 md:space-x-3">
            <EvaluationBar
              evaluation={evaluation}
              isAnalyzing={isAnalyzing}
              orientation={boardOrientation}
            />
            <div className="w-full max-w-[400px] md:max-w-[450px] aspect-square"> {/* Maintain square aspect ratio */}
              <Chessboard
                fen={fen}
                lastMove={lastMove}
                onMove={makeMove} // Use wrapped makeMove
                orientation={boardOrientation}
                getLegalMoves={getLegalMoves}
              />
            </div>
          </div>
          
          <div className="mt-3 md:mt-4">
            <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-md text-xs sm:text-sm transition duration-200 flex items-center gap-1 sm:gap-2"
                onClick={() => initGame()} // Use wrapped initGame
              >
                <PlusCircle size={16} /> New Game
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-md text-xs sm:text-sm transition duration-200 flex items-center gap-1 sm:gap-2"
                onClick={undoMove} // Use wrapped undoMove
              >
                <RotateCcw size={16} /> Undo
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-md text-xs sm:text-sm transition duration-200 flex items-center gap-1 sm:gap-2"
                onClick={toggleOrientation}
              >
                <RefreshCw size={16} /> Flip
              </button>
              <button
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded-md text-xs sm:text-sm transition duration-200 flex items-center gap-1 sm:gap-2"
                onClick={() => setShowFenInput(true)}
              >
                <Edit size={16} /> Set FEN
              </button>
            </div>
            <div className="w-full max-w-[400px] md:max-w-[510px]"> {/* Match width if needed */}
              <MoveHistory history={history} onMoveClick={handleMoveClickInHistory} />
            </div>
          </div>
        </div>
        
        {/* Right Column: Analysis and Chat */}
        <div className="flex flex-col gap-4 flex-1 min-w-[300px] lg:max-w-[calc(100%-420px)] xl:max-w-[calc(100%-470px)] bg-white rounded-lg shadow-sm p-3 md:p-4">
          <ChatInterface
            fen={fen}
            evaluation={evaluation}
            bestMoves={bestMoves}
          />
          <AnalysisPanel
            fen={fen}
            onSelectMove={handleSelectMoveFromAnalysis}
            onEvaluationChange={setEvaluation}
            onBestMovesChange={setBestMoves}
            onAnalyzingChange={setIsAnalyzing} // This will reflect Stockfish's analyzing state
          />
        </div>
      </div>

      <FenModal
        show={showFenInput}
        fenInput={fenInput}
        setFenInput={setFenInput}
        handleSetFen={handleSetFen}
        handleCancel={() => {
          setFenInput('');
          setShowFenInput(false);
        }}
      />
    </div>
  );
};

export default Layout;