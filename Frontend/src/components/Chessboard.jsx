// src/components/Chessboard.jsx
import React, { useState, useCallback } from 'react';
import { Chessboard as ReactChessboard } from 'react-chessboard';

const Chessboard = ({ 
  fen, 
  lastMove, 
  onMove, 
  orientation = 'white',
  getLegalMoves
}) => {
  const [promotionSquare, setPromotionSquare] = useState(null);
  
  // Handle piece drop (move)
  const onPieceDrop = (sourceSquare, targetSquare, piece) => {
    console.log(`Dropping piece ${piece} from ${sourceSquare} to ${targetSquare}`);
    
    // Check if this is a pawn promotion move
    const isPawn = piece.charAt(1).toLowerCase() === 'p';
    const isLastRank = 
      (piece.charAt(0) === 'w' && targetSquare.charAt(1) === '8') ||
      (piece.charAt(0) === 'b' && targetSquare.charAt(1) === '1');
    
    if (isPawn && isLastRank) {
      console.log("This is a promotion move");
      setPromotionSquare(targetSquare);
      return false; // Don't complete the move yet
    }
    
    // Regular move
    return onMove(sourceSquare, targetSquare);
  };
  
  // Handle promotion piece selection
  const onPromotionPieceSelect = (promotedTo, fromSquare, toSquare) => {
    console.log(`Promotion piece: ${promotedTo}, From: ${fromSquare}, To: ${toSquare}`);
    
    // Convert piece type to lowercase (e.g., 'q', 'r', 'n', 'b')
    const promotionPiece = promotedTo.charAt(1).toLowerCase();
    
    // Execute the move with the promotion piece
    const result = onMove(fromSquare, toSquare, promotionPiece);
    
    // Clear promotion state
    setPromotionSquare(null);
    
    return result;
  };
  
  // Create styles for highlighted squares
  const highlightStyles = {};
  if (lastMove && lastMove.length === 2) {
    highlightStyles[lastMove[0]] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
    highlightStyles[lastMove[1]] = { backgroundColor: 'rgba(155, 199, 0, 0.41)' };
  }

  return (
    <div className="chessboard-container" style={{ width: '500px', height: '500px', position: 'relative' }}>
      <ReactChessboard
        id="chess-board"
        animationDuration={200}
        arePiecesDraggable={true}
        position={fen}
        onPieceDrop={onPieceDrop}
        customSquareStyles={highlightStyles}
        boardOrientation={orientation}
        promotionToSquare={promotionSquare}
        onPromotionPieceSelect={onPromotionPieceSelect}
        boardWidth={500}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
        }}
      />
    </div>
  );
};

export default Chessboard;