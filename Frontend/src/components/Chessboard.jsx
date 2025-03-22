import React, { useState, useCallback } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';

const Chessboard = ({ 
  fen = 'rnbqkbnr/pppppppp/5n5/8/8/5N5/PPPPPPPP/RNBQKB1R w KQkq - 0 1', // Default FEN
  lastMove, 
  onMove = () => {}, 
  orientation = 'white',
  getLegalMoves = () => [] // Default to empty array if not provided
}) => {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [promotionSquare, setPromotionSquare] = useState(null);

  // Convert square (e.g., 'e2') to FEN board index
  const squareToIndex = (square) => {
    try {
      const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // a=0, b=1, etc.
      const rank = 8 - parseInt(square[1]); // 8=0, 7=1, etc.
      return rank * 8 + file;
    } catch (error) {
      console.error(`Invalid square format: ${square}`, error);
      return -1;
    }
  };

  // Get piece at a square from FEN
  const getPieceAtSquare = (square) => {
    try {
      const board = fen.split(' ')[0]
        .split('/')
        .map(row => row.replace(/\d/g, match => '.'.repeat(parseInt(match))))
        .join('')
        .split('');
      const index = squareToIndex(square);
      return (index >= 0 && index < board.length) ? board[index] : null;
    } catch (error) {
      console.error(`Error parsing FEN for square ${square}:`, error);
      return null;
    }
  };

  // Handle square clicks
  const onSquareClick = useCallback((square) => {
    console.log(`Clicked square: ${square}, Selected: ${selectedSquare}, FEN: ${fen}`);

    try {
      const piece = getPieceAtSquare(square);
      const currentTurn = fen.split(' ')[1] || 'w'; // 'w' or 'b'

      if (selectedSquare) {
        // Attempt to move to the clicked square
        const targetMove = legalMoves.find(move => move.to === square);
        if (targetMove) {
          const movingPiece = getPieceAtSquare(selectedSquare);
          if (!movingPiece) {
            console.warn(`No piece at selected square ${selectedSquare}`);
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }

          // Check for pawn promotion
          const isPawn = movingPiece.toLowerCase() === 'p';
          const isLastRank = 
            (movingPiece === movingPiece.toUpperCase() && square[1] === '8') || // White to 8th
            (movingPiece === movingPiece.toLowerCase() && square[1] === '1');   // Black to 1st

          if (isPawn && isLastRank) {
            console.log(`Promotion detected at ${square}`);
            setPromotionSquare(square);
            return;
          }

          console.log(`Moving from ${selectedSquare} to ${square}`);
          onMove(selectedSquare, square);
          setSelectedSquare(null);
          setLegalMoves([]);
          return;
        }
        // Deselect if not a legal move
        console.log(`Deselecting: ${square} not a legal move`);
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Select a piece if it's the player's turn
      if (!piece || piece === '.' || 
          (currentTurn === 'w' && piece !== piece.toUpperCase()) || 
          (currentTurn === 'b' && piece !== piece.toLowerCase())) {
        console.log(`Cannot select square ${square}: No piece or wrong turn`);
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      console.log(`Selecting piece at ${square}`);
      setSelectedSquare(square);
      const moves = getLegalMoves(square) || [];
      if (!Array.isArray(moves)) {
        console.error(`getLegalMoves returned invalid data:`, moves);
        setLegalMoves([]);
        return;
      }
      // Normalize moves to { to: 'square' } format
      const normalizedMoves = moves.map(move => 
        typeof move === 'string' ? { to: move } : move
      ).filter(move => move && move.to);
      setLegalMoves(normalizedMoves);
      console.log(`Legal moves for ${square}:`, normalizedMoves);
    } catch (error) {
      console.error(`Error in onSquareClick at ${square}:`, error);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [fen, getLegalMoves, selectedSquare, legalMoves, onMove]);

  // Handle piece drag and drop
  const onPieceDrop = (sourceSquare, targetSquare, piece) => {
    try {
      console.log(`Dropped ${piece} from ${sourceSquare} to ${targetSquare}`);
      const isPawn = piece.charAt(1).toLowerCase() === 'p';
      const isLastRank = 
        (piece[0] === 'w' && targetSquare[1] === '8') || 
        (piece[0] === 'b' && targetSquare[1] === '1');

      if (isPawn && isLastRank) {
        setPromotionSquare(targetSquare);
        return false; // Wait for promotion selection
      }

      const success = onMove(sourceSquare, targetSquare);
      setSelectedSquare(null);
      setLegalMoves([]);
      return success;
    } catch (error) {
      console.error('Error in onPieceDrop:', error);
      return false;
    }
  };

  // Handle promotion selection
  const onPromotionPieceSelect = (piece, fromSquare, toSquare) => {
    try {
      const promotion = piece ? piece.charAt(1).toLowerCase() : 'q'; // Default to queen
      console.log(`Promoting to ${promotion} from ${fromSquare} to ${toSquare}`);
      const success = onMove(fromSquare, toSquare, promotion);
      setPromotionSquare(null);
      setSelectedSquare(null);
      setLegalMoves([]);
      return success;
    } catch (error) {
      console.error('Error in onPromotionPieceSelect:', error);
      return false;
    }
  };

  // Custom styles for squares
  // Custom styles for squares
// Custom styles for squares
// Custom styles for squares
const customSquareStyles = {};

// Highlight last move
if (lastMove && Array.isArray(lastMove) && lastMove.length === 2) {
  customSquareStyles[lastMove[0]] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
  customSquareStyles[lastMove[1]] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
}

// Highlight selected square
if (selectedSquare) {
  customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(255, 215, 0, 0.4)' };
}

// Show legal move indicators
if (legalMoves.length > 0) {
  const pieceColor = fen.split(' ')[1] === 'w' ? 'white' : 'black';
  const dotColor = pieceColor === 'white' ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  const captureColor = 'rgba(128, 128, 128, 0.6)'; // Grey for capture moves

  legalMoves.forEach((move) => {
    if (!move.to) return;
    const targetPiece = getPieceAtSquare(move.to);
    customSquareStyles[move.to] = {
      background: targetPiece && targetPiece !== '.'
        ? `radial-gradient(circle at center, transparent 60%, transparent 60%, ${captureColor} 85%, ${captureColor} 85%, transparent 90%)`
        : `radial-gradient(circle, ${dotColor} 0%, ${dotColor} 20%, transparent 25%)`,
      cursor: 'pointer'
    };
  });
}

  return (
    <div className="w-full max-w-[400px] mx-auto">
      <ReactChessboard
        id="chess-board"
        position={fen}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        customSquareStyles={customSquareStyles}
        boardOrientation={orientation}
        promotionToSquare={promotionSquare}
        onPromotionPieceSelect={onPromotionPieceSelect}
        arePiecesDraggable={true}
        animationDuration={200}
        boardWidth={400}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
        }}
        customDarkSquareStyle={{ backgroundColor: '#4b7399' }}
        customLightSquareStyle={{ backgroundColor: '#e0e0e0' }}
      />
    </div>
  );
};

// Optional: Error Boundary Wrapper
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>
          <h2>Something went wrong with the chessboard.</h2>
          <p>{this.state.error.toString()}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default (props) => (
  <ErrorBoundary>
    <Chessboard {...props} />
  </ErrorBoundary>
);