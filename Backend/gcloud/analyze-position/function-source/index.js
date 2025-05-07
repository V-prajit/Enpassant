// stockfish-client.js
const fetch = require('node-fetch');

const STOCKFISH_SERVICE_URL = process.env.STOCKFISH_CLOUD_RUN_URL;

exports.analyzeWithStockfish = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  if (!STOCKFISH_SERVICE_URL) {
    console.error('STOCKFISH_CLOUD_RUN_URL environment variable is not set or is using fallback.');
    return res.status(500).json({ error: 'Stockfish service URL not configured on the server.' });
  }

  try {
    const { fen, depth = 30 } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    console.log(`Sending position to Stockfish service: ${fen} at depth ${depth}`);
    
    // Forward the request to the Stockfish service
    const response = await fetch(STOCKFISH_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen, depth }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Stockfish service error: ${response.status} ${errorText}`);
    }

    const analysisResult = await response.json();
    console.log('Analysis complete:', analysisResult);
    
    return res.status(200).json(analysisResult);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Add support for getting cached analysis status
exports.analyzeWithStockfishStatus = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  if (!STOCKFISH_SERVICE_URL) {
    console.error('STOCKFISH_CLOUD_RUN_URL environment variable is not set or is using fallback for status check.');
    return res.status(500).json({ error: 'Stockfish service URL not configured on the server for status check.' });
  }

  try {
    const fen = req.params.fen;
    const minDepth = req.query.minDepth || 1;
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    console.log(`Checking cached analysis for: ${fen} at min depth ${minDepth}`);
    
    // Forward the request to the Stockfish service status endpoint
    const response = await fetch(`${STOCKFISH_SERVICE_URL}/status/${encodeURIComponent(fen)}?minDepth=${minDepth}`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'No cached analysis found' });
      }
      
      const errorText = await response.text();
      throw new Error(`Stockfish service error: ${response.status} ${errorText}`);
    }

    const analysisResult = await response.json();
    return res.status(200).json(analysisResult);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
