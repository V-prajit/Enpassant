const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const { Chess } = require('chess.js');
const { Storage } = require('@google-cloud/storage');

const app = express();
const port = process.env.PORT || 8080;

// Set up Google Cloud Storage
const storage = new Storage();
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'tidal-hack25tex-223';
const BUCKET_NAME = `${PROJECT_ID}-chess-analysis`;

// Initialize storage bucket
const bucket = storage.bucket(BUCKET_NAME);

// Use memory cache for performance
const fs = require('fs');
const path = require('path');

// Also maintain a local cache for performance during single container lifetime
const LOCAL_CACHE_DIR = path.join(__dirname, 'tmp-cache');
if (!fs.existsSync(LOCAL_CACHE_DIR)) {
  fs.mkdirSync(LOCAL_CACHE_DIR, { recursive: true });
}

// Enable CORS
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('Stockfish Analysis API is running');
});

// Endpoint for getting analysis updates - optimized for fast response times
app.get('/status/:fen', async (req, res) => {
  try {
    const fen = req.params.fen;
    const minDepth = parseInt(req.query.minDepth || '1', 10);
    
    // First check the in-memory cache for fastest response
    let exactResult = null;
    let bestResult = null;
    let deepestDepth = 0;
    
    // Fast path: check in-memory cache first
    for (const [key, value] of analysisCache.entries()) {
      // Extract the FEN part from cache key (before any underscore)
      const keyFen = key.split('_')[0];
      
      if (keyFen === fen && value.depth >= minDepth) {
        if (value.depth === minDepth) {
          exactResult = value;
          break;
        } else if (value.depth > deepestDepth) {
          bestResult = value;
          deepestDepth = value.depth;
        }
      }
    }
    
    // If we have an exact match, return it immediately
    if (exactResult) {
      res.json(exactResult);
      return;
    }
    
    // We've already checked for best result in our first loop
    // This is now redundant since we're already finding the best result above
    
    // If we found a suitable result in memory, use it
    if (bestResult) {
      ensureMovesHaveSan(bestResult, fen);
      res.json(bestResult);
      return;
    }
    
    // If not in memory, check Cloud Storage
    console.log(`Checking Cloud Storage for position: ${fen} at depth >= ${minDepth}`);
    
    const fenHash = hashFen(fen); // Create a consistent hash for the FEN
    
    try {
      // List all files with this prefix in the analysis folder
      const [files] = await bucket.getFiles({ prefix: `analysis/${fenHash}` });
      
      let bestStorageResult = null;
      let bestStorageDepth = 0;
      
      // Find the best matching analysis file
      for (const file of files) {
        const filename = path.basename(file.name);
        const depthMatch = filename.match(/_(\d+)\.json$/);
        
        if (depthMatch) {
          const depth = parseInt(depthMatch[1], 10);
          
          if (depth >= minDepth && depth > bestStorageDepth) {
            // Download and parse the file
            const [content] = await file.download();
            const analysisData = JSON.parse(content.toString());
            
            bestStorageResult = analysisData;
            bestStorageDepth = depth;
          }
        }
      }
      
      if (bestStorageResult) {
        // Save to local cache
        try {
          const localPath = path.join(LOCAL_CACHE_DIR, `${fenHash}_${bestStorageDepth}.json`);
          fs.writeFileSync(localPath, JSON.stringify(bestStorageResult, null, 2));
        } catch (writeError) {
          console.warn('Error writing to local cache:', writeError);
        }
        
        // Add to memory cache for future requests - use FEN as the primary key
        const cacheKey = `${fen}_${bestStorageResult.depth}`;
        analysisCache.set(cacheKey, bestStorageResult);
        
        ensureMovesHaveSan(bestStorageResult, fen);
        return res.json(bestStorageResult);
      }
    } catch (storageError) {
      console.error('Error accessing Cloud Storage:', storageError);
    }
    
    // Nothing found
    res.status(404).json({ 
      error: 'No analysis found for this position',
      message: 'Try initiating analysis first'
    });
  
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to get analysis status' });
  }
});

