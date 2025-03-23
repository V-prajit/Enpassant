const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const { Chess } = require("chess.js");
const os = require("os");

const app = express();
const port = 8080;

// Enable CORS
app.use(cors());
app.use(express.json());

// Create a pool of Stockfish processes - one per CPU core
const numCPUs = os.cpus().length;
console.log(`Server has ${numCPUs} CPU cores, creating Stockfish pool`);

const stockfishPool = [];
const busyProcesses = new Set();

// Initialize process pool
for (let i = 0; i < numCPUs; i++) {
  const stockfish = spawn("stockfish");
  
  // Configure process
  stockfish.stdin.write("uci\n");
  stockfish.stdin.write(`setoption name Threads value 1\n`); // Each process uses 1 thread
  stockfish.stdin.write(`setoption name Hash value ${Math.floor(4096 / numCPUs)}\n`); // Divide hash among processes
  stockfish.stdin.write("setoption name MultiPV value 1\n");
  stockfish.stdin.write("setoption name Minimum Thinking Time value 0\n");
  stockfish.stdin.write("setoption name Move Overhead value 0\n");
  stockfish.stdin.write("setoption name Slow Mover value 0\n"); // Maximum speed
  stockfish.stdin.write("setoption name Skill Level value 20\n");
  stockfish.stdin.write("setoption name Use NNUE value true\n");
  stockfish.stdin.write("isready\n");
  
  stockfishPool.push(stockfish);
  console.log(`Initialized Stockfish process ${i+1}`);
}

// In-memory cache
const analysisCache = new Map();

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).send("Stockfish Analysis API is running with process pool");
});

// Analysis endpoint
app.post("/", async (req, res) => {
  try {
    const { fen, depth = 20 } = req.body;
    
    if (!fen) {
      return res.status(400).json({ error: "FEN position is required" });
    }
    
    // Validate FEN
    try {
      new Chess(fen);
    } catch (error) {
      return res.status(400).json({ error: "Invalid FEN position" });
    }
    
    // Check cache first for exact depth match
    const cacheKey = `${fen}_${depth}`;
    if (analysisCache.has(cacheKey)) {
      console.log(`Cache hit for ${fen} at depth ${depth}`);
      return res.json(analysisCache.get(cacheKey));
    }
    
    // Look for any cached result with greater depth
    for (const [key, value] of analysisCache.entries()) {
      if (key.startsWith(fen + "_") && value.depth >= depth) {
        console.log(`Found deeper cache for ${fen} at depth ${value.depth}`);
        return res.json(value);
      }
    }
    
    console.log(`Analyzing position: ${fen} at depth ${depth}`);
    const analysis = await analyzePosition(fen, depth);
    console.log(`Analysis complete at depth ${analysis.depth}`);
    
    res.json(analysis);
  } catch (error) {
    console.error("Analysis error:", error);
    res.status(500).json({ error: "Analysis failed: " + error.message });
  }
});

// Get a free Stockfish process from the pool
function getStockfishProcess() {
  return new Promise((resolve) => {
    // Try to find an available process
    const checkForProcess = () => {
      for (const process of stockfishPool) {
        if (!busyProcesses.has(process)) {
          busyProcesses.add(process);
          return resolve(process);
        }
      }
      
      // All processes are busy, wait and try again
      setTimeout(checkForProcess, 50);
    };
    
    checkForProcess();
  });
}

// Release a process back to the pool
function releaseProcess(process) {
  process.stdin.write("stop\n"); // Stop any ongoing calculation
  process.stdin.write("ucinewgame\n"); // Reset the engine state
  process.stdin.write("isready\n"); // Make sure it's ready for next use
  busyProcesses.delete(process);
}

