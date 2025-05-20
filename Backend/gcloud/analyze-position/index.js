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

const MODEL_ID             = 'gemini-2.5-flash-preview-04-17'; // Taken from the version with debugging
const DEFAULT_DEEP_BUDGET  = 1024; // Taken from the version with debugging

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

  console.log('--- New analyzeChessPosition request ---');
  console.log('Timestamp:', new Date().toISOString());
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  try {
    const deepThink   = req.body.useDeepThink === true;
    const thinkingConfig = makeThinkingConfig(deepThink, req.body.thinkingBudget);
    console.log('Thinking config:', thinkingConfig);

    const vertex = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102',
      location: 'us-central1',
    });

    console.log('VertexAI initialized for project:', process.env.GOOGLE_CLOUD_PROJECT || 'enpassant-459102', 'and location: us-central1');

    const model = vertex.preview.getGenerativeModel({
      model: MODEL_ID,
      generationConfig: { // Values from the version with debugging
        maxOutputTokens: deepThink ? 4096 : 4096,
        temperature    : deepThink ? 0.15  : 0.20,
        topP           : deepThink ? 0.90  : 0.95,
        topK           : deepThink ? 30    : 20,
      },
    });

    console.log('Generative model obtained with ID:', MODEL_ID);
    console.log('Generation config:', {
        maxOutputTokens: deepThink ? 4096 : 4096,
        temperature    : deepThink ? 0.15  : 0.20,
        topP           : deepThink ? 0.90  : 0.95,
        topK           : deepThink ? 30    : 20,
      });

    const {
      fen, evaluation, bestMoves,
      playerLevel, isCheckmate, checkmateWinner,
      isGameReport, userQuestion
    } = req.body || {};

    if (!fen) {
      console.error('Error: FEN position is required.');
      return res.status(400).json({ error: 'FEN position is required.' });
    }
    console.log('FEN:', fen);
    console.log('Evaluation:', evaluation);
    console.log('Best Moves:', bestMoves);
    console.log('Player Level:', playerLevel);
    console.log('Is Checkmate:', isCheckmate);
    console.log('Checkmate Winner:', checkmateWinner);
    console.log('Is Game Report:', isGameReport);
    console.log('User Question:', userQuestion);

    const gamePhase      = determineGamePhase(fen);
    const validLevels    = ['beginner', 'intermediate', 'advanced'];
    const level          = validLevels.includes(playerLevel) ? playerLevel : 'beginner';
    console.log('Using Player Level:', level);

    let prompt;
    const EXTRA_DEEP_THINK_PROMPT =
`## DEEP THINK MODE
Provide exceptionally thorough, multi‑variation analysis.
– Explore strategic nuances, tactical motifs, pawn‑structure plans.
– Reference similar master‑game positions when relevant.
– Focus on depth rather than brevity.`;

    if (userQuestion) {
      prompt = createChatPrompt(fen, evaluation, bestMoves, level, userQuestion, gamePhase);
      console.log('Created Chat Prompt.');
    } else if (isGameReport) {
      prompt = createGameReportPrompt(fen, evaluation, bestMoves, level, isCheckmate, checkmateWinner);
      console.log('Created Game Report Prompt.');
    } else if (isCheckmate) {
      prompt = createCheckmatePrompt(fen, checkmateWinner, level);
      console.log('Created Checkmate Prompt.');
    } else {
      switch (gamePhase) {
        case 'opening':    prompt = createOpeningPrompt(fen, evaluation, bestMoves, level);    break;
        case 'middlegame': prompt = createMiddlegamePrompt(fen, evaluation, bestMoves, level); break;
        case 'endgame':    prompt = createEndgamePrompt(fen, evaluation, bestMoves, level);    break;
        default:           prompt = createGenericPrompt(fen, evaluation, bestMoves, level);
      }
      // Log which prompt was created by the switch
      console.log(`Created ${gamePhase || 'Generic'} Prompt.`);
    }

    if (deepThink) {
      prompt += '\n\n' + EXTRA_DEEP_THINK_PROMPT;
      console.log('Appended EXTRA_DEEP_THINK_PROMPT.');
    }

    console.log('Generated Prompt (first 500 chars):', prompt.substring(0, 500));

    const generateContentRequest = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      thinkingConfig: thinkingConfig,
    };

    console.log('Generate Content Request:', JSON.stringify(generateContentRequest, null, 2));

    const t0      = Date.now();
    console.log('Sending request to Vertex AI model...');
    const result  = await model.generateContent(generateContentRequest);
    const latency = (Date.now() - t0) / 1000;
    console.log('Received response from Vertex AI model. Latency:', latency, 's');

    console.log('Raw Vertex AI Response:', JSON.stringify(result, null, 2));


    if (!result.response) {
      console.warn('Vertex AI response object is missing.');
    } else if (!result.response.candidates || result.response.candidates.length === 0) {
      console.warn('Vertex AI response.candidates is missing or empty.');
    } else if (!result.response.candidates[0].content) {
      console.warn('Vertex AI response.candidates[0].content is missing.');
    } else if (!result.response.candidates[0].content.parts || result.response.candidates[0].content.parts.length === 0) {
      console.warn('Vertex AI response.candidates[0].content.parts is missing or empty.');
    } else if (!result.response.candidates[0].content.parts[0].text) {
      console.warn('Vertex AI response.candidates[0].content.parts[0].text is missing.');
    }

    const answer =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Sorry, analysis unavailable.';

    if (answer === 'Sorry, analysis unavailable.' || !answer) {
      console.warn(`Received empty or fallback explanation for FEN: ${fen} (DeepThink: ${deepThink}, Budget: ${thinkingConfig.thinkingBudget})`);
      console.warn('Prompt sent to Vertex was:', prompt.substring(0,1000) + "..."); // Log more of the prompt on failure
    } else {
      console.log('Extracted answer (first 100 chars):', answer.substring(0,100));
    }
    
    
    console.log('--- analyzeChessPosition request finished ---');
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
    console.error('Error stack:', err.stack || 'No stack available');
    console.error('Error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    console.log('--- analyzeChessPosition request failed ---');
    return res.status(500).json({ error: err.message, details: err.toString() });
  }
};