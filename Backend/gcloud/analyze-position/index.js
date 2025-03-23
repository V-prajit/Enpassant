// Backend/gcloud/analyze-position/index.js
const { VertexAI } = require('@google-cloud/vertexai');
const { 
  createSkillLevelPrompt, 
  createTacticalPrompt, 
  createOpeningPrompt, 
  createEndgamePrompt, 
  createMiddlegamePrompt,
  determineGamePhase 
} = require('./player-levels');
const { createPositionDescription } = require('./position-analyzer');

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

    const { 
      fen, 
      evaluation, 
      bestMoves, 
      playerLevel = 'beginner', 
      analysisType 
    } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    // Validate playerLevel
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    const validatedLevel = validLevels.includes(playerLevel) ? playerLevel : 'beginner';
    
    // Create detailed position analysis
    const positionDetails = createPositionDescription(fen);
    
    // Determine game phase if analysisType is not specified
    let detectedAnalysisType = analysisType;
    if (!detectedAnalysisType) {
      const gamePhase = determineGamePhase(fen);
      detectedAnalysisType = gamePhase;
    }
    
    // Create prompt based on player level and detected analysis type
    let prompt;
    
    switch (detectedAnalysisType) {
      case 'opening':
        prompt = createOpeningPrompt(fen, evaluation, bestMoves, validatedLevel);
        break;
      case 'middlegame':
        prompt = createMiddlegamePrompt(fen, evaluation, bestMoves, validatedLevel);
        break;
      case 'endgame':
        prompt = createEndgamePrompt(fen, evaluation, bestMoves, validatedLevel);
        break;
      case 'tactical':
        prompt = createTacticalPrompt(fen, evaluation, bestMoves, validatedLevel);
        break;
      default:
        prompt = createSkillLevelPrompt(fen, evaluation, bestMoves, validatedLevel);
    }
    
    // Combine position details with the prompt
    const fullPrompt = `${positionDetails}\n\n${prompt}`;

    console.log(`Analyzing position for ${validatedLevel} player using ${detectedAnalysisType} analysis type`);
    
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    // Extract text from the response
    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                'Sorry, I could not analyze this position due to a technical issue.';

    return res.status(200).json({
      explanation: text,
      analysisType: detectedAnalysisType,
      playerLevel: validatedLevel
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};