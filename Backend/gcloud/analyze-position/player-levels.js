// Backend/gcloud/analyze-position/player-levels.js

// Player level configuration - keeping this unchanged as it's already well-structured
const playerLevelConfig = {
  beginner: {
    concepts: ['piece development', 'controlling the center', 'basic tactics', 'king safety', 'piece values'],
    complexity: 'low',
    terms: ['attack', 'defend', 'protect', 'capture', 'threat', 'check', 'checkmate', 'castle'],
    avoidTerms: ['zugzwang', 'prophylaxis', 'compensation', 'initiative'],
    gamePhases: {
      opening: 'Focus on developing knights and bishops, controlling the central squares (e4, d4, e5, d5), and castling early',
      middlegame: 'Focus on piece activity and king safety',
      endgame: 'Focus on pawn promotion and king activity'
    },
    pieceValues: 'Remember basic piece values: Queen (9), Rook (5), Bishop (3), Knight (3), Pawn (1)'
  },
  intermediate: {
    concepts: ['pawn structure', 'piece coordination', 'tactical patterns', 'initiative', 'active pieces'],
    complexity: 'medium',
    terms: ['pin', 'fork', 'discovered attack', 'overloaded piece', 'tempo', 'outpost', 'weak squares'],
    avoidTerms: ['deep endgame theory', 'prophylaxis subtleties'],
    gamePhases: {
      opening: 'Consider pawn structure implications and piece placement for middlegame plans',
      middlegame: 'Coordinate pieces toward strategic goals and watch for tactical opportunities',
      endgame: 'Understand basic endgame principles for rook, bishop, and knight endings'
    },
    pieceValues: 'Remember that piece activity often matters more than raw material - an active knight on an outpost can be worth more than a passive rook'
  },
  advanced: {
    concepts: ['positional play', 'strategic planning', 'piece imbalances', 'prophylaxis', 'dynamic compensation'],
    complexity: 'high',
    terms: ['counterplay', 'compensation', 'initiative', 'weak squares', 'pawn breaks', 'piece coordination', 'prophylaxis'],
    avoidTerms: [],
    gamePhases: {
      opening: 'Consider specific pawn structures and their strategic implications',
      middlegame: 'Balance positional and tactical elements while forming long-term plans',
      endgame: 'Apply technical precision in converting advantages, including opposite-colored bishop dynamics and rook endgame techniques'
    },
    pieceValues: 'Evaluate pieces contextually - understand when a piece\'s strategic value exceeds its nominal value, such as a knight dominating on d6 versus a trapped rook'
  }
};

// Game phase detection function - unchanged
function determineGamePhase(fen) {
  const piecesSection = fen.split(' ')[0];
  const pieceCount = (piecesSection.match(/[pnbrqkPNBRQK]/g) || []).length;
  const developedPieces = (piecesSection.match(/[NBRQ]/g) || []).length;

  if (pieceCount >= 28 && developedPieces <= 4) {
    return 'opening';
  } else if (pieceCount <= 14) {
    return 'endgame';
  } else {
    return 'middlegame';
  }
}

// Optimized opening analysis prompt
function createOpeningPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess opening coach for ${playerLevel} player. Position: ${fen}. Eval: ${evaluation || 'NA'}. Best moves: ${formatBestMoves(bestMoves)}.

1. Identify opening/family.
2. Assess both sides: development status, castling status, center control.
3. ${playerLevel === 'beginner' ?
      'Principles: develop knights/bishops, control center (e4,d4,e5,d5), castle early, connect rooks. Best first moves: e4/d4.' :
      playerLevel === 'intermediate' ?
        'Focus: how pawn structure shapes middlegame plans and piece placement.' :
        'Analyze: strategic ideas in this variation, transpositions, key theoretical concepts.'}
4. Explain why engine move is strong: development value, center control, strategic goals.
5. Note common ${playerLevel}-level mistakes in this position.

Use terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized middlegame analysis prompt
function createMiddlegamePrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess middlegame coach for ${playerLevel}. Position: ${fen}. Eval: ${evaluation || 'NA'}. Moves: ${formatBestMoves(bestMoves)}.

1. Structure: pawn structure, piece activity, king safety, key squares, open files.
2. Strategy: minor piece quality, weak squares, space control, pawn breaks.
3. Tactics: immediate combinations, attacks, defensive needs.
4. Best move strengths: strategic fit, tactical importance, activity improvement.
5. Key factors: king safety, piece activity, opponent threats.
6. ${playerLevel === 'beginner' ?
      'Advice: improve least active pieces, secure king.' :
      playerLevel === 'intermediate' ?
        'Advice: plan based on pawn structure and piece imbalances.' :
        'Advice: balance tactical opportunities with long-term strategic planning.'} 

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}. 
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized tactical analysis prompt
function createTacticalPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess tactics coach for ${playerLevel}. Position: ${fen}. Eval: ${evaluation || 'NA'}. Moves: ${formatBestMoves(bestMoves)}.

1. Tactical elements: motifs (pins, forks, discovered attacks), weak pieces/squares, hanging pieces.
2. Calculation of best move: initial move, expected responses, follow-ups.
3. Pattern recognition: ${playerLevel === 'beginner' ?
      'basic pins, forks, discovered attacks.' :
      playerLevel === 'intermediate' ?
        'combinations with sacrifices and intermediate moves.' :
        'complex motifs including deflection, interference, clearance sacrifices.'}
