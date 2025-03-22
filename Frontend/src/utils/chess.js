// This will hold utility functions for chess operations and Stockfish integration
// For Milestone 1, we'll just include some helper functions

/**
 * Converts a UCI move (e.g., "e2e4") to SAN format (e.g., "e4")
 * @param {string} uciMove - Move in UCI format
 * @param {object} chess - Chess.js instance
 * @return {string} Move in SAN format
 */
export const uciToSan = (uciMove, chess) => {
    if (!uciMove || uciMove.length < 4) return '';
    
    const from = uciMove.substring(0, 2);
    const to = uciMove.substring(2, 4);
    const promotion = uciMove.length > 4 ? uciMove[4] : undefined;
    
    try {
      const move = chess.move({
        from,
        to,
        promotion
      });
      
      // Undo the move to keep the chess instance unchanged
      chess.undo();
      
      return move ? move.san : '';
    } catch (error) {
      console.error('Invalid UCI move:', error);
      return '';
    }
  };
  
  /**
   * Converts a SAN move (e.g., "e4") to UCI format (e.g., "e2e4")
   * @param {string} sanMove - Move in SAN format
   * @param {object} chess - Chess.js instance
   * @return {string} Move in UCI format
   */
  export const sanToUci = (sanMove, chess) => {
    try {
      const move = chess.move(sanMove);
      
      // Undo the move to keep the chess instance unchanged
      chess.undo();
      
      if (move) {
        return `${move.from}${move.to}${move.promotion || ''}`;
      }
      return '';
    } catch (error) {
      console.error('Invalid SAN move:', error);
      return '';
    }
  };
  
  /**
   * Get FEN string with only the position part (remove move counters, castling, etc.)
   * @param {string} fullFen - Complete FEN string
   * @return {string} Position-only FEN
   */
  export const getPositionFen = (fullFen) => {
    if (!fullFen) return '';
    
    // Extract just the board position and active color
    const parts = fullFen.split(' ');
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[1]}`;
    }
    
    return fullFen;
  };
  
  // This will be implemented in Milestone 2 - Stockfish Integration
  export const initializeStockfish = () => {
    console.log('Stockfish will be initialized here in Milestone 2');
    // Will return a Stockfish worker instance
    return null;
  };
  
  // This will be implemented in Milestone 2 - Stockfish Integration
  export const analyzePosition = (stockfish, fen, depth = 15) => {
    console.log('Position analysis will be implemented here in Milestone 2');
    // Will return a promise that resolves with analysis results
    return Promise.resolve({
      score: { value: 0, type: 'cp' },
      bestMove: null,
      pv: []
    });
  };