// Endpoint for popular openings
app.get('/popular-openings', async (req, res) => {
  try {
    const openings = [];
    
    // Try to get openings from Cloud Storage
    try {
      // List files in the openings directory
      const [files] = await bucket.getFiles({ prefix: OPENINGS_PREFIX });
      
      for (const file of files) {
        try {
          // Download and parse the file
          const [content] = await file.download();
          const opening = JSON.parse(content.toString());
          
          openings.push({
            id: path.basename(file.name, '.json'),
            name: opening.name,
            fen: opening.fen,
            eco: opening.eco,
            moves: opening.moves
          });
        } catch (fileError) {
          console.error(`Error reading opening file ${file.name}:`, fileError);
        }
      }
    } catch (storageError) {
      console.error('Error accessing Cloud Storage for openings:', storageError);
      
      // Fallback: If we can't load from bucket, try to load from the JSON file
      try {
        const openingsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'popular-openings.json'), 'utf8'));
        
        for (const opening of openingsData.openings) {
          openings.push({
            id: hashFen(opening.fen),
            name: opening.name,
            fen: opening.fen,
            eco: opening.eco,
            moves: opening.moves
          });
        }
      } catch (readError) {
        console.error('Error reading openings from file:', readError);
      }
    }
    
    res.json(openings);
  } catch (error) {
    console.error('Error fetching popular openings:', error);
    res.status(500).json({ error: 'Failed to fetch popular openings' });
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
    
    // Check if we already have this analysis in memory cache
    const fenHash = hashFen(fen);
    let bestMemoryResult = null;
    let bestMemoryDepth = 0;
    
    for (const [key, value] of analysisCache.entries()) {
      // Extract the FEN part from cache key (before any underscore)
      const keyFen = key.split('_')[0];
      
      if (keyFen === fen && value.depth >= depth && value.depth > bestMemoryDepth) {
        bestMemoryResult = value;
        bestMemoryDepth = value.depth;
      }
    }
    
    if (bestMemoryResult) {
      console.log('Found cached analysis in memory');
      ensureMovesHaveSan(bestMemoryResult, fen);
      return res.json(bestMemoryResult);
    }
    
    // Check if we already have this analysis in local cache
    try {
      const localFiles = fs.readdirSync(LOCAL_CACHE_DIR);
      let bestLocalResult = null;
      let bestLocalDepth = 0;
      
      // Find the best matching analysis file locally
      for (const file of localFiles) {
        if (file.startsWith(fenHash)) {
          try {
            const filePath = path.join(LOCAL_CACHE_DIR, file);
            const analysisData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (analysisData.depth >= depth && analysisData.depth > bestLocalDepth) {
              bestLocalResult = analysisData;
              bestLocalDepth = analysisData.depth;
            }
          } catch (readError) {
            console.error(`Error reading local cache file ${file}:`, readError);
          }
        }
      }
      
      if (bestLocalResult) {
        console.log('Found cached analysis in local cache');
        
        // Add to memory cache
        const cacheKey = `${fen}_${bestLocalResult.depth}`;
        analysisCache.set(cacheKey, bestLocalResult);
        
        ensureMovesHaveSan(bestLocalResult, fen);
        return res.json(bestLocalResult);
      }
    } catch (localError) {
      console.error('Error checking local cache:', localError);
    }
    
    // Check Cloud Storage
    try {
      // List files in the analysis directory that match this position
      const [files] = await bucket.getFiles({ prefix: `analysis/${fenHash}` });
      
      let bestStorageResult = null;
      let bestStorageDepth = 0;
      
      // Find the best matching analysis file
      for (const file of files) {
        const filename = path.basename(file.name);
        const depthMatch = filename.match(/_(\d+)\.json$/);
        
        if (depthMatch) {
          const fileDepth = parseInt(depthMatch[1], 10);
          
          if (fileDepth >= depth && fileDepth > bestStorageDepth) {
            // Download the file
            const [content] = await file.download();
            const analysisData = JSON.parse(content.toString());
            
            bestStorageResult = analysisData;
            bestStorageDepth = fileDepth;
          }
        }
      }
      
      if (bestStorageResult) {
        console.log('Found cached analysis in Cloud Storage');
        
        // Save to local cache
        try {
          const localPath = path.join(LOCAL_CACHE_DIR, `${fenHash}_${bestStorageDepth}.json`);
          fs.writeFileSync(localPath, JSON.stringify(bestStorageResult, null, 2));
        } catch (writeError) {
          console.warn('Error writing to local cache:', writeError);
        }
        
        // Add to memory cache
        const cacheKey = `${fen}_${bestStorageResult.depth}`;
        analysisCache.set(cacheKey, bestStorageResult);
        
        ensureMovesHaveSan(bestStorageResult, fen);
        return res.json(bestStorageResult);
      }
    } catch (storageError) {
      console.error('Error accessing Cloud Storage:', storageError);
    }
    
    // Run Stockfish analysis if not in cache
    console.log(`Analyzing position: ${fen} at depth ${depth}`);
    const analysis = await analyzePosition(fen, depth);
    console.log('Analysis complete:', analysis);
    
    // Add the fenHash to the analysis for indexing
    analysis.fenHash = fenHash;
    
    // Convert UCI moves to SAN
    ensureMovesHaveSan(analysis, fen);
    
    // Save to local file for storage
    try {
      const docId = `${fenHash}_${depth}`;
      const filePath = path.join(ANALYSIS_CACHE_DIR, `${docId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(analysis, null, 2));
      console.log(`Saved analysis to file: ${filePath}`);
    } catch (saveError) {
      console.error('File save error:', saveError);
      // Continue even if save fails, to ensure user gets a response
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed: ' + error.message });
  }
});

// Helper function to ensure moves have SAN notation
function ensureMovesHaveSan(analysis, fen) {
  if (analysis.bestMoves && analysis.bestMoves.length > 0 && 
      analysis.bestMoves.some(move => move.uci && !move.san)) {
    const chess = new Chess(fen);
    analysis.bestMoves = analysis.bestMoves.map(move => {
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
  return analysis;
}

// Create a consistent hash for FEN strings
function hashFen(fen) {
  let hash = 0;
  for (let i = 0; i < fen.length; i++) {
    const char = fen.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Make it a positive number and convert to string
  return Math.abs(hash).toString(16);
}

// Global cache for storing analysis results temporarily
const analysisCache = new Map();

// Limit the in-memory cache size
function limitCacheSize() {
  if (analysisCache.size > 1000) {
    // Remove oldest entries (turn the Map into an array, sort by timestamp, then delete oldest)
    const entries = Array.from(analysisCache.entries());
    entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
    
    // Remove oldest 20% to avoid frequent cleanup
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      analysisCache.delete(entries[i][0]);
    }
  }
}

// Periodically clean up the cache (every 5 minutes)
setInterval(limitCacheSize, 5 * 60 * 1000);

// Function to analyze a position with Stockfish
function analyzePosition(fen, depth) {
  // Check if we have a cached result for this position at or exceeding the requested depth
  let cachedResult = null;
  let bestDepth = 0;
  
  // Look for best cached result at or above requested depth
  for (const [key, value] of analysisCache.entries()) {
    const keyFen = key.split('_')[0];
    
    if (keyFen === fen && value.depth >= depth && value.depth > bestDepth) {
      cachedResult = value;
      bestDepth = value.depth;
    }
  }
  
  if (cachedResult) {
    console.log(`Found cached analysis at depth ${cachedResult.depth} for requested depth ${depth}`);
    return Promise.resolve(cachedResult);
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
    
    // Timeout for analysis
    const timeout = setTimeout(() => {
      stockfish.kill();
      reject(new Error('Analysis timed out'));
    }, 10000); // 10 seconds timeout for deeper analysis
    
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
      
      // Extract evaluation
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
        // Take moves from PV line
        const moveCount = Math.min(5, pvLine.length); // Increase to 5 moves for better analysis
        for (let i = 0; i < moveCount; i++) {
          bestMoves.push({
            uci: pvLine[i],
            san: ''  // Will be converted later
          });
        }
      }
      
      // Generate intermediate results frequently for responsive UI
      const now = Date.now();
      if (
        (currentDepth > 0 && now - lastUpdateTime > 100) || // Update every 100ms
        (bestMoves.length > 0 && currentDepth > 4) // Any progress with bestmoves is worth showing
      ) {
        // Create a snapshot of the current analysis
        const analysisSnapshot = {
          fen,
          depth: currentDepth,
          requested_depth: depth,
          evaluation: evalString,
          bestMoves,
          timestamp: Date.now(),
          completed: false
        };
        
        // Store intermediate results in cache - use FEN as the main key part
        const cacheKey = `${fen}_${currentDepth}`;
        analysisCache.set(cacheKey, analysisSnapshot);
        console.log(`Stored intermediate result in cache with key ${cacheKey}`);
        
        // Update timestamp for rate limiting
        lastUpdateTime = now;
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
            fenHash: hashFen(fen),
            depth: currentDepth, 
            requested_depth: depth,
            evaluation: evalString,
            bestMoves,
            timestamp: Date.now(),
            completed: true
          };
          
          // Cache the final result
          const finalCacheKey = `${fen}_${currentDepth}`;
          analysisCache.set(finalCacheKey, finalResult);
          console.log(`Stored final result in cache with key ${finalCacheKey}`);
          
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
    
    // Configure and start Stockfish
    stockfish.stdin.write("uci\n");
    
    // Configure Stockfish with optimized settings
    stockfish.stdin.write("setoption name Threads value 8\n"); 
    stockfish.stdin.write("setoption name Hash value 128\n");
    stockfish.stdin.write("setoption name MultiPV value 1\n");
    
    // Speed optimizations
    stockfish.stdin.write("setoption name Minimum Thinking Time value 0\n");
    stockfish.stdin.write("setoption name Move Overhead value 0\n");
    stockfish.stdin.write("setoption name Slow Mover value 10\n");
    
    // Evaluation settings
    stockfish.stdin.write("setoption name Contempt value 0\n");
    stockfish.stdin.write("setoption name Skill Level value 20\n");
    stockfish.stdin.write("setoption name UCI_Chess960 value false\n");
    stockfish.stdin.write("setoption name UCI_AnalyseMode value true\n");
    
    // Additional optimizations
    stockfish.stdin.write("setoption name Ponder value false\n");
    stockfish.stdin.write("setoption name Use NNUE value true\n");
    stockfish.stdin.write("setoption name SyzygyProbeDepth value 0\n");
    stockfish.stdin.write("setoption name Syzygy50MoveRule value false\n");
    stockfish.stdin.write("setoption name nodestime value 0\n");
    
    // Use movetime alongside depth for more predictable response times
    const moveTime = 5000; // 5 seconds for deeper analysis (increased from 3s)
    
    stockfish.stdin.write("isready\n");
    stockfish.stdin.write(`position fen ${fen}\n`);
    stockfish.stdin.write(`go depth ${depth} movetime ${moveTime}\n`);
  });
}

// Admin API to add popular openings (protected route, requires API key)
app.post('/admin/popular-openings', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    // Simple API key validation - in production, use a more secure method
    if (apiKey !== process.env.ADMIN_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const openings = req.body.openings;
    
    if (!Array.isArray(openings)) {
      return res.status(400).json({ error: 'Openings must be an array' });
    }
    
    let count = 0;
    
    for (const opening of openings) {
      try {
        const filePath = path.join(OPENINGS_CACHE_DIR, `${hashFen(opening.fen)}.json`);
        fs.writeFileSync(filePath, JSON.stringify({
          name: opening.name,
          fen: opening.fen,
          eco: opening.eco || null,
          moves: opening.moves || [],
          createdAt: new Date().toISOString()
        }, null, 2));
        count++;
      } catch (saveError) {
        console.error(`Error saving opening ${opening.name}:`, saveError);
      }
    }
    
    res.status(201).json({ message: `Added ${count} opening(s)` });
  } catch (error) {
    console.error('Error adding popular openings:', error);
    res.status(500).json({ error: 'Failed to add popular openings' });
  }
});

// Preload popular openings into the cache
async function preloadPopularOpenings() {
  try {
    console.log('Preloading popular openings into analysis cache');
    
    // Load popular openings from JSON file instead of Firestore
    let openings = [];
    try {
      const openingsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'popular-openings.json'), 'utf8'));
      openings = openingsData.openings;
      console.log(`Loaded ${openings.length} popular openings from file`);
    } catch (readError) {
      console.error('Error reading popular-openings.json:', readError);
      return;
    }
    
    if (!openings || openings.length === 0) {
      console.log('No popular openings found to preload');
      return;
    }
    
    // Save openings to individual files
    for (const opening of openings) {
      try {
        const filePath = path.join(OPENINGS_CACHE_DIR, `${hashFen(opening.fen)}.json`);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, JSON.stringify({
            name: opening.name,
            fen: opening.fen,
            eco: opening.eco || null,
            moves: opening.moves || [],
            createdAt: new Date().toISOString()
          }, null, 2));
        }
      } catch (saveError) {
        console.error(`Error saving opening ${opening.name}:`, saveError);
      }
    }
    
    console.log(`Found ${openings.length} popular openings to preload`);
    
    // Analyze up to 10 openings at startup (reduced for speed)
    const openingsToPreload = openings.slice(0, 10);
    
    for (const opening of openingsToPreload) {
      try {
        // Check if analysis already exists in local files
        const fenHash = hashFen(opening.fen);
        const files = fs.readdirSync(ANALYSIS_CACHE_DIR);
        let analysisExists = false;
        
        for (const file of files) {
          if (file.startsWith(fenHash)) {
            analysisExists = true;
            // Load into memory cache
            try {
              const filePath = path.join(ANALYSIS_CACHE_DIR, file);
              const cachedAnalysis = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              const cacheKey = `${opening.fen}_${cachedAnalysis.depth}`;
              analysisCache.set(cacheKey, cachedAnalysis);
              console.log(`Preloaded opening from file: ${opening.name}`);
            } catch (fileError) {
              console.error(`Error reading analysis file for ${opening.name}:`, fileError);
            }
            break;
          }
        }
        
        if (!analysisExists) {
          // Analyze the position with Stockfish at a moderate depth for quick startup
          console.log(`Analyzing popular opening: ${opening.name}`);
          const analysis = await analyzePosition(opening.fen, 16);
          
          // Save to file
          const docId = `${fenHash}_16`;
          const filePath = path.join(ANALYSIS_CACHE_DIR, `${docId}.json`);
          const analysisData = {
            ...analysis,
            openingName: opening.name,
            eco: opening.eco || null
          };
          
          fs.writeFileSync(filePath, JSON.stringify(analysisData, null, 2));
          console.log(`Analyzed and saved opening: ${opening.name}`);
        }
      } catch (error) {
        console.error(`Error preloading opening ${opening.name}:`, error);
        // Continue with next opening
      }
    }
    
    console.log('Completed preloading popular openings');
  } catch (error) {
    console.error('Error in preloading popular openings:', error);
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Stockfish analysis service listening on port ${port}`);
  
  // Preload popular openings after server starts
  setTimeout(preloadPopularOpenings, 5000);
});