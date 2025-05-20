import { useState, useEffect, useCallback } from 'react';
import { Chess } from 'chess.js';
import { devLog, devError } from '../utils/logger';

const useChessGame = (initialFen = 'start') => {
    const [chess, setChess] = useState(new Chess());
    const [fen, setFen] = useState('');
    const [history, setHistory] = useState([]);
    const [lastMove, setLastMove] = useState(null);

    const initGame = useCallback((newFen = initialFen) => {
        const newChess = new Chess(newFen === 'start' ? undefined : newFen);
        setChess(newChess);
        setFen(newChess.fen());
        setHistory(newChess.history({ verbose: true }));
        setLastMove(null);
    }, [initialFen]);

    const makeMove = useCallback((from, to, promotion) => {
        try {
            devLog("Making move in chess.js:", { from, to, promotion });
            
            // Prepare move object
            const moveObj = { from, to };
            
            // Add promotion if provided
            if (promotion) {
                moveObj.promotion = promotion.toLowerCase();
            }
            
            devLog("Chess move object:", moveObj);
            
            // Make the move
            const move = chess.move(moveObj);
            
            if (move) {
                devLog("Move successful:", move);
                setFen(chess.fen());
                setHistory(chess.history({ verbose: true }));
                setLastMove([from, to]);
                return true;
            }
            
            devLog("Move rejected by chess.js");
            return false;
        } catch (error) {
            devError("Invalid move:", error);
            return false;
        }
    }, [chess]);

    // Play a move by SAN notation
    const playMove = useCallback((san) => {
        try {
            const move = chess.move(san);
            if (move) {
                setFen(chess.fen());
                setHistory(chess.history({ verbose: true }));
                setLastMove([move.from, move.to]);
                return true;
            }
            return false;
        } catch (error) {
            devError("Invalid SAN move:", error);
            return false;
        }
    }, [chess]);

    const undoMove = useCallback(() => {
        const move = chess.undo();
        if (move) {
          setFen(chess.fen());
          const newHistory = chess.history({ verbose: true });
          setHistory(newHistory);
          setLastMove(newHistory.length > 0 
            ? [newHistory[newHistory.length - 1].from, newHistory[newHistory.length - 1].to]
            : null);
          return true;
        }
        return false;
      }, [chess]);

      const getLegalMoves = useCallback((square) => {
        const moves = chess.moves({
          square,
          verbose: true
        });
        return moves.map(move => move.to);
      }, [chess]);

      useEffect(() => {
        initGame();
      }, [initGame]);

      return {
        chess,
        fen,
        history,
        lastMove,
        makeMove,
        playMove,
        undoMove,
        initGame,
        getLegalMoves,
        isCheck: chess.isCheck(),
        isCheckmate: chess.isCheckmate(),
        isDraw: chess.isDraw(),
        turn: chess.turn()
    };  
};

export default useChessGame;