import React, { useState } from 'react';
import Chessboard from './Chessboard';
import MoveHistory from './MoveHistory';
import AnalysisPanel from './AnalysisPanel';
import ChatInterface from './ChatInterface';
import EvaluationBar from './EvaluationBar';
import useChessGame from '../hooks/useChessGame';
import { PlusCircle, RotateCcw, RefreshCw, Edit } from 'lucide-react';
import FenModal from './FenModal';

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
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showFenInput, setShowFenInput] = useState(false);
  const [fenInput, setFenInput] = useState('');

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

  const handleSetFen = () => {
    if (fenInput.trim() !== '') {
      initGame(fenInput);
      setFenInput('');
      setShowFenInput(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-5 bg-gray-100 rounded-md shadow-md relative">
      <h1 className="text-5xl font-extrabold tracking-tight text-gray-800 border-b-2 border-gray-300 pb-2 mb-6">
        Enpassant
      </h1>

      <div className="mb-2">
        <span className="font-bold text-gray-700">Current turn:</span> {turn === 'w' ? 'White' : 'Black'}
      </div>
      
      <div className="flex flex-wrap gap-5">
        {/* Left Column: Chessboard, Buttons, and Move History */}
        <div className="flex-1 min-w-[400px]">
          <div className="flex items-start space-x-3">
            {/* Vertical evaluation bar */}
            <EvaluationBar 
              evaluation={evaluation} 
              isAnalyzing={isAnalyzing}
              orientation={boardOrientation}
            />
            {/* Wrap the Chessboard in a fixed-width container */}
            <div className="w-[400px]">
              <Chessboard 
                fen={fen} 
                lastMove={lastMove} 
                onMove={makeMove}
                orientation={boardOrientation}
                getLegalMoves={getLegalMoves}
              />
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex flex-wrap gap-2 mb-4">
              <button 
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded transition duration-200 flex items-center gap-2"
                onClick={() => initGame()}
              >
                <PlusCircle size={16} />
                New Game
              </button>
              <button 
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded transition duration-200 flex items-center gap-2"
                onClick={undoMove}
              >
                <RotateCcw size={16} />
                Undo Move
              </button>
              <button 
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded transition duration-200 flex items-center gap-2"
                onClick={toggleOrientation}
              >
                <RefreshCw size={16} />
                Flip Board
              </button>
              <button 
                className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-3 rounded transition duration-200 flex items-center gap-2"
                onClick={() => setShowFenInput(true)}
              >
                <Edit size={16} />
                Set FEN
              </button>
            </div>
            {/* Wrap MoveHistory in the same fixed-width container as the Chessboard */}
            <div className="w-[510px]">
              <MoveHistory history={history} onMoveClick={handleMoveClick} />
            </div>
          </div>
        </div>
        
        {/* Right Column: Analysis and Chat */}
        <div className="flex flex-col gap-4 flex-1 min-w-[300px] bg-white rounded-md shadow-sm p-4">
        <ChatInterface
            fen={fen} 
            evaluation={evaluation} 
            bestMoves={bestMoves}
          />
          <AnalysisPanel 
            fen={fen} 
            bestMoves={bestMoves}
            onSelectMove={handleSelectMove} 
            onEvaluationChange={setEvaluation}
            onBestMovesChange={setBestMoves}
            onAnalyzingChange={setIsAnalyzing}
          />
        </div>
      </div>

      {/* Render the separate FEN modal component */}
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
