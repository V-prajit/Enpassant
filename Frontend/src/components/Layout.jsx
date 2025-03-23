import React, { useState } from 'react';
import Chessboard from './Chessboard';
import MoveHistory from './MoveHistory';
import AnalysisPanel from './AnalysisPanel';
import ChatInterface from './ChatInterface';
import EvaluationBar from './EvaluationBar';
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
  const [evaluation, setEvaluation] = useState('0.0');
  const [bestMoves, setBestMoves] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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

  return (
    <div className="max-w-[1400px] mx-auto p-5 bg-gray-100 rounded-md shadow-md">
      <h1 className="text-5xl font-extrabold tracking-tight text-gray-800 border-b-2 border-gray-300 pb-2 mb-6">
        Enpassant
      </h1>


      <div className="mb-2">
        <span className="font-bold text-gray-700">Current turn:</span> {turn === 'w' ? 'White' : 'Black'}
      </div>
      
      <div className="flex flex-wrap gap-5">
        <div className="flex-1 min-w-[400px]">
          <div className="flex items-start">
            {/* Vertical evaluation bar */}
            <EvaluationBar 
              evaluation={evaluation} 
              isAnalyzing={isAnalyzing}
              orientation={boardOrientation}
            />
            
            <Chessboard 
              fen={fen} 
              lastMove={lastMove} 
              onMove={makeMove}
              orientation={boardOrientation}
              getLegalMoves={getLegalMoves}
            />
          </div>
          
          <div className="mt-4 flex flex-wrap gap-3">
            <button 
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition duration-200"
              onClick={() => initGame()}
            >
              New Game
            </button>
            <button 
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition duration-200"
              onClick={undoMove}
            >
              Undo Move
            </button>
            <button 
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition duration-200"
              onClick={toggleOrientation}
            >
              Flip Board
            </button>
            <button 
              className="bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded transition duration-200"
              onClick={() => initGame('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3')}
            >
              Load Position
            </button>
          </div>
        </div>
        
        <div className="flex-1 min-w-[300px] bg-white rounded-md shadow-sm p-4">
          <MoveHistory history={history} onMoveClick={handleMoveClick} />
          <div className="flex flex-col gap-5">
            <AnalysisPanel 
              fen={fen} 
              onSelectMove={handleSelectMove} 
              onEvaluationChange={setEvaluation}
              onBestMovesChange={setBestMoves}
              onAnalyzingChange={setIsAnalyzing}
            />
            <ChatInterface 
              fen={fen} 
              evaluation={evaluation} 
              bestMoves={bestMoves}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;