const { VertexAI } = require('@google-cloud/vertexai');
const Busboy = require('busboy');
const os = require('os');
const path = require('path');
const fs = require('fs');

const {
  playerLevelConfig,
  determineGamePhase,
  createOpeningPrompt,
  createMiddlegamePrompt,
  createEndgamePrompt,
  createCheckmatePrompt,
  createGameReportPrompt,
  createChatPrompt,
  createGenericPrompt,
  formatBestMoves
} = require('./player-levels');

exports.analyzeChessPosition = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') { 
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }
  
  // Log the request source
  const userAgent = req.headers['user-agent'] || 'Unknown';
  console.log(`Handling request from: ${userAgent}`);

  try {
    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });

    const deepThinkEnabled = req.body.useDeepThink === true;
    console.log(`Using ${deepThinkEnabled ? 'Deep Think' : 'Standard'} mode`);
    
    const userQuestion = req.body.userQuestion;
    
    const modelConfig = deepThinkEnabled
      ? {
          model: 'gemini-2.5-pro-preview-05-06',
          generationConfig: {
            maxOutputTokens: 1200, 
            temperature: 0.15,
            topP: 0.9,            
            topK: 30,
          }
        }
      : userQuestion 
        ? {
            model: 'gemini-2.5-flash-preview-04-17',
            generationConfig: {
              maxOutputTokens: 300, 
              temperature: 0.2,     
              topP: 0.95,          
              topK: 20,            
            }
          }
        : {
            model: 'gemini-2.5-flash-preview-04-17',
            generationConfig: {
              maxOutputTokens: 800,
              temperature: 0.1,
              topP: 0.8,
              topK: 40,
            }
          };
    
    const generativeModel = vertex.preview.getGenerativeModel(modelConfig);

    const { 
      fen, 
      evaluation, 
      bestMoves, 
      playerLevel, 
      isCheckmate, 
      checkmateWinner,
      isGameReport,
      useDeepThink
     } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    const validLevels = ['beginner', 'intermediate', 'advanced'];
    const validatedLevel = validLevels.includes(playerLevel) ? playerLevel : 'beginner';
    
    console.log(`Analyzing position for ${validatedLevel} player:`, {
      fen,
      evaluation: evaluation || 'Not provided',
      moves: bestMoves ? `${bestMoves.length} moves` : 'None',
      isCheckmate: isCheckmate || false,
      isGameReport: isGameReport || false,
      userQuestion: userQuestion || null
    });

    const gamePhase = determineGamePhase(fen);
    console.log(`Detected game phase: ${gamePhase}`);

    let prompt;
    
    if (deepThinkEnabled) {
      console.log("Using Deep Think mode for enhanced analysis");
      
      if (userQuestion) {
        prompt = createChatPrompt(fen, evaluation, bestMoves, validatedLevel, userQuestion, gamePhase) + `
        
        ## DEEP THINK MODE
        Because Deep Think mode has been selected, please provide a significantly more in-depth and detailed analysis.
        - Extend your analysis to consider multiple move sequences and variations
        - Include strategic nuances and positional subtleties not covered in standard analysis
        - Consider long-term implications of pawn structures and piece placements
        - Draw connections to similar positions from master games when relevant
        - Target your response to advanced players with thorough chess understanding
        `;
      } 
      else if (isGameReport) {
        prompt = createGameReportPrompt(fen, evaluation, bestMoves, validatedLevel, isCheckmate, checkmateWinner) + `
        
        ## DEEP THINK MODE
        This is a Deep Think analysis. Please provide an exceptionally thorough game analysis:
        - Evaluate critical moments with multiple variations
        - Analyze subtle positional nuances
        - Reference similar positions or ideas from master games
        - Include concrete suggestions for improvement with detailed explanations
        - Discuss multiple strategic pathways that could have been explored
        `;
      }
      else if (isCheckmate) {
        prompt = createCheckmatePrompt(fen, checkmateWinner, validatedLevel) + `
        
        ## DEEP THINK MODE
        This is a Deep Think analysis of a checkmate position:
        - Trace the tactical and strategic elements that led to this checkmate in greater detail
        - Analyze multiple defensive resources that could have prevented this outcome
        - Identify the exact move sequence where the game decisively turned
        - Provide deeper insights into similar mating patterns from master games
        `;
      } 
      else {
        let basePrompt;
        switch (gamePhase) {
          case 'opening':
            basePrompt = createOpeningPrompt(fen, evaluation, bestMoves, validatedLevel);
            break;
          case 'middlegame':
            basePrompt = createMiddlegamePrompt(fen, evaluation, bestMoves, validatedLevel);
            break;
          case 'endgame':
            basePrompt = createEndgamePrompt(fen, evaluation, bestMoves, validatedLevel);
            break;
          default:
            basePrompt = createGenericPrompt(fen, evaluation, bestMoves, validatedLevel);
        }
        
        prompt = basePrompt + `
        
        ## DEEP THINK MODE
        This is a Deep Think analysis. Please provide an exceptionally thorough position analysis:
        - Analyze multiple candidate moves and their resulting positions
        - Explore deep strategic themes and long-term planning
        - Identify subtle tactical and positional motifs
        - Discuss pawn structure implications in greater detail
        - Provide concrete variations to illustrate key points
        - Reference similar positions from notable games when relevant
        - Focus on comprehensive understanding rather than brevity
        `;
      }
    }
    else {
      if (userQuestion) {
        prompt = createChatPrompt(fen, evaluation, bestMoves, validatedLevel, userQuestion, gamePhase);
      }
      else if (isGameReport) {
        prompt = createGameReportPrompt(fen, evaluation, bestMoves, validatedLevel, isCheckmate, checkmateWinner);
      }
      else if (isCheckmate) {
        prompt = createCheckmatePrompt(fen, checkmateWinner, validatedLevel);
      } else {
        switch (gamePhase) {
          case 'opening':
            prompt = createOpeningPrompt(fen, evaluation, bestMoves, validatedLevel);
            break;
          case 'middlegame':
            prompt = createMiddlegamePrompt(fen, evaluation, bestMoves, validatedLevel);
            break;
          case 'endgame':
            prompt = createEndgamePrompt(fen, evaluation, bestMoves, validatedLevel);
            break;
          default:
            prompt = createGenericPrompt(fen, evaluation, bestMoves, validatedLevel);
        }
      }
    }

    console.log('Sending specialized prompt to Gemini...');
    const startTime = Date.now();
    
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const responseTime = (Date.now() - startTime) / 1000;
    console.log(`Gemini response received in ${responseTime.toFixed(2)} seconds`);

    console.log('Full Gemini API result object:', JSON.stringify(result, null, 2)); 

    const candidate = result.response?.candidates?.[0];
    if (candidate) {
        console.log('Candidate Finish Reason:', candidate.finishReason);
        console.log('Candidate Safety Ratings:', JSON.stringify(candidate.safetyRatings, null, 2));
        if (candidate.content && candidate.content.parts) {
            console.log('Candidate Content Parts:', JSON.stringify(candidate.content.parts, null, 2));
        } else {
            console.log('Candidate content or parts are undefined.');
        }
    } else {
        console.log('No candidates found in Gemini response.');
    }

    const text = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                'Sorry, I could not analyze this position due to a technical issue.';

    console.log(`Extracted text (or fallback): ${text}`);

    console.log(`Generated ${text.length} characters of analysis`);

    return res.status(200).json({
      explanation: text,
      responseTime: responseTime,
      gamePhase: gamePhase || 'unknown',
      deepThinkMode: deepThinkEnabled,
      model: deepThinkEnabled ? 'gemini-2.5-pro-preview-05-06' : 'gemini-2.5-flash-preview-04-17'
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};

exports.transcribeAudioWithGemini = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }
  
  const userAgent = req.headers['user-agent'] || 'Unknown';
  console.log(`Handling audio transcription request from: ${userAgent}`);
  
  try {
    const { audioFilePath, fields } = await parseFormData(req);
    
    if (!audioFilePath) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    console.log(`Audio file received: ${audioFilePath}`);
    
    // Get chess context if available
    const fen = fields.fen || null;
    const isChessContext = fields.context === 'chess';
    
    // Initialize Vertex AI
    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });
    
    // Use Gemini 2.0 Pro (optimized for audio transcription)
    const generativeModel = vertex.preview.getGenerativeModel({
      model: 'gemini-2.0-pro',
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 300,
      }
    });
    
    // Read the audio file
    const audioContent = fs.readFileSync(audioFilePath);
    
    // Check if file is empty
    if (audioContent.length === 0) {
      console.error('Received empty audio file');
      return res.status(400).json({ error: 'Empty audio file provided' });
    }
    
    console.log(`Audio file size: ${audioContent.length} bytes`);
    const audioBase64 = audioContent.toString('base64');
    
    // Create prompt parts
    const promptParts = [
      { text: "Transcribe the following audio, focusing specifically on chess-related terminology and notation. Pay special attention to:" },
      { text: "- Chess piece names (pawn, knight, bishop, rook, queen, king)" },
      { text: "- Chess coordinates (a1, e4, etc.)" },
      { text: "- Chess moves (e4, Nf3, O-O, etc.)" },
      { text: "- Positional terms (center, attack, defense, etc.)" },
      { text: "- Questions about chess positions or moves" },
      { text: "Provide only the clean transcription without any explanations. If no speech is detected, just reply with 'No audible speech detected.'" },
    ];
    
    // Add FEN context if available
    if (fen && isChessContext) {
      promptParts.push({
        text: `Current chess position (FEN): ${fen}\nThis is a chess position the user is referring to.`
      });
    }
    
    // Add audio data
    promptParts.push({
      fileData: {
        mimeType: 'audio/webm',
        fileUri: `data:audio/webm;base64,${audioBase64}`
      }
    });
    
    console.log('Requesting audio transcription from Gemini...');
    const startTime = Date.now();
    
    // Generate transcription
    const result = await generativeModel.generateContent({
      contents: [{ role: 'user', parts: promptParts }],
    });
    
    const responseTime = (Date.now() - startTime) / 1000;
    console.log(`Gemini response received in ${responseTime.toFixed(2)} seconds`);
    
    // Extract text from the response
    const transcription = result.response?.candidates?.[0]?.content?.parts?.[0]?.text || 
                        'Sorry, I could not transcribe this audio.';
    
    console.log(`Transcribed: "${transcription}"`);
    
    // Clean up the temporary file
    fs.unlinkSync(audioFilePath);
    
    // Return the transcription
    return res.status(200).json({
      transcription: transcription,
      responseTime: responseTime,
      hasChessContext: !!fen
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    return res.status(500).json({ error: error.message });
  }
};

/**
 * Parses multipart form data from the request
 * @param {Object} req - HTTP request object
 * @returns {Promise<Object>} Object containing file path and form fields
 */
function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let audioFilePath = null;
    
    const busboy = Busboy({ headers: req.headers });
    
    busboy.on('file', (fieldname, file, { filename, mimeType }) => {
      if (fieldname === 'audio') {
        const tmpdir = os.tmpdir();
        const filepath = path.join(tmpdir, filename);
        
        console.log(`Processing file upload: ${filename} (${mimeType})`);
        
        const writeStream = fs.createWriteStream(filepath);
        file.pipe(writeStream);
        
        writeStream.on('finish', () => {
          audioFilePath = filepath;
        });
      } else {
        // Discard other file uploads
        file.resume();
      }
    });
    
    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });
    
    busboy.on('finish', () => {
      resolve({ audioFilePath, fields });
    });
    
    busboy.on('error', (error) => {
      reject(error);
    });
    
    if (req.rawBody) {
      // For Cloud Functions environment
      busboy.end(req.rawBody);
    } else {
      // For standard HTTP environment
      req.pipe(busboy);
    }
  });
}