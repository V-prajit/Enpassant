// batch-analysis.js
// Script to preload and analyze popular openings and positions for fast retrieval
const fs = require('fs');
const { spawn } = require('child_process');
const { Chess } = require('chess.js');
const { Storage } = require('@google-cloud/storage');

// Set up Google Cloud Storage
const storage = new Storage();
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102';
const BUCKET_NAME = `${PROJECT_ID}-chess-analysis`;

// Initialize storage bucket
const bucket = storage.bucket(BUCKET_NAME);

// Make sure the bucket exists
async function ensureBucketExists() {
  try {
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log(`Bucket ${BUCKET_NAME} doesn't exist, creating...`);
      await bucket.create({ location: 'us-central1' });
      // Make objects publicly readable
      await bucket.iam.combinePermissions({
        bindings: [
          {
            role: 'roles/storage.objectViewer',
            members: ['allUsers'],
          },
        ],
      });
    }
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
  }
}

// Define directories and prefixes
const ANALYSIS_PREFIX = 'analysis/';
const OPENINGS_PREFIX = 'openings/';

// For local caching during processing
const LOCAL_ANALYSIS_DIR = './analysis-cache';
const LOCAL_OPENINGS_DIR = './openings-cache';

// Create local cache directories
if (!fs.existsSync(LOCAL_ANALYSIS_DIR)) {
  fs.mkdirSync(LOCAL_ANALYSIS_DIR, { recursive: true });
}
if (!fs.existsSync(LOCAL_OPENINGS_DIR)) {
  fs.mkdirSync(LOCAL_OPENINGS_DIR, { recursive: true });
}

// Read the popular openings file
const openingsData = JSON.parse(fs.readFileSync('./popular-openings.json', 'utf8'));
const allPositions = [
  ...openingsData.openings.map(opening => ({ 
    fen: opening.fen, 
    name: opening.name, 
    type: 'opening',
    eco: opening.eco 
  })),
  ...openingsData.midgame_positions.map(pos => ({ 
    fen: pos.fen, 
    name: pos.name, 
    type: 'middlegame' 
  })),
  ...openingsData.endgame_positions.map(pos => ({ 
    fen: pos.fen, 
    name: pos.name, 
    type: 'endgame' 
  }))
];

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

// Function to analyze a position with Stockfish at high depth (32+)
async function analyzePosition(fen, depth, positionName = '', positionType = '') {
  return new Promise((resolve, reject) => {
    console.log(`Analyzing position: ${positionName || fen} at depth ${depth}`);
    
    // Validate FEN using chess.js
    try {
      new Chess(fen);
    } catch (error) {
      reject(new Error(`Invalid FEN position: ${fen}`));
      return;
    }
  
    // Spawn Stockfish process
    const stockfish = spawn('stockfish');
    
    let output = '';
    let bestMove = null;
    let evaluation = null;
    let pvLine = [];
    let currentDepth = 0;
    
    // Longer timeout for deep analysis
    const timeout = setTimeout(() => {
      stockfish.kill();
      reject(new Error('Analysis timed out after 5 minutes'));
    }, 5 * 60 * 1000); // 5 minute timeout for thorough analysis
    
    // Process Stockfish output
    stockfish.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      
      // Only log progress every few depth increments
      if (text.includes('depth') && !text.includes('bestmove')) {
        const depthMatch = text.match(/depth (\d+)/);
        if (depthMatch) {
          const newDepth = parseInt(depthMatch[1], 10);
          if (newDepth > currentDepth) {
            currentDepth = newDepth;
            if (currentDepth % 4 === 0 || currentDepth >= depth - 2) {
              console.log(`  Progress: depth ${currentDepth}/${depth}`);
            }
          }
        }
      }
      
      // Extract evaluation
      if (text.includes('score cp')) {
        const match = text.match(/score cp (-?\d+)/);
        if (match) {
          let cp = parseInt(match[1], 10);
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
      
      // Extract best move (final result)
      if (text.includes('bestmove')) {
        clearTimeout(timeout);
        
        const match = text.match(/bestmove (\w+)/);
        if (match) {
          bestMove = match[1];
          
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
          
          // Format best moves with SAN notation
          let bestMoves = [];
          if (pvLine.length > 0) {
            const chess = new Chess(fen);
            const moveCount = Math.min(5, pvLine.length); // Store more moves for deep analysis
            
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
                  san: sanMove ? sanMove.san : ''
                });
              } catch (error) {
                // Skip moves that can't be played (likely due to prior move changing position)
                break;
              }
            }
            
            // Reset the position for the next iteration
            chess.load(fen);
          }
          
          if (bestMoves.length === 0 && bestMove) {
            bestMoves.push({
              uci: bestMove,
              san: ''
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
            completed: true,
            position_name: positionName,
            position_type: positionType
          };
          
          resolve(finalResult);
          
          // Kill the Stockfish process
          stockfish.kill();
        } else {
          reject(new Error('Failed to get best move from Stockfish'));
        }
      }
    });
    
    // Handle errors
    stockfish.stderr.on('data', (data) => {
      console.error(`Stockfish error: ${data}`);
    });
    
    stockfish.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    stockfish.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !bestMove) {
        reject(new Error(`Stockfish process exited with code ${code}`));
      }
    });
    
    // Configure and start Stockfish with high settings for deep analysis
    stockfish.stdin.write("uci\n");
    
    // Configure Stockfish with optimized settings for deep analysis
    stockfish.stdin.write("setoption name Threads value 8\n"); 
    stockfish.stdin.write("setoption name Hash value 1024\n"); // 1GB hash for deep analysis
    stockfish.stdin.write("setoption name MultiPV value 1\n");
    
    // Quality-focused settings
    stockfish.stdin.write("setoption name Skill Level value 20\n");
    stockfish.stdin.write("setoption name Contempt value 0\n");
    stockfish.stdin.write("setoption name UCI_Chess960 value false\n");
    stockfish.stdin.write("setoption name UCI_AnalyseMode value true\n");
    stockfish.stdin.write("setoption name Use NNUE value true\n");
    
    // Long movetime for deep analysis
    const moveTime = 60000; // 1 minute per position minimum
    
    stockfish.stdin.write("isready\n");
    stockfish.stdin.write(`position fen ${fen}\n`);
    stockfish.stdin.write(`go depth ${depth} movetime ${moveTime}\n`);
  });
}

