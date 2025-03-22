// stockfish-client.js
const fetch = require('node-fetch');

const STOCKFISH_SERVICE_URL = 'https://stockfish-analysis-w2fppjnuua-uc.a.run.app';

exports.analyzeWithStockfish = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
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
