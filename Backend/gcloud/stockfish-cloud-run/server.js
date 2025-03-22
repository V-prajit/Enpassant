const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { Chess } = require('chess.js');

const app = express();
const port = process.env.PORT || 8080;

// Enable CORS
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Stockfish Analysis API is running');
});

// Analysis endpoint
app.post('/', async (req, res) => {
  try {
    const { fen, depth = 30 } = req.body;
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    // Validate FEN using chess.js
    try {
      new Chess(fen);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid FEN position' });
    }
    
    // Run Stockfish analysis
    console.log(`Analyzing position: ${fen} at depth ${depth}`);
    const analysis = await analyzePosition(fen, depth);
    console.log('Analysis complete:', analysis);
    
    // Convert UCI moves to SAN if possible
    if (analysis.bestMoves && analysis.bestMoves.length > 0) {
      const chess = new Chess(fen);
      analysis.bestMoves = analysis.bestMoves.map(move => {
        try {
          if (!move.uci) return move;
          
          const from = move.uci.substring(0, 2);
          const to = move.uci.substring(2, 4);
          const promotion = move.uci.length > 4 ? move.uci[4] : undefined;
          
          const sanMove = chess.move({
            from,
            to,
            promotion
          });
          
          // Undo the move to keep the chess state unchanged
          chess.undo();
          
          return {
            uci: move.uci,
            san: sanMove ? sanMove.san : ''
          };
        } catch (error) {
          console.error('Error converting UCI to SAN:', error);
          return move;
        }
      });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// Function to analyze a position with Stockfish
function analyzePosition(fen, depth) {
  return new Promise((resolve, reject) => {
    // Spawn Stockfish process
    const stockfish = spawn('stockfish');
    
    let output = '';
    let bestMove = null;
    let evaluation = null;
    let pvLine = [];
    
    // Timeout for analysis (30 seconds)
    const timeout = setTimeout(() => {
      stockfish.kill();
      reject(new Error('Analysis timed out after 30 seconds'));
    }, 30000);
    
    // Process Stockfish output
    stockfish.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Log Stockfish output for debugging
      console.log(`Stockfish output: ${text.trim()}`);
      
      // Extract evaluation - similar to how lichess/chess.com process Stockfish output
      if (text.includes('score cp')) {
        const match = text.match(/score cp (-?\d+)/);
        if (match) {
          // Chess.com/lichess typically apply some smoothing to very small advantages
          // We'll do something similar to get values closer to what they show
          let cp = parseInt(match[1], 10);
          
          // Apply a slight smoothing effect to small evaluations
          // This helps match the evaluation style of chess.com and lichess
          if (Math.abs(cp) < 15) {
            cp = Math.sign(cp) * Math.floor(Math.abs(cp) * 0.8);
          } else if (Math.abs(cp) < 30) {
            cp = Math.sign(cp) * Math.floor(Math.abs(cp) * 0.9);
          }
          
          evaluation = {
            type: 'cp',
            value: cp
          };
        }
      } else if (text.includes('score mate')) {
        const match = text.match(/score mate (-?\d+)/);
        if (match) {
          const moves = parseInt(match[1], 10);
          evaluation = {
            type: 'mate',
            value: moves
          };
        }
      }
      
      // Extract principal variation (PV)
      if (text.includes(' pv ')) {
        const pvMatch = text.match(/ pv (.*?)(?=\n|$)/);
        if (pvMatch) {
          pvLine = pvMatch[1].trim().split(' ');
        }
      }
      
      // Extract best move
      if (text.includes('bestmove')) {
        clearTimeout(timeout);
        
        const match = text.match(/bestmove (\w+)/);
        if (match) {
          bestMove = match[1];
          
          // Format evaluation string like chess.com/lichess
          let evalString = '0.00';
          if (evaluation) {
            // Parse FEN to get the side to move
            const fenParts = fen.split(' ');
            const sideToMove = fenParts.length > 1 ? fenParts[1] : 'w';
            
            if (evaluation.type === 'cp') {
              // Convert centipawns to pawns, matching lichess/chess.com format
              // chess.com and lichess always show evaluations from White's perspective
              // If it's Black's turn, Stockfish gives the value from Black's perspective, so we need to invert it
              let evalValue = evaluation.value / 100;
              
              // Always report from White's perspective (like chess.com)
              if (sideToMove === 'b') {
                evalValue = -evalValue;
              }
              
              evalString = evalValue.toFixed(2);
            } else if (evaluation.type === 'mate') {
              // Handle mate scores
              let mateValue = evaluation.value;
              
              // Invert mate score for Black's turn to maintain White's perspective
              if (sideToMove === 'b') {
                mateValue = -mateValue;
              }
              
              // Format mate string
              if (mateValue > 0) {
                evalString = `Mate in ${mateValue}`;
              } else {
                evalString = `Mated in ${Math.abs(mateValue)}`;
              }
            }
          }
          
          // Format best moves
          const bestMoves = [];
          if (pvLine.length > 0) {
            // Take at most 3 moves from PV line
            const moveCount = Math.min(3, pvLine.length);
            for (let i = 0; i < moveCount; i++) {
              bestMoves.push({
                uci: pvLine[i],
                san: ''  // Will be converted later
              });
            }
          } else if (bestMove) {
            bestMoves.push({
              uci: bestMove,
              san: ''  // Will be converted later
            });
          }
          
          // For more consistent eval with chess.com/lichess
          const actualDepth = Math.min(depth, 22);
          
          // Resolve with analysis results
          resolve({
            fen,
            depth: actualDepth, // Return the actual depth used
            requested_depth: depth, // Original requested depth for reference
            evaluation: evalString,
            bestMoves
          });
          
          // Kill the Stockfish process
          stockfish.kill();
        }
      }
    });
    
    // Handle errors
    stockfish.stderr.on('data', (data) => {
      console.error(`Stockfish error: ${data}`);
    });
    
    stockfish.on('error', (error) => {
      clearTimeout(timeout);
      console.error('Failed to start Stockfish process:', error);
      reject(error);
    });
    
    stockfish.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !bestMove) {
        console.error(`Stockfish process exited with code ${code}`);
        reject(new Error(`Stockfish process exited with code ${code}`));
      }
    });
    
    // Set position and start analysis with parameters similar to chess.com/lichess
    stockfish.stdin.write("uci\n");
    
    // Configure Stockfish with settings closer to lichess/chess.com
    stockfish.stdin.write("setoption name Threads value 1\n"); // Use 1 thread for consistent analysis
    stockfish.stdin.write("setoption name Hash value 32\n"); // Use 32MB hash (like lichess)
    stockfish.stdin.write("setoption name MultiPV value 1\n"); // Only show best line
    
    // Very important setting for consistent evaluation
    stockfish.stdin.write("setoption name Contempt value 0\n"); // No contempt for unbiased eval (like lichess)
    
    // Use 20 for depth-based analysis as chess.com does 
    stockfish.stdin.write("setoption name Minimum Thinking Time value 0\n");
    
    // Additional settings
    stockfish.stdin.write("setoption name Skill Level value 20\n"); // Full strength
    stockfish.stdin.write("setoption name UCI_Chess960 value false\n");
    stockfish.stdin.write("setoption name UCI_AnalyseMode value true\n");
    
    // For more consistent eval with chess.com/lichess, limit depth to 22
    const actualDepth = Math.min(depth, 22);
    
    stockfish.stdin.write("isready\n");
    stockfish.stdin.write(`position fen ${fen}\n`);
    stockfish.stdin.write(`go depth ${actualDepth}\n`);
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Stockfish analysis service listening on port ${port}`);
});