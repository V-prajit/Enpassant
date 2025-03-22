import React, { useState } from 'react';
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

  // Setup test positions with better test cases
  const loadPromotionTest = () => {
    // White pawn about to promote - white to move
    console.log("Loading white promotion test position");
    // Position with a white pawn on the 7th rank ready to promote
    // Using a simpler position with just the pawn and kings
    // Standard pawn promotion position
    initGame('7k/1P6/8/8/8/8/8/K7 w - - 0 1');
    console.log("White pawn on b7 can be promoted by moving to b8");
  };

  const loadBlackPromotionTest = () => {
    // Black pawn about to promote - black to move
    console.log("Loading black promotion test position");
    // A simpler position with black pawn and kings - make sure there's space for promotion
    initGame('k7/8/8/8/8/8/1p6/K7 b - - 0 1');
    console.log("Black pawn on b2 can be promoted by moving to b1");
  };

  return (
    <div className="app-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1>Chess Voice Coach</h1>
      <div className="game-info" style={{ marginBottom: '10px' }}>
        <span><strong>Current turn:</strong> {turn === 'w' ? 'White' : 'Black'}</span>
      </div>
      
      <div className="main-content" style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
        <div className="left-panel">
          <Chessboard 
            fen={fen} 
            lastMove={lastMove} 
            onMove={makeMove}
            orientation={boardOrientation}
            getLegalMoves={getLegalMoves}
          />
          
          <div className="controls" style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => initGame()}>New Game</button>
            <button onClick={undoMove}>Undo Move</button>
            <button onClick={toggleOrientation}>Flip Board</button>
            <button onClick={() => initGame('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3')}>
              Load Position
            </button>
            <button onClick={loadPromotionTest}>
              Test White Promotion
            </button>
            <button onClick={loadBlackPromotionTest}>
              Test Black Promotion
            </button>
          </div>
        </div>
        
        <div className="right-panel" style={{ flex: 1, minWidth: '300px' }}>
          <MoveHistory history={history} onMoveClick={handleMoveClick} />
          <AnalysisPanel fen={fen} onSelectMove={handleSelectMove} />
        </div>
      </div>
    </div>
  );
};

export default Layout;