// Function to save analysis to Google Cloud Storage
async function saveAnalysisToStorage(analysis) {
  try {
    const docId = `${analysis.fenHash}_${analysis.depth}`;
    const localPath = `${LOCAL_ANALYSIS_DIR}/${docId}.json`;
    const storagePath = `${ANALYSIS_PREFIX}${docId}.json`;
    
    // Save locally for batch processing
    fs.writeFileSync(localPath, JSON.stringify(analysis, null, 2));
    
    // Save to Cloud Storage
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'application/json',
        cacheControl: 'public, max-age=86400' // 24 hour cache
      }
    });
    
    console.log(`Saved analysis to Cloud Storage: ${analysis.position_name || analysis.fen}`);
    return true;
  } catch (error) {
    console.error('Error saving to Cloud Storage:', error);
    return false;
  }
}

// Function to check if analysis exists in Cloud Storage
async function checkAnalysisExists(fen, minDepth) {
  try {
    const fenHash = hashFen(fen);
    
    // List files in the bucket with the prefix (this returns a promise)
    const [files] = await bucket.getFiles({ prefix: ANALYSIS_PREFIX });
    
    // Look for files that match the pattern
    for (const file of files) {
      const filename = file.name.replace(ANALYSIS_PREFIX, '');
      if (filename.startsWith(fenHash)) {
        // Extract depth from filename
        const depthMatch = filename.match(/_(\d+)\.json$/);
        if (depthMatch) {
          const depth = parseInt(depthMatch[1], 10);
          if (depth >= minDepth) {
            return true;
          }
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error checking analysis in Cloud Storage:', error);
    return false;
  }
}

// Save openings to Google Cloud Storage
async function saveOpeningsToStorage() {
  console.log('Saving opening positions to Cloud Storage...');
  
  let count = 0;
  
  for (const opening of openingsData.openings) {
    try {
      const fenHash = hashFen(opening.fen);
      const localPath = `${LOCAL_OPENINGS_DIR}/${fenHash}.json`;
      const storagePath = `${OPENINGS_PREFIX}${fenHash}.json`;
      
      // Save locally first
      fs.writeFileSync(localPath, JSON.stringify({
        name: opening.name,
        fen: opening.fen,
        eco: opening.eco || null,
        moves: opening.moves || [],
        createdAt: new Date().toISOString()
      }, null, 2));
      
      // Upload to Cloud Storage
      await bucket.upload(localPath, {
        destination: storagePath,
        metadata: {
          contentType: 'application/json',
          cacheControl: 'public, max-age=86400' // 24 hour cache
        }
      });
      
      count++;
    } catch (error) {
      console.error(`Error saving opening ${opening.name}:`, error);
    }
  }
  
  console.log(`Added ${count} opening positions to Cloud Storage`);
}

// Main function to analyze all positions
async function analyzeAllPositions() {
  // Ensure bucket exists
  await ensureBucketExists();
  
  // First save openings to Cloud Storage
  await saveOpeningsToStorage();
  
  console.log(`Starting batch analysis of ${allPositions.length} positions...`);
  
  const targetDepth = parseInt(process.env.ANALYSIS_DEPTH || 32, 10);
  let completed = 0;
  let skipped = 0;
  
  for (const position of allPositions) {
    try {
      // Check if this position is already analyzed at sufficient depth
      const exists = await checkAnalysisExists(position.fen, targetDepth - 4);
      
      if (exists) {
        console.log(`Skipping already analyzed position: ${position.name || position.fen}`);
        skipped++;
        continue;
      }
      
      // Analyze the position
      const result = await analyzePosition(
        position.fen, 
        targetDepth, 
        position.name, 
        position.type
      );
      
      // Save to Cloud Storage
      await saveAnalysisToStorage(result);
      completed++;
      
      console.log(`Progress: ${completed + skipped}/${allPositions.length} positions processed`);
    } catch (error) {
      console.error(`Error analyzing position ${position.name || position.fen}:`, error);
    }
  }
  
  console.log(`Batch analysis complete: ${completed} positions analyzed, ${skipped} skipped.`);
  console.log(`Analysis files saved to gs://${BUCKET_NAME}/${ANALYSIS_PREFIX}`);
}

// Run the main function
analyzeAllPositions()
  .then(() => {
    console.log('All positions have been analyzed and saved.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in batch analysis:', error);
    process.exit(1);
  });