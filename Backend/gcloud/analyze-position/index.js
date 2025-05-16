const { VertexAI } = require('@google-cloud/vertexai');

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
const DEFAULT_DEEP_BUDGET  = 8192;

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

    const generateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      thinkingConfig: thinkingConfig,
    };

    const t0      = Date.now();
    const result  = await model.generateContent(generateContentRequest);
    const latency = (Date.now() - t0) / 1000;

    const answer =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, analysis unavailable.';

    if (!answer) {
        console.warn(`Received empty explanation for FEN: ${fen} (DeepThink: ${deepThink}, Budget: ${thinkingConfig.thinkingBudget})`);
    }
    
    return res.status(200).json({
      explanation       : answer,
      responseTime      : latency,
      gamePhase         : gamePhase || 'unknown',
      deepThinkMode     : deepThink,
      thinkingBudgetUsed: thinkingConfig.thinkingBudget, 
      model             : MODEL_ID,
    });
  } catch (err) {
    console.error('Error in analyzeChessPosition:', err);
    return res.status(500).json({ error: err.message });
  }
};