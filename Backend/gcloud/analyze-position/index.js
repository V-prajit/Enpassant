/*  =========================================================================
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

/* ------------ constants ------------------------------------------------- */
const MODEL_ID             = 'gemini-2.5-flash-preview-04-17';
const DEFAULT_DEEP_BUDGET  = 8192;

/* helper */
function makeThinkingConfig(enabled, budgetFromClient) {
  return { thinkingBudget: enabled ? (Number(budgetFromClient) || DEFAULT_DEEP_BUDGET) : 0 };
}

/* ======================================================================= */
/*  CHESS POSITION ANALYSIS                                                */
/* ======================================================================= */
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
    const thinkConfig = makeThinkingConfig(deepThink, req.body.thinkingBudget);

    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });

    const model = vertex.preview.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: {
        maxOutputTokens: deepThink ? 4096 : 2048,
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

    if (!fen) return res.status(400).json({ error: 'FEN position is required.' });

    const gamePhase      = determineGamePhase(fen);
    const validLevels    = ['beginner', 'intermediate', 'advanced'];
    const level          = validLevels.includes(playerLevel) ? playerLevel : 'beginner';

    /* ---------- build prompt ------------------------------------------- */
    let prompt;

    if (deepThink) {
      /* Deep‑Think adds an “extra analysis” footer */
      const EXTRA =
`## DEEP THINK MODE
Provide exceptionally thorough, multi‑variation analysis.
– Explore strategic nuances, tactical motifs, pawn‑structure plans.
– Reference similar master‑game positions when relevant.
– Focus on depth rather than brevity.`;

      if (userQuestion) {
        prompt = createChatPrompt(fen, evaluation, bestMoves, level, userQuestion, gamePhase) + '\n\n' + EXTRA;
      } else if (isGameReport) {
        prompt = createGameReportPrompt(fen, evaluation, bestMoves, level, isCheckmate, checkmateWinner) + '\n\n' + EXTRA;
      } else if (isCheckmate) {
        prompt = createCheckmatePrompt(fen, checkmateWinner, level) + '\n\n' + EXTRA;
      } else {
        switch (gamePhase) {
          case 'opening':    prompt = createOpeningPrompt(fen, evaluation, bestMoves, level);    break;
          case 'middlegame': prompt = createMiddlegamePrompt(fen, evaluation, bestMoves, level); break;
          case 'endgame':    prompt = createEndgamePrompt(fen, evaluation, bestMoves, level);    break;
          default:           prompt = createGenericPrompt(fen, evaluation, bestMoves, level);
        }
        prompt += '\n\n' + EXTRA;
      }
    } else {
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
    }

    const t0      = Date.now();
    const result  = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }]}],
      thinkingConfig: thinkConfig,
    });
    const latency = (Date.now() - t0) / 1000;

    const answer =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, analysis unavailable.';

    return res.status(200).json({
      explanation       : answer,
      responseTime      : latency,
      gamePhase         : gamePhase || 'unknown',
      deepThinkMode     : deepThink,
      thinkingBudgetUsed: thinkConfig.thinkingBudget,
      model             : MODEL_ID,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

exports.transcribeAudioWithGemini = async (req, res) => {
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
    if (!audioFilePath) return res.status(400).json({ error: 'No audio file provided.' });

    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });

    const model = vertex.preview.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: { temperature: 0.2, topP: 0.8, topK: 40, maxOutputTokens: 300 },
    });

    const audioBuf = fs.readFileSync(audioFilePath);
    if (!audioBuf.length) {
      fs.unlinkSync(audioFilePath);
      return res.status(400).json({ error: 'Empty audio file.' });
    }

    /* assemble prompt */
    const promptParts = [
      { text: 'Transcribe the following chess‑related audio. Output ONLY the transcription.' },
      ...(fields.fen ? [{ text: `Current FEN: ${fields.fen}` }] : []),
      { fileData: { mimeType: 'audio/webm',
                    fileUri : `data:audio/webm;base64,${audioBuf.toString('base64')}` } },
    ];

    const t0      = Date.now();
    const result  = await model.generateContent({
      contents: [{ role: 'user', parts: promptParts }],
      thinkingConfig: { thinkingBudget: 0 },
    });
    const latency = (Date.now() - t0) / 1000;

    fs.unlinkSync(audioFilePath);

    const transcription =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, transcription failed.';

    return res.status(200).json({
      transcription,
      responseTime: latency,
      model      : MODEL_ID,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};

function parseFormData(req) {
  return new Promise((resolve, reject) => {
    const fields = {};
    let   audioFilePath = null;

    const busboy = Busboy({ headers: req.headers });

    busboy.on('file', (name, file, { filename }) => {
      if (name === 'audio') {
        const temp = path.join(os.tmpdir(), filename);
        file.pipe(fs.createWriteStream(temp))
            .on('finish', () => (audioFilePath = temp));
      } else { file.resume(); }
    });

    busboy.on('field', (name, val) => { fields[name] = val; });
    busboy.on('finish', ()     => resolve({ audioFilePath, fields }));
    busboy.on('error', reject);

    (req.rawBody ? busboy.end(req.rawBody) : req.pipe(busboy));
  });
}
