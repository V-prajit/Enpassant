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

    // Create detailed position analysis
    const positionDetails = createPositionDescription(fen);
    
    // Create prompt based on player level and analysis type
    let prompt;
    
    if (analysisType === 'general') {
      prompt = createSkillLevelPrompt(fen, evaluation, bestMoves, playerLevel);
    } else if (analysisType === 'tactical') {
      prompt = createTacticalPrompt(fen, evaluation, bestMoves, playerLevel);
    } else if (analysisType === 'educational') {
      prompt = createEducationalPrompt(fen, evaluation, bestMoves, playerLevel);
    } else {
      prompt = createSkillLevelPrompt(fen, evaluation, bestMoves, playerLevel);
    }
    
    // Combine position details with the prompt
    const fullPrompt = `${positionDetails}\n\n${prompt}`;

    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    // Extract text from the response
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                'Sorry, I could not analyze this position due to a technical issue.';

    return res.status(200).json({
      explanation: text,
      analysisType,
      playerLevel
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

// Create a tactical analysis prompt
function createTacticalPrompt(fen, evaluation, bestMoves, playerLevel) {
  return `
  As a chess tactical coach, analyze this position for a ${playerLevel} player:
  
  FEN: ${fen}
  Stockfish evaluation: ${evaluation || 'Not available'}
  Best moves: ${formatBestMoves(bestMoves)}
  
  Focus exclusively on the tactical elements:
  1. Are there any immediate tactics in this position? (pins, forks, discovered attacks, etc.)
  2. What is the concrete calculation behind Stockfish's recommended move?
  3. Are there any tactical traps or blunders to avoid?
  
  Use clear, simple language appropriate for a ${playerLevel} player.
  `;
}

// Create an educational prompt focused on learning
function createEducationalPrompt(fen, evaluation, bestMoves, playerLevel) {
  return `
  As a chess teacher, use this position as a learning opportunity for a ${playerLevel} player:
  
  FEN: ${fen}
  Stockfish evaluation: ${evaluation || 'Not available'}
  Best moves: ${formatBestMoves(bestMoves)}
  
  Focus on making this educational:
  1. What is the main chess principle or lesson to learn from this position?
  2. How does Stockfish's recommended move demonstrate this principle?
  3. Provide a simple rule or guideline the player can remember for similar positions
  
  Use clear, simple language appropriate for a ${playerLevel} player.
  `;
}

// Helper function to format best moves
function formatBestMoves(bestMoves) {
  if (!Array.isArray(bestMoves) || bestMoves.length === 0) {
    return 'Not available';
  }
  
  return bestMoves.map((move, index) => {
    const moveText = move.san || move.uci;
    return `Move ${index + 1}: ${moveText}`;
  }).join('\n');
}