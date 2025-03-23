const { VertexAI } = require('@google-cloud/vertexai');

exports.analyzeChessPosition = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    // Initialize Vertex AI
    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'tidal-hack25tex-223',
      location: 'us-central1',
    });

    const generativeModel = vertex.preview.getGenerativeModel({
      model: 'gemini-pro',
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.2,
      }
    });

    const { fen, evaluation, bestMoves, playerLevel } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    // Validate playerLevel and set default if invalid
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    const validatedLevel = validLevels.includes(playerLevel) ? playerLevel : 'beginner';
    
    console.log(`Analyzing position for ${validatedLevel} player:`, {
      fen,
      evaluation: evaluation || 'Not provided',
      moves: bestMoves ? `${bestMoves.length} moves` : 'None'
    });

    const prompt = `
    As a chess coach, explain this position to a ${validatedLevel} player:
    
    FEN: ${fen}
    Stockfish evaluation: ${evaluation || 'Not available'}
    Best moves: ${bestMoves ? JSON.stringify(bestMoves) : 'Not available'}
    
    Provide a clear explanation of:
    1. The key features of this position
    2. Strategic ideas for both sides
    3. Concrete tactical opportunities if any
    4. Simple advice for improving play at the ${validatedLevel} level
    
    Tailor your explanation specifically for a ${validatedLevel} player. 
    For beginner: focus on basic concepts and simple strategies.
    For intermediate: include positional concepts and tactical patterns.
    For advanced: provide deeper strategic analysis and calculation of lines.
    `;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    // Correctly extract text from the response
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                'Sorry, I could not analyze this position due to a technical issue.';

    return res.status(200).json({
      explanation: text,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};