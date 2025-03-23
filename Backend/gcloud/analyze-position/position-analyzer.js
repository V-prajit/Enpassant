// Backend/gcloud/analyze-position/position-analyzer.js
const { Chess } = require('chess.js');

// Analyze a chess position and extract key features
function analyzePosition(fen) {
  try {
    const chess = new Chess(fen);
    
    // Extract basic position info
    const positionInfo = {
      turn: chess.turn() === 'w' ? 'White' : 'Black',
      inCheck: chess.isCheck(),
      inCheckmate: chess.isCheckmate(),
      inStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      halfMoves: chess.halfMoves(),
      fullMoves: chess.moveNumber(),
      material: calculateMaterial(chess),
      pieces: countPieces(chess),
      controlledSquares: analyzeSquareControl(chess),
    };
    
    return positionInfo;
  } catch (error) {
    console.error('Error analyzing position:', error);
    return { error: 'Failed to analyze position' };
  }
}

// Calculate material balance
function calculateMaterial(chess) {
  const pieceValues = {
    p: 1,  // pawn
    n: 3,  // knight
    b: 3,  // bishop
    r: 5,  // rook
    q: 9,  // queen
    k: 0   // king (not counted in material)
  };
  
  let whiteMaterial = 0;
  let blackMaterial = 0;
  
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const value = pieceValues[piece.type.toLowerCase()];
        if (piece.color === 'w') {
          whiteMaterial += value;
        } else {
          blackMaterial += value;
        }
      }
    }
  }
  
  return {
    white: whiteMaterial,
    black: blackMaterial,
    advantage: whiteMaterial - blackMaterial
  };
}

// Count pieces for each side
function countPieces(chess) {
  const counts = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0, total: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0, k: 0, total: 0 }
  };
  
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const side = piece.color === 'w' ? 'white' : 'black';
        counts[side][piece.type] += 1;
        counts[side].total += 1;
      }
    }
  }
  
  return counts;
}

// Analyze square control (simplified)
function analyzeSquareControl(chess) {
  // Save original turn
  const originalTurn = chess.turn();
  
  // Count controlled squares for each side
  let whiteControls = 0;
  let blackControls = 0;
  
  // Check white's controlled squares
  chess.turn = () => 'w';
  const whiteMoves = chess.moves({ verbose: true });
  whiteMoves.forEach(move => {
    whiteControls++;
  });
  
  // Check black's controlled squares
  chess.turn = () => 'b';
  const blackMoves = chess.moves({ verbose: true });
  blackMoves.forEach(move => {
    blackControls++;
  });
  
  // Restore original turn
  chess.turn = () => originalTurn;
  
  return {
    white: whiteControls,
    black: blackControls,
    advantage: whiteControls - blackControls
  };
}

// Create a detailed description of the position for Gemini
function createPositionDescription(fen) {
  const analysis = analyzePosition(fen);
  
  if (analysis.error) {
    return `FEN: ${fen}\nError analyzing position: ${analysis.error}`;
  }
  
  const materialAdvantage = analysis.material.advantage;
  let materialDescription;
  
  if (materialAdvantage > 0) {
    materialDescription = `White has a material advantage of ${materialAdvantage} points.`;
  } else if (materialAdvantage < 0) {
    materialDescription = `Black has a material advantage of ${Math.abs(materialAdvantage)} points.`;
  } else {
    materialDescription = "Material is equal.";
  }
  
  return `
  FEN: ${fen}
  
  Position Details:
  - ${analysis.turn} to move
  - ${analysis.inCheck ? 'King is in check' : 'No check'}
  - ${analysis.inCheckmate ? 'Checkmate' : analysis.inStalemate ? 'Stalemate' : analysis.isDraw ? 'Draw' : 'Game in progress'}
  - ${materialDescription}
  - White pieces: ${Object.entries(analysis.pieces.white).filter(([k,v]) => k !== 'total' && v > 0).map(([p,c]) => `${c} ${pieceToName(p)}`).join(', ')}
  - Black pieces: ${Object.entries(analysis.pieces.black).filter(([k,v]) => k !== 'total' && v > 0).map(([p,c]) => `${c} ${pieceToName(p)}`).join(', ')}
  `;
}

// Helper to convert piece letter to name
function pieceToName(piece) {
  const names = {
    p: 'pawns',
    n: 'knights',
    b: 'bishops',
    r: 'rooks',
    q: 'queens',
    k: 'kings'
  };
  return names[piece] || piece;
}

module.exports = {
  analyzePosition,
  createPositionDescription
};