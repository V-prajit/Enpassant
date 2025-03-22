const functions = require('@google-cloud/functions-framework');
// Use the stockfish.js WebAssembly version
const Stockfish = require('stockfish.js');

// Register the HTTP function
functions.http('analyzeWithStockfish', (req, res) => {
  // Set CORS headers for all response types
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Origin');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  // Make sure we have a POST request
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Please use POST.' });
  }

  try {
    // Parse request body
    const { fen, depth = 30 } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    // Execute Stockfish analysis
    analyzePosition(fen, depth)
      .then(result => {
        res.status(200).json(result);
      })
      .catch(error => {
        console.error('Analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze position' });
      });
  } catch (error) {
    console.error('Request handling error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Function to analyze a chess position with Stockfish
function analyzePosition(fen, depth) {
  return new Promise((resolve, reject) => {
    try {
      // Initialize Stockfish.js WebAssembly
      const engine = Stockfish();
      
      let output = '';
      let bestMove = null;
      let evaluation = null;
      let pvLine = [];
      let analysisComplete = false;
      
      // Set a timeout to prevent hanging
      const analysisTimeout = setTimeout(() => {
        if (!analysisComplete) {
          engine.postMessage('quit');
          reject(new Error('Analysis timed out after 30 seconds'));
        }
      }, 30000); // 30 second timeout
      
      // Set up Stockfish event handler
      engine.onmessage = (message) => {
        const text = message;
        console.log(`Stockfish output: ${text}`);
        output += text + '\n';
        
        // Extract evaluation
        if (text.includes('score cp')) {
          const match = text.match(/score cp (-?\d+)/);
          if (match) {
            const cp = parseInt(match[1]);
            evaluation = {
              type: 'cp',
              value: cp
            };
          }
        } else if (text.includes('score mate')) {
          const match = text.match(/score mate (-?\d+)/);
          if (match) {
            const moves = parseInt(match[1]);
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
          clearTimeout(analysisTimeout);
          analysisComplete = true;
          
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
                  san: '' // We would need chess.js to convert UCI to SAN
                });
              }
            } else if (bestMove) {
              bestMoves.push({
                uci: bestMove,
                san: ''
              });
            }
            
            // Resolve with analysis results
            resolve({
              fen,
              depth,
              evaluation: evalString,
              bestMoves
            });
          }
        }
      };
      
      // Set position and start analysis
      engine.postMessage('uci');
      engine.postMessage('isready');
      engine.postMessage(`position fen ${fen}`);
      engine.postMessage(`go depth ${depth}`);
    } catch (error) {
      reject(error);
    }
  });
}