4. Defensive resources and threats to address.

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized skill level prompt
function createSkillLevelPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess coach for ${playerLevel}. Position: ${fen}. Eval: ${evaluation || 'NA'}. Moves: ${formatBestMoves(bestMoves)}.

1. Material balance and basic assessment
2. Key tactical and strategic elements
3. Best move explanation
4. Focus for ${playerLevel} level:
 - Opening: ${config.gamePhases.opening}
 - Middlegame: ${config.gamePhases.middlegame}
 - Endgame: ${config.gamePhases.endgame}
5. ${config.pieceValues}

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized endgame analysis prompt
function createEndgamePrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess endgame coach for ${playerLevel}. Position: ${fen}. Eval: ${evaluation || 'NA'}. Moves: ${formatBestMoves(bestMoves)}.

1. Material: remaining pieces, advantages, pawn structure.
2. Principles: king activity, pawn promotion paths, piece coordination, key squares, zugzwang potential.
3. Assessment: theoretical win/draw/loss, defensive resources, fortress potential.
4. Best move value: endgame plan contribution, threat creation, piece activity.
5. ${playerLevel === 'beginner' ?
      'Focus: pawn promotion, king activation.' :
      playerLevel === 'intermediate' ?
        'Focus: opposition, favorable piece trades for king-pawn endings.' :
        'Focus: technical conversion techniques, opposition, triangulation, breakthroughs.'} 

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized checkmate analysis prompt
function createCheckmatePrompt(fen, winner, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess coach analyzing checkmate for ${playerLevel}. Position: ${fen}. ${winner} has won.

1. How checkmate was achieved.
2. Key tactical patterns leading to checkmate.
3. What losing side could have done earlier to avoid this outcome.
4. Learning opportunities from this checkmate.

Educational focus: ${playerLevel === 'beginner' ?
      'basic concepts: piece coordination, king safety, development. Use simple language.' :
      playerLevel === 'intermediate' ?
        'tactical patterns, strategic errors, defensive resources.' :
        'tactical/strategic factors, alternative defensive ideas, prophylactic thinking.'}

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized game report prompt
function createGameReportPrompt(fen, evaluation, bestMoves, playerLevel, isCheckmate, winner) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess game report for ${playerLevel}. Position: ${fen}. ${isCheckmate ? `Checkmate - ${winner} won.` : 'Game in progress.'}

1. Position assessment
2. Key turning points
3. Strategic/tactical lessons
4. Improvement recommendations
5. ${playerLevel === 'beginner' ?
      'Focus: development, king safety, material counting.' :
      playerLevel === 'intermediate' ?
        'Focus: strategic patterns, pawn structure influence.' :
        'Focus: decision points, alternative approaches, strategic themes.'} 

Provide 2-3 specific improvement tips. Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized chat/question prompt
function createChatPrompt(fen, evaluation, bestMoves, playerLevel, userQuestion, gamePhase) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess coach for ${playerLevel}. Position: ${fen}. Eval: ${evaluation || 'NA'}. Phase: ${gamePhase || 'unknown'}.

Question: "${userQuestion}"

Answer directly in 3-5 sentences. No intros. Use bullet points for multiple items. For move evaluations, start with clear judgment. ${playerLevel === 'beginner' ?
      'Use simple language. Focus: basic threats, material, piece activity.' :
      playerLevel === 'intermediate' ?
        'Use moderate terminology. Include tactical patterns, positional elements.' :
        'Use advanced concepts and precise evaluations.'}

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Optimized generic prompt
function createGenericPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;

  return `Chess coach for ${playerLevel}. Position: ${fen}. Eval: ${evaluation || 'NA'}. Moves: ${formatBestMoves(bestMoves)}.

1. Position assessment: material, piece activity, king safety, pawn structure, key square control.
2. Strategic themes: plans for each side, weak targets, piece improvement opportunities.
3. Tactical elements: combinations, defensive requirements, coordination possibilities.
4. Best move strengths: plan coherence, threat creation/prevention, position improvement.
5. Key learning opportunity for ${playerLevel} player.

Terms: ${config.terms.slice(0, 5).join(', ')}${config.terms.length > 5 ? '...' : ''}.
${config.avoidTerms.length > 0 ? `Avoid: ${config.avoidTerms.slice(0, 3).join(', ')}${config.avoidTerms.length > 3 ? '...' : ''}.` : ''}`;
}

// Helper function to format best moves - unchanged
function formatBestMoves(bestMoves) {
  if (!Array.isArray(bestMoves) || bestMoves.length === 0) {
    return 'Not available';
  }

  return bestMoves.map((move, index) => {
    const moveText = move.san || move.uci;
    return `Move ${index + 1}: ${moveText}`;
  }).join('\n');
}

module.exports = {
  playerLevelConfig,
  determineGamePhase,
  createOpeningPrompt,
  createMiddlegamePrompt,
  createEndgamePrompt,
  createTacticalPrompt,
  createSkillLevelPrompt,
  createCheckmatePrompt,
  createGameReportPrompt,
  createChatPrompt,
  createGenericPrompt,
  formatBestMoves
};