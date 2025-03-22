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

// Endpoint for getting analysis updates - optimized for fast response times
app.get('/status/:fen', (req, res) => {
  try {
    const fen = req.params.fen;
    const minDepth = parseInt(req.query.minDepth || '1', 10);
    
    // Find the available analysis for this position (return immediately for speed)
    // First check if we have EXACTLY the requested depth or higher
    let exactResult = null;
    let bestResult = null;
    let deepestDepth = 0;
    
    // Fast path first: exact match on requested depth
    for (const [key, value] of analysisCache.entries()) {
      if (key.startsWith(fen) && value.depth === minDepth) {
        exactResult = value;
        break;
      }
    }
    
    // If we have an exact match, return it immediately for fastest response
    if (exactResult) {
      // Fast path - no need to process moves
      res.json(exactResult);
      return;
    }
    
    // Otherwise, find best available
    for (const [key, value] of analysisCache.entries()) {
      if (key.startsWith(fen) && value.depth >= minDepth && value.depth > deepestDepth) {
        bestResult = value;
        deepestDepth = value.depth;
      }
    }
    
    if (bestResult) {
      // If we have a result for this position, make sure SAN moves are filled in
      // but only process if necessary for speed
      if (bestResult.bestMoves && bestResult.bestMoves.length > 0 && 
          bestResult.bestMoves.some(move => move.uci && !move.san)) {
        const chess = new Chess(fen);
        bestResult.bestMoves = bestResult.bestMoves.map(move => {
          try {
            if (!move.uci || move.san) return move;
            
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
      
      res.json(bestResult);
    } else {
      res.status(404).json({ 
        error: 'No analysis found for this position',
        message: 'Try initiating analysis first'
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get analysis status' });
  }
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

// Global cache for storing analysis results
const analysisCache = new Map();

// Function to analyze a position with Stockfish, optimized for speed with incremental updates
function analyzePosition(fen, depth) {
  // Check if we have a cached result for this position at the requested depth
  const cacheKey = `${fen}_${depth}`;
  if (analysisCache.has(cacheKey)) {
    return Promise.resolve(analysisCache.get(cacheKey));
  }

  return new Promise((resolve, reject) => {
    // Spawn Stockfish process
    const stockfish = spawn('stockfish');
    
    let output = '';
    let bestMove = null;
    let evaluation = null;
    let pvLine = [];
    let currentDepth = 0;
    let lastUpdateTime = Date.now();
    
    // Even shorter timeout for chess.com-like speed
    const timeout = setTimeout(() => {
      stockfish.kill();
      reject(new Error('Analysis timed out'));
    }, 5000); // 5 seconds max for ultra-quick analysis
    
    // Process Stockfish output
    stockfish.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Only log brief output for performance
      if (text.includes('bestmove') || text.includes('depth')) {
        console.log(`Stockfish: ${text.trim().substring(0, 100)}...`);
      }
      
      // Extract current depth
      const depthMatch = text.match(/depth (\d+)/);
      if (depthMatch) {
        currentDepth = parseInt(depthMatch[1], 10);
      }
      
      // Extract evaluation - similar to how lichess/chess.com process Stockfish output
      if (text.includes('score cp')) {
        const match = text.match(/score cp (-?\d+)/);
        if (match) {
          let cp = parseInt(match[1], 10);
          
          // Small smoothing for tiny advantages
          if (Math.abs(cp) < 15) {
            cp = Math.sign(cp) * Math.floor(Math.abs(cp) * 0.85);
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
      
      // Get side to move from FEN
      const fenParts = fen.split(' ');
      const sideToMove = fenParts.length > 1 ? fenParts[1] : 'w';
      
      // Create evaluation string
      let evalString = '0.00';
      if (evaluation) {
        if (evaluation.type === 'cp') {
          // Convert centipawns to pawns with White's perspective
          let evalValue = evaluation.value / 100;
          
          // Invert for Black's perspective
          if (sideToMove === 'b') {
            evalValue = -evalValue;
          }
          
          evalString = evalValue.toFixed(2);
        } else if (evaluation.type === 'mate') {
          // Handle mate scores
          let mateValue = evaluation.value;
          
          // Invert mate score for Black
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
      let bestMoves = [];
      if (pvLine.length > 0) {
        // Take at most 3 moves from PV line
        const moveCount = Math.min(3, pvLine.length);
        for (let i = 0; i < moveCount; i++) {
          bestMoves.push({
            uci: pvLine[i],
            san: ''  // Will be converted later
          });
        }
      }
      
      // Generate intermediate results VERY frequently to speed up perceived analysis
      // Chess.com updates constantly to give a sense of progress
      const now = Date.now();
      if (
        (currentDepth > 0 && now - lastUpdateTime > 50) || // Update every 50ms for ultra-frequent feedback
        (bestMoves.length > 0 && currentDepth > 4) // Any progress with bestmoves is worth showing
      ) {
        // Create a snapshot of the current analysis
        const analysisSnapshot = {
          fen,
          depth: currentDepth,
          requested_depth: depth,
          evaluation: evalString,
          bestMoves,
          completed: false
        };
        
        // Store ALL intermediate results in cache for maximum progress visibility
        analysisCache.set(`${fen}_${currentDepth}`, analysisSnapshot);
        
        // Update timestamp for rate limiting
        lastUpdateTime = now;
        
        // Make results available faster (depth 4+ is good enough for initial display)
        if (currentDepth >= 4 && !analysisCache.has(cacheKey) && bestMoves.length > 0) {
          // Don't resolve yet, but make the result available
          analysisCache.set(cacheKey, analysisSnapshot);
        }
      }
      
      // Extract best move (final result)
      if (text.includes('bestmove')) {
        clearTimeout(timeout);
        
        const match = text.match(/bestmove (\w+)/);
        if (match) {
          bestMove = match[1];
          
          if (bestMoves.length === 0 && bestMove) {
            bestMoves.push({
              uci: bestMove,
              san: ''  // Will be converted later
            });
          }
          
          // Final analysis result
          const finalResult = {
            fen,
            depth: currentDepth, 
            requested_depth: depth,
            evaluation: evalString,
            bestMoves,
            completed: true
          };
          
          // Cache the final result
          analysisCache.set(cacheKey, finalResult);
          
          // Resolve with final analysis results
          resolve(finalResult);
          
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
    
    // Set position and start analysis with ultra-fast settings like chess.com
    stockfish.stdin.write("uci\n");
    
    // Configure Stockfish with MAXIMUM SPEED settings for ultra-fast analysis
    stockfish.stdin.write("setoption name Threads value 8\n"); // Increase to 8 for faster computation
    stockfish.stdin.write("setoption name Hash value 256\n"); // Increase hash table for better caching
    stockfish.stdin.write("setoption name MultiPV value 1\n"); // Only compute best line for speed
    
    // Extreme speed optimizations - chess.com style instant feedback
    stockfish.stdin.write("setoption name Minimum Thinking Time value 0\n"); // No minimum time
    stockfish.stdin.write("setoption name Move Overhead value 0\n"); // No move overhead for raw speed
    stockfish.stdin.write("setoption name Slow Mover value 10\n"); // Ultra-aggressive time usage (10 is extremely fast)
    
    // Keep evaluation consistent with chess.com/lichess
    stockfish.stdin.write("setoption name Contempt value 0\n"); // No contempt for unbiased eval
    
    // Maximum speed settings with quality trade-offs
    stockfish.stdin.write("setoption name Skill Level value 20\n"); // Full strength
    stockfish.stdin.write("setoption name UCI_Chess960 value false\n");
    stockfish.stdin.write("setoption name UCI_AnalyseMode value true\n");
    
    // Critical speed optimizations
    stockfish.stdin.write("setoption name Ponder value false\n");
    stockfish.stdin.write("setoption name Use NNUE value true\n"); // Neural network for faster eval
    stockfish.stdin.write("setoption name SyzygyProbeDepth value 0\n"); // Disable endgame tablebase probing
    stockfish.stdin.write("setoption name Syzygy50MoveRule value false\n"); // Skip 50-move calculations
    stockfish.stdin.write("setoption name nodestime value 0\n"); // Disable nodes time calculation
    
    // Use movetime instead of depth for faster results (chess.com strategy)
    const moveTime = 1000; // Reduce to 1 second for even faster results
    
    stockfish.stdin.write("isready\n");
    stockfish.stdin.write(`position fen ${fen}\n`);
    
    // For immediate feedback like chess.com:
    // 1. First get very fast shallow analysis (depth 8-12)
    // 2. Then continue with deeper analysis if time permits
    stockfish.stdin.write(`go depth 12 movetime ${moveTime}\n`);
  });
}

// Start the server
app.listen(port, () => {
  console.log(`Stockfish analysis service listening on port ${port}`);
});