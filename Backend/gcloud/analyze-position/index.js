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
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 800,  // Reduced for faster responses
        temperature: 0.1,      // Lower temperature for more concise responses
        topP: 0.8,             // More focused sampling
        topK: 40,              // Limit token selection
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

    // Create a shorter, more targeted prompt based on player level
    let levelSpecificPrompt = '';
    if (validatedLevel === 'beginner') {
      levelSpecificPrompt = `
      You're explaining to a BEGINNER. Be very brief:
      1. Material balance (who has more pieces)
      2. Basic threats or opportunities
      3. Simple next move advice
      Keep total response under 150 words.`;
    } else if (validatedLevel === 'intermediate') {
      levelSpecificPrompt = `
      You're explaining to an INTERMEDIATE player. Be concise:
      1. Key positional aspects
      2. Tactical opportunities
      3. Best plan forward
      Keep total response under 200 words.`;
    } else {
      levelSpecificPrompt = `
      You're explaining to an ADVANCED player. Focus on:
      1. Critical positional factors
      2. Concrete tactical variations
      3. Strategic plan for both sides
      Keep total response under 250 words.`;
    }
    
    const prompt = `
    Chess position analysis for ${validatedLevel} player:
    FEN: ${fen}
    Stockfish evaluation: ${evaluation || 'Not available'}
    Best moves: ${bestMoves ? JSON.stringify(bestMoves).substring(0, 200) : 'Not available'}
    
    ${levelSpecificPrompt}
    
    Respond in a direct and efficient manner. No introductions or verbose explanations.
    `;

    console.log('Sending prompt to Gemini...');
    const startTime = Date.now();
    
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseTime = (Date.now() - startTime) / 1000;
    console.log(`Gemini response received in ${responseTime.toFixed(2)} seconds`);

    // Correctly extract text from the response
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                'Sorry, I could not analyze this position due to a technical issue.';

    console.log(`Generated ${text.length} characters of analysis`);

    return res.status(200).json({
      explanation: text,
      responseTime: responseTime
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};