// Function to analyze a position with Stockfish - optimized version
function analyzePosition(fen, depth) {
  return new Promise(async (resolve, reject) => {
    try {
      // Get a free Stockfish process
      const stockfish = await getStockfishProcess();
      
      let output = "";
      let bestMove = null;
      let evaluation = null;
      let pvLine = [];
      let currentDepth = 0;
      
      // Set a maximum time limit - shorter is faster
      const timeoutDuration = Math.min(5000, depth * 250); // Scale with depth but cap at 5 seconds
      const timeout = setTimeout(() => {
        console.log(`Analysis timed out after ${timeoutDuration}ms`);
        stockfish.stdin.write("stop\n");
      }, timeoutDuration);
      
      // Handle new data from Stockfish
      const handleStockfishOutput = (data) => {
        const text = data.toString();
        output += text;
        
        // Extract current depth
        const depthMatch = text.match(/depth (\d+)/);
        if (depthMatch) {
          currentDepth = parseInt(depthMatch[1], 10);
        }
        
        // Extract evaluation
        if (text.includes("score cp")) {
          const match = text.match(/score cp (-?\d+)/);
          if (match) {
            let cp = parseInt(match[1], 10);
            evaluation = {
              type: "cp",
              value: cp
            };
          }
        } else if (text.includes("score mate")) {
          const match = text.match(/score mate (-?\d+)/);
          if (match) {
            const moves = parseInt(match[1], 10);
            evaluation = {
              type: "mate",
              value: moves
            };
          }
        }
        
        // Extract principal variation (PV)
        if (text.includes(" pv ")) {
          const pvMatch = text.match(/ pv (.*?)(?=\n|$)/);
          if (pvMatch) {
            pvLine = pvMatch[1].trim().split(" ");
          }
        }
        
        // Extract best move (final result)
        if (text.includes("bestmove")) {
          clearTimeout(timeout);
          
          const match = text.match(/bestmove (\w+)/);
          if (match) {
            bestMove = match[1];
            
            // Get side to move from FEN
            const fenParts = fen.split(" ");
            const sideToMove = fenParts.length > 1 ? fenParts[1] : "w";
            
            // Create evaluation string
            let evalString = "0.00";
            if (evaluation) {
              if (evaluation.type === "cp") {
                // Convert centipawns to pawns with White's perspective
                let evalValue = evaluation.value / 100;
                
                // Invert for Black's perspective
                if (sideToMove === "b") {
                  evalValue = -evalValue;
                }
                
                evalString = evalValue.toFixed(2);
              } else if (evaluation.type === "mate") {
                // Handle mate scores
                let mateValue = evaluation.value;
                
                // Invert mate score for Black
                if (sideToMove === "b") {
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
            
            // Format best moves with SAN notation
            let bestMoves = [];
            if (pvLine.length > 0) {
              const chess = new Chess(fen);
              const moveCount = Math.min(5, pvLine.length);
              
              for (let i = 0; i < moveCount; i++) {
                try {
                  const uci = pvLine[i];
                  const from = uci.substring(0, 2);
                  const to = uci.substring(2, 4);
                  const promotion = uci.length > 4 ? uci[4] : undefined;
                  
                  const sanMove = chess.move({
                    from,
                    to,
                    promotion
                  });
                  
                  bestMoves.push({
                    uci: uci,
                    san: sanMove ? sanMove.san : ""
                  });
                } catch (error) {
                  break;
                }
              }
              
              chess.load(fen);
            }
            
            if (bestMoves.length === 0 && bestMove) {
              bestMoves.push({
                uci: bestMove,
                san: ""
              });
            }
            
            // Final analysis result
            const finalResult = {
              fen,
              depth: currentDepth,
              requested_depth: depth,
              evaluation: evalString,
              bestMoves,
              timestamp: Date.now(),
              completed: true
            };
            
            // Cache the result
            const cacheKey = `${fen}_${currentDepth}`;
            analysisCache.set(cacheKey, finalResult);
            
            // Limit cache size
            if (analysisCache.size > 1000) {
              const oldestKey = Array.from(analysisCache.keys())[0];
              analysisCache.delete(oldestKey);
            }
            
            // Release the process back to the pool
            releaseProcess(stockfish);
            
            resolve(finalResult);
          }
        }
      };
      
      // Set up event handlers
      stockfish.stdout.on("data", handleStockfishOutput);
      
      stockfish.on("error", (error) => {
        clearTimeout(timeout);
        releaseProcess(stockfish);
        reject(error);
      });
      
      // Send commands to Stockfish - use movetime to enforce faster responses
      stockfish.stdin.write(`position fen ${fen}\n`);
      
      // Tune these parameters for best speed/quality balance
      const moveTime = Math.min(2000, depth * 100); // 100ms per depth, max 2 seconds
      stockfish.stdin.write(`go depth ${depth} movetime ${moveTime}\n`);
      
    } catch (error) {
      reject(error);
    }
  });
}

// Status endpoint
app.get("/status/:fen", async (req, res) => {
  try {
    const fen = req.params.fen;
    const minDepth = parseInt(req.query.minDepth || "1", 10);
    
    // Check cache first
    for (const [key, value] of analysisCache.entries()) {
      if (key.startsWith(fen + "_") && value.depth >= minDepth) {
        console.log(`Cache hit for status: ${fen} at depth ${value.depth}`);
        return res.json(value);
      }
    }
    
    // Not found in cache, perform a quick analysis
    console.log(`Analyzing position for status: ${fen} at min depth ${minDepth}`);
    
    // For status endpoint, use a lower depth limit to be faster
    const quickDepth = Math.min(minDepth, 15); // Cap at depth 15 for speed
    const analysis = await analyzePosition(fen, quickDepth);
    
    res.json(analysis);
  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({ error: "Failed to get analysis status" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Optimized Stockfish analysis service running on port ${port} with ${numCPUs} processes`);
});