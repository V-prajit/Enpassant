import React, { useState, useCallback } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';

const Chessboard = ({ 
  fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  lastMove,
  onMove = () => {},
  orientation = 'white',
  getLegalMoves = () => []
}) => {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalMoves, setLegalMoves] = useState([]);
  const [promotionSquare, setPromotionSquare] = useState(null);

  // Helper to convert square -> index in the FEN representation
  const squareToIndex = (square) => {
    try {
      const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
      const rank = 8 - parseInt(square[1], 10);
      return rank * 8 + file;
    } catch (error) {
      console.error(`Invalid square format: ${square}`, error);
      return -1;
    }
  };

  // Get piece at a given square from the current FEN
  const getPieceAtSquare = (square) => {
    try {
      const boardString = fen
        .split(' ')[0] // only the piece placement part
        .split('/')
        .map(row => row.replace(/\d/g, match => '.'.repeat(parseInt(match, 10))))
        .join('');
      const index = squareToIndex(square);
      return boardString[index] || '.';
    } catch (error) {
      console.error(`Error parsing FEN for square ${square}:`, error);
      return '.';
    }
  };

  // Handle square click (selection/move/promotion)
  const onSquareClick = useCallback((square) => {
    try {
      const piece = getPieceAtSquare(square);
      const currentTurn = fen.split(' ')[1] || 'w'; // "w" or "b"

      // If we already selected a square, this means we're trying to move
      if (selectedSquare) {
        const targetMove = legalMoves.find(m => m.to === square);
        if (targetMove) {
          const movingPiece = getPieceAtSquare(selectedSquare);
          if (!movingPiece || movingPiece === '.') {
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }
          // Check for promotion
          const isPawn = movingPiece.toLowerCase() === 'p';
          const isLastRank = (
            // White pawn going to 8th rank
            (movingPiece === movingPiece.toUpperCase() && square[1] === '8') ||
            // Black pawn going to 1st rank
            (movingPiece === movingPiece.toLowerCase() && square[1] === '1')
          );
          if (isPawn && isLastRank) {
            // Show promotion UI
            setPromotionSquare(square);
            return;
          }

          // Otherwise, just move
          onMove(selectedSquare, square);
        }
        // Deselect afterwards (either we moved or the move wasn’t legal)
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // No square previously selected: attempt to select if it’s a valid piece
      if (
        !piece ||
        piece === '.' ||
        (currentTurn === 'w' && piece !== piece.toUpperCase()) ||
        (currentTurn === 'b' && piece !== piece.toLowerCase())
      ) {
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }

      // Select this piece; load legal moves
      setSelectedSquare(square);
      const moves = getLegalMoves(square) || [];
      const normalized = moves.map(m => 
        typeof m === 'string' ? { to: m } : m
      ).filter(m => m && m.to);
      setLegalMoves(normalized);
    } catch (error) {
      console.error(`Error in onSquareClick at ${square}:`, error);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  }, [fen, selectedSquare, legalMoves, onMove, getLegalMoves]);

  // Handle piece drag
  const onPieceDrop = (sourceSquare, targetSquare, piece) => {
    try {
      const isPawn = piece.charAt(1).toLowerCase() === 'p';
      const isLastRank = (
        (piece[0] === 'w' && targetSquare[1] === '8') ||
        (piece[0] === 'b' && targetSquare[1] === '1')
      );
      if (isPawn && isLastRank) {
        setPromotionSquare(targetSquare);
        return false; 
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

  // Called after user selects which piece to promote to
  const onPromotionPieceSelect = (piece, fromSquare, toSquare) => {
    try {
      const promotion = piece ? piece.charAt(1).toLowerCase() : 'q';
      onMove(fromSquare, toSquare, promotion);
    } catch (error) {
      console.error('Error in onPromotionPieceSelect:', error);
    } finally {
      setPromotionSquare(null);
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  // Square styling
  const customSquareStyles = {};

  // Highlight last move if available
  if (lastMove && Array.isArray(lastMove) && lastMove.length === 2) {
    customSquareStyles[lastMove[0]] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
    customSquareStyles[lastMove[1]] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
  }

  // Highlight the currently selected square
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(255, 215, 0, 0.4)' };
  }

  // Style legal moves
  // On captures, show a hollow gray circle; on regular squares, a dot
  if (legalMoves.length > 0) {
    legalMoves.forEach((move) => {
      if (!move.to) return;
      const targetPiece = getPieceAtSquare(move.to);
      if (targetPiece && targetPiece !== '.') {
        // capturing square => hollow grey circle
        customSquareStyles[move.to] = {
          background: 'radial-gradient(circle, transparent 55%, gray 60%, transparent 65%)',
          cursor: 'pointer',
        };
      } else {
        // normal move => dot
        customSquareStyles[move.to] = {
          background: 'radial-gradient(circle, rgba(0,0,0,.4) 20%, transparent 20%)',
          cursor: 'pointer',
        };
      }
    });
  }

  return (
    <div className="w-full max-w-[450px] mx-auto">
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
        boardWidth={450}
        customBoardStyle={{
          borderRadius: '6px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
        }}
        customDarkSquareStyle={{ backgroundColor: '#4b7399' }}
        customLightSquareStyle={{ backgroundColor: '#e0e0e0' }}
      />
    </div>
  );
};

export default Chessboard;
