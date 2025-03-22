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
    const { fen, depth = 15 } = req.body;
    
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
      
      // Extract evaluation
      if (text.includes('score cp')) {
        const match = text.match(/score cp (-?\d+)/);
        if (match) {
          const cp = parseInt(match[1], 10);
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
          
          // Format evaluation string
          let evalString = '0.00';
          if (evaluation) {
            if (evaluation.type === 'cp') {
              evalString = (evaluation.value / 100).toFixed(2);
            } else if (evaluation.type === 'mate') {
              evalString = `Mate in ${Math.abs(evaluation.value)}`;
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
          
          // Resolve with analysis results
          resolve({
            fen,
            depth,
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
    
    // Set position and start analysis
    stockfish.stdin.write("uci\n");
    stockfish.stdin.write("isready\n");
    stockfish.stdin.write(`position fen ${fen}\n`);
    stockfish.stdin.write(`go depth ${depth}\n`);
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Stockfish analysis service listening on port ${port}`);
});