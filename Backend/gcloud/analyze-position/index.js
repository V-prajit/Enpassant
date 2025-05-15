/* =========================================================================
    Cloud Functions – Gemini 2.5 Flash chess utilities
    – Fast mode  : thinkingBudget = 0
    – Deep‑Think : thinkingBudget = caller‑supplied or 8192 (default)
    =======================================================================*/

const { VertexAI } = require('@google-cloud/vertexai');
const Busboy       = require('busboy');
const os           = require('os');
const path         = require('path');
const fs           = require('fs');

const {
  determineGamePhase,
  createOpeningPrompt,
  createMiddlegamePrompt,
  createEndgamePrompt,
  createCheckmatePrompt,
  createGameReportPrompt,
  createChatPrompt,
  createGenericPrompt,
} = require('./player-levels');

const MODEL_ID             = 'gemini-2.5-flash-preview-04-17';
const DEFAULT_DEEP_BUDGET  = 16384;

function makeThinkingConfig(enabled, budgetFromClient) {
  return { thinkingBudget: enabled ? (Number(budgetFromClient) || DEFAULT_DEEP_BUDGET) : 0 };
}

exports.analyzeChessPosition = async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
    });
    return res.status(204).send('');
  }

  try {
    const deepThink   = req.body.useDeepThink === true;
    const thinkingConfig = makeThinkingConfig(deepThink, req.body.thinkingBudget);

    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });

    const model = vertex.preview.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        maxOutputTokens: deepThink ? 8192 : 4096,
        temperature    : deepThink ? 0.15  : 0.20,
        topP           : deepThink ? 0.90  : 0.95,
        topK           : deepThink ? 30    : 20,
      },
    });

    const {
      fen, evaluation, bestMoves,
      playerLevel, isCheckmate, checkmateWinner,
      isGameReport, userQuestion
    } = req.body || {};

    // Validate FEN
    if (!fen) return res.status(400).json({ error: 'FEN position is required.' });

    // Determine game phase and player level
    const gamePhase      = determineGamePhase(fen);
    const validLevels    = ['beginner', 'intermediate', 'advanced'];
    const level          = validLevels.includes(playerLevel) ? playerLevel : 'beginner';

    // Construct the prompt based on context
    let prompt;
    const EXTRA_DEEP_THINK_PROMPT =
`## DEEP THINK MODE
Provide exceptionally thorough, multi‑variation analysis.
– Explore strategic nuances, tactical motifs, pawn‑structure plans.
– Reference similar master‑game positions when relevant.
– Focus on depth rather than brevity.`;

    if (userQuestion) {
      prompt = createChatPrompt(fen, evaluation, bestMoves, level, userQuestion, gamePhase);
    } else if (isGameReport) {
      prompt = createGameReportPrompt(fen, evaluation, bestMoves, level, isCheckmate, checkmateWinner);
    } else if (isCheckmate) {
      prompt = createCheckmatePrompt(fen, checkmateWinner, level);
    } else {
      switch (gamePhase) {
        case 'opening':    prompt = createOpeningPrompt(fen, evaluation, bestMoves, level);    break;
        case 'middlegame': prompt = createMiddlegamePrompt(fen, evaluation, bestMoves, level); break;
        case 'endgame':    prompt = createEndgamePrompt(fen, evaluation, bestMoves, level);    break;
        default:           prompt = createGenericPrompt(fen, evaluation, bestMoves, level);
      }
    }

    if (deepThink) {
      prompt += '\n\n' + EXTRA_DEEP_THINK_PROMPT;
    }

    // Prepare the request payload for generateContent
    // The thinkingConfig (which includes thinkingBudget) is now always included.
    const generateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      thinkingConfig: thinkingConfig, // Use the config from makeThinkingConfig
    };

    const t0      = Date.now();
    const result  = await model.generateContent(generateContentRequest);
    const latency = (Date.now() - t0) / 1000;

    const answer =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, analysis unavailable.';

    // Log if the answer is empty
    if (!answer) {
        console.warn(`Received empty explanation for FEN: ${fen} (DeepThink: ${deepThink}, Budget: ${thinkingConfig.thinkingBudget})`);
    }
    
    return res.status(200).json({
      explanation       : answer,
      responseTime      : latency,
      gamePhase         : gamePhase || 'unknown',
      deepThinkMode     : deepThink,
      // thinkingBudgetUsed now directly reflects the budget set in thinkingConfig
      thinkingBudgetUsed: thinkingConfig.thinkingBudget, 
      model             : MODEL_ID,
    });
  } catch (err) {
    console.error('Error in analyzeChessPosition:', err);
    return res.status(500).json({ error: err.message });
  }
};

/* ======================================================================= */
/* AUDIO TRANSCRIPTION                                                    */
/* ======================================================================= */
exports.transcribeAudioWithGemini = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '3600',
    });
    return res.status(204).send('');
  }

  try {
    const { audioFilePath, fields } = await parseFormData(req);
    if (!audioFilePath) {
      console.error('Audio transcription: No audio file provided.');
      return res.status(400).json({ error: 'No audio file provided.' });
    }

    // Initialize Vertex AI client
    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });

    // Configure and get the generative model for transcription
    const model = vertex.preview.getGenerativeModel({
      model: MODEL_ID, 
      generationConfig: { temperature: 0.2, topP: 0.8, topK: 40, maxOutputTokens: 300 },
    });

    const audioBuf = fs.readFileSync(audioFilePath);
    if (!audioBuf.length) {
      fs.unlinkSync(audioFilePath);
      console.error('Audio transcription: Empty audio file.');
      return res.status(400).json({ error: 'Empty audio file.' });
    }

    // Assemble prompt for transcription
    const promptParts = [
      { text: 'Transcribe the following chess‑related audio. Output ONLY the transcription.' },
      ...(fields.fen ? [{ text: `Current FEN: ${fields.fen}` }] : []), 
      { fileData: { mimeType: 'audio/webm', 
                    fileUri : `data:audio/webm;base64,${audioBuf.toString('base64')}` } },
    ];

    // Prepare the request payload for generateContent
    const generateContentRequest = {
      contents: [{ role: 'user', parts: promptParts }],
      // Explicitly setting thinkingBudget to 0 for transcription, as it's a direct task.
      thinkingConfig: { thinkingBudget: 0 }, 
    };

    const t0      = Date.now();
    const result  = await model.generateContent(generateContentRequest);
    const latency = (Date.now() - t0) / 1000;

    // Clean up temporary audio file
    fs.unlinkSync(audioFilePath);

    const transcription =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, transcription failed.';

    return res.status(200).json({
      transcription,
      responseTime: latency,
      model       : MODEL_ID,
    });
  } catch (err) {
    console.error('Error in transcribeAudioWithGemini:', err);
    return res.status(500).json({ error: err.message });
  }
};

/* ======================================================================= */
/* FORM DATA PARSING UTILITY                                              */
/* ======================================================================= */
function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let   audioFilePath = null;

    const busboy = Busboy({ headers: req.headers });

    busboy.on('file', (name, file, { filename, encoding, mimeType }) => {
      console.log(`ParseFormData: File [${name}]: filename: ${filename}, encoding: ${encoding}, mimeType: ${mimeType}`);
      
      if (name === 'audio') {
        const tempFilename = `audio_${Date.now()}_${filename.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const tempFilepath = path.join(os.tmpdir(), tempFilename);
        
        console.log(`ParseFormData: Saving audio to ${tempFilepath}`);
        const writeStream = fs.createWriteStream(tempFilepath);
        file.pipe(writeStream);

        writeStream.on('finish', () => {
          console.log(`ParseFormData: Audio file ${tempFilename} saved successfully.`);
          audioFilePath = tempFilepath;
        });
        writeStream.on('error', (err) => {
          console.error(`ParseFormData: Error writing audio file ${tempFilename}:`, err);
          reject(err);
        });
      } else {
        file.resume();
      }
    });

    busboy.on('field', (name, val, fieldnameTruncated, valTruncated, encoding, mimeType) => {
      console.log(`ParseFormData: Field [${name}]: value: ${val}`);
      fields[name] = val;
    });

    busboy.on('finish', () => {
      console.log('ParseFormData: Finished parsing form.');
      if (audioFilePath || Object.keys(fields).length > 0) { 
        resolve({ audioFilePath, fields });
      } else {
        console.warn('ParseFormData: Finish event with no audio file path set and no fields.');
        resolve({ audioFilePath, fields }); 
      }
    });
    
    busboy.on('error', (err) => {
      console.error('ParseFormData: Busboy error:', err);
      reject(err);
    });

    if (req.rawBody) {
      busboy.end(req.rawBody);
    } else {
      req.pipe(busboy);
    }
  });
}