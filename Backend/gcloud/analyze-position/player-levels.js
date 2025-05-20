const { Chess } = require('chess.js');

const playerLevelConfig = {
  beginner: {
    concepts: ['piece development', 'controlling the center', 'basic tactics', 'king safety', 'piece values'],
    complexity: 'low',
    terms: ['attack', 'defend', 'protect', 'capture', 'threat', 'check', 'checkmate', 'castle'],
    avoidTerms: ['zugzwang', 'prophylaxis', 'compensation', 'initiative', 'tempo'],
    gamePhases: {
      opening: 'Focus on developing knights and bishops, controlling the central squares (e.g., e4, d4, e5, d5), castling early to protect your king, and not moving the same piece multiple times.',
      middlegame: 'Look for simple tactics like forks and pins, ensure your king is safe, and try to activate your pieces. Avoid leaving pieces undefended.',
      endgame: 'Understand basic checkmates (e.g., King and Queen vs King), try to promote your pawns, and use your king actively.'
    },
    pieceValues: 'Remember basic piece values: Queen (9 points), Rook (5 points), Bishop (3 points), Knight (3 points), Pawn (1 point). The King is invaluable!'
  },
  intermediate: {
    concepts: ['pawn structure', 'piece coordination', 'tactical patterns (pins, forks, skewers, discovered attacks)', 'initiative', 'active pieces', 'outposts', 'open files'],
    complexity: 'medium',
    terms: ['pin', 'fork', 'discovered attack', 'overloaded piece', 'tempo', 'outpost', 'weak square', 'pawn break', 'initiative', 'prophylaxis (basic)'],
    avoidTerms: ['deep endgame theory', 'complex positional sacrifices without clear follow-up'],
    gamePhases: {
      opening: 'Aim for a harmonious setup, considering pawn structure implications and piece placement for typical middlegame plans. Control key central squares and complete development.',
      middlegame: 'Formulate a plan based on the position\'s characteristics (e.g., pawn weaknesses, open files, king safety). Coordinate your pieces to execute this plan and be alert for tactical opportunities.',
      endgame: 'Master basic pawn endings, rook endings (e.g., Lucena, Philidor), and understand how to convert a material advantage. King activity is crucial.'
    },
    pieceValues: 'Understand that piece activity and positional factors (like outposts for knights, open files for rooks) can often be more important than the static material count.'
  },
  advanced: {
    concepts: ['positional play nuances', 'strategic planning based on imbalances', 'prophylactic thinking', 'dynamic compensation', 'converting advantages', 'complex tactical sequences'],
    complexity: 'high',
    terms: ['counterplay', 'compensation', 'initiative', 'prophylaxis', 'pawn breaks', 'minority attack', 'space advantage', 'dynamic factors', 'critical squares', 'zugzwang'],
    avoidTerms: [], // Advanced players should be familiar with most terms
    gamePhases: {
      opening: 'Understand the typical plans, pawn structures, and tactical motifs arising from specific opening variations. Be aware of transpositional possibilities.',
      middlegame: 'Evaluate complex positional factors, calculate variations accurately, balance attack and defense, and make decisions based on long-term strategic goals and short-term tactical needs. Exploit imbalances.',
      endgame: 'Apply precise technical knowledge in a wide variety of endgames, including rook and minor piece endings, fortresses, and converting small advantages. Understand concepts like opposition and triangulation.'
    },
    pieceValues: 'Evaluate pieces dynamically based on their current and potential roles in the specific position. Understand concepts like "good" vs "bad" bishops and the strategic value of piece activity and coordination.'
  }
};

// Game phase detection function - MODIFIED
function determineGamePhase(fen) {
  const chess = new Chess(fen); // <--- Instantiate Chess here
  const piecesSection = fen.split(' ')[0];
  const pieceCount = (piecesSection.match(/[pnbrqkPNBRQK]/g) || []).length;

  const whiteQueens = (piecesSection.match(/Q/g) || []).length;
  const blackQueens = (piecesSection.match(/q/g) || []).length;
  const whiteRooks = (piecesSection.match(/R/g) || []).length;
  const blackRooks = (piecesSection.match(/r/g) || []).length;

  const majorPieceCount = whiteQueens + blackQueens + whiteRooks + blackRooks;
  const moveNumber = chess.moveNumber(); // <--- Use the chess instance

  // Adjusted logic slightly to prioritize move number for early game phase.
  if (moveNumber <= 12 && pieceCount >= 26) { // Typically opening phase
    return 'opening';
  } else if (pieceCount <= 16 || (pieceCount <= 20 && majorPieceCount <= 2 && whiteQueens === 0 && blackQueens === 0)) {
    return 'endgame';
  } else {
    return 'middlegame';
  }
}

// (rest of your existing functions: formatBestMoves, createOpeningPrompt, etc.)
// Make sure they are the versions from my previous response that focus on Stockfish PV.

// Helper function to format best moves, focusing on the PV for the top line
function formatBestMoves(bestMoves, overallEvaluation) {
  if (!Array.isArray(bestMoves) || bestMoves.length === 0 || !bestMoves[0]) {
    return 'Stockfish analysis details not available or no moves found.';
  }

  const topMove = bestMoves[0];
  let formatted = `Stockfish's Top Suggestion (Overall Eval for position: ${overallEvaluation}):\n`;
  formatted += `1. Line Evaluation: ${topMove.evaluation || 'N/A'}\n`;
  formatted += `   Principal Variation (PV): ${topMove.pv || topMove.uci || 'PV not available'}\n`;

  if (bestMoves.length > 1 && bestMoves[1]) {
    const altMove1 = bestMoves[1];
    formatted += `\nAlternative Line 1 (Eval: ${altMove1.evaluation || 'N/A'}):\n`;
    formatted += `   PV: ${(altMove1.pvArray && altMove1.pvArray.slice(0, 5).join(' ')) || altMove1.uci || 'PV not available'}\n`; 
  }
  if (bestMoves.length > 2 && bestMoves[2]) {
    const altMove2 = bestMoves[2];
    formatted += `\nAlternative Line 2 (Eval: ${altMove2.evaluation || 'N/A'}):\n`;
    formatted += `   PV: ${(altMove2.pvArray && altMove2.pvArray.slice(0, 5).join(' ')) || altMove2.uci || 'PV not available'}\n`;
  }
  return formatted.trim();
}

function createOpeningPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);

  return `You are a chess coach for a ${playerLevel} player, explaining the opening phase.
Current Position FEN: ${fen}
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  Identify the name of the opening if recognizable.
2.  **Focus on Stockfish's Top Suggested Principal Variation (PV).** Explain the main ideas and goals of this PV for the current player in the context of general opening principles.
    * For ${playerLevel}s: ${config.gamePhases.opening}
3.  Briefly discuss how the top PV helps with piece development, center control, and king safety.
4.  Mention 1-2 common mistakes a ${playerLevel} might make in this type of opening position and how Stockfish's top PV avoids them or capitalizes on opponent's potential mistakes.
5.  Use clear, concise language. Limit explanation to key concepts.
6.  Relevant terms for a ${playerLevel}: ${config.terms.slice(0, 4).join(', ')}. Avoid: ${config.avoidTerms.slice(0,3).join(', ')}.
7.  **Do not suggest your own moves. Explain Stockfish's rationale.**`;
}

function createMiddlegamePrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);

  return `You are a chess coach for a ${playerLevel} player, explaining a middlegame position.
Current Position FEN: ${fen}
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  Assess the key characteristics of the position: material balance, king safety for both sides, pawn structure, and active pieces.
2.  **Focus extensively on Stockfish's Top Suggested Principal Variation (PV).**
    * What is the main plan or idea behind this PV for the current player? (e.g., attack, defense, improving piece placement, exploiting a weakness).
    * What are the key tactical motifs or strategic goals in this PV?
    * For ${playerLevel}s: ${config.gamePhases.middlegame}.
3.  Based on the top PV, what should be the current player's primary focus?
4.  Briefly, what makes the alternative Stockfish lines less preferable or different in idea compared to the top PV, if apparent?
5.  Use clear, concise language.
6.  Relevant terms for a ${playerLevel}: ${config.terms.join(', ')}. Avoid: ${config.avoidTerms.join(', ')}.
7.  **Do not suggest your own moves. Explain Stockfish's rationale.**`;
}

function createEndgamePrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);

  return `You are a chess coach for a ${playerLevel} player, explaining an endgame position.
Current Position FEN: ${fen}
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  Identify the type of endgame if clear (e.g., rook endgame, pawn endgame). Note critical material imbalances.
2.  **Focus on Stockfish's Top Suggested Principal Variation (PV).** Explain the main endgame plan or technique demonstrated in this PV.
    * For ${playerLevel}s: ${config.gamePhases.endgame}.
    * Does it involve pawn promotion, king activity, creating a passed pawn, zugzwang, etc.?
3.  What are the critical squares or pieces in this PV?
4.  Provide 1-2 key learning points from Stockfish's top PV for a ${playerLevel} player in this type of endgame.
5.  Use clear, concise language.
6.  Relevant terms for a ${playerLevel}: ${config.terms.slice(0, 4).join(', ')}. Avoid: ${config.avoidTerms.slice(0,3).join(', ')}.
7.  **Do not suggest your own moves. Explain Stockfish's rationale.**`;
}

function createTacticalPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);

  return `You are a chess coach for a ${playerLevel} player, focusing on tactics in this position.
Current Position FEN: ${fen}
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  **Examine Stockfish's Top Suggested Principal Variation (PV).** Is there a clear tactical sequence or combination in this PV?
2.  If tactics are present in the top PV, describe the tactical motifs (e.g., fork, pin, skewer, discovered attack, deflection, undermining).
3.  Explain the forcing nature of the moves in the tactical part of the PV. What are the key threats?
4.  If the top PV is not overtly tactical, explain if it's setting up future tactics or preventing opponent's tactics.
5.  Highlight what a ${playerLevel} player should be looking for to spot such tactical ideas.
6.  Relevant terms for a ${playerLevel}: ${config.terms.join(', ')}. Avoid: ${config.avoidTerms.join(', ')}.
7.  **Do not suggest your own moves. Explain Stockfish's rationale.**`;
}

function createGenericPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation); 
  const gamePhase = determineGamePhase(fen);

  return `You are a chess coach providing a general analysis for a ${playerLevel} player.
Game Phase: ${gamePhase}
Current Position FEN: ${fen}
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  Briefly assess the overall position: material, king safety, piece activity, and central control.
2.  **Focus primarily on Stockfish's Top Suggested Principal Variation (PV).**
    * Explain the main strategic and/or tactical idea(s) behind this PV for the current player.
    * What does this PV aim to achieve in the short and medium term?
3.  Based on the top PV and the game phase (${gamePhase}), what is one key concept a ${playerLevel} player should focus on in this position or similar positions?
    * Opening: ${config.gamePhases.opening}
    * Middlegame: ${config.gamePhases.middlegame}
    * Endgame: ${config.gamePhases.endgame}
4.  Explain using terms appropriate for a ${playerLevel}: ${config.terms.slice(0,5).join(', ')}.
5.  **Do not try to find a better move than Stockfish's top line. Your role is to explain Stockfish's reasoning.**
Provide a concise yet insightful explanation.`;
}

function createChatPrompt(fen, evaluation, bestMoves, playerLevel, userQuestion, gamePhase) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);

  return `You are a chess coach answering a question from a ${playerLevel} player.
Position FEN: ${fen}.
Game Phase: ${gamePhase || 'unknown'}.
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

User's Question: "${userQuestion}"

Instructions for your answer:
1.  Address the user's question directly and clearly.
2.  **Wherever relevant, connect your answer to the provided Stockfish Analysis, especially the Top Suggested Principal Variation (PV).** For example, if the user asks about a specific move, check if it's part of Stockfish's PV or an alternative, and explain its merits or drawbacks based on that.
3.  If the user asks "why is move X good?", and X is part of Stockfish's PV, explain its role in that PV for a ${playerLevel}.
4.  If the user asks for a plan, explain the plan suggested by Stockfish's top PV.
5.  Keep your answer concise (e.g., 3-5 sentences or a few bullet points) unless the question requires more detail.
6.  Use language and concepts appropriate for a ${playerLevel}:
    * Beginner: ${playerLevelConfig.beginner.gamePhases.opening} Focus on basic threats, material, simple piece activity.
    * Intermediate: ${playerLevelConfig.intermediate.gamePhases.middlegame} Include tactical patterns, positional elements like outposts or weak squares.
    * Advanced: ${playerLevelConfig.advanced.gamePhases.middlegame} Use precise evaluations and advanced strategic/tactical concepts.
7.  Relevant terms for ${playerLevel}: ${config.terms.slice(0, 4).join(', ')}.
8.  **Base your chess insights on the Stockfish analysis provided. Do not invent new lines or contradict Stockfish unless the user is asking to compare a move *not* in Stockfish's top lines.**`;
}

function createCheckmatePrompt(fen, winner, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  return `The game has ended in checkmate. ${winner} won.
Position FEN: ${fen}.
You are explaining this checkmate to a ${playerLevel} player.

Your Task:
1.  Briefly describe how the checkmate was delivered (key pieces involved, type of mating pattern if recognizable).
2.  What were the 1-2 critical mistakes by the losing side in the moves leading up to the checkmate?
3.  What could the losing side have done differently in the few moves before the mate to try and defend?
4.  What is the key learning point from this checkmate for a ${playerLevel} player? (e.g., king safety, recognizing mating patterns, importance of active pieces).
Focus on: ${playerLevel === 'beginner' ? 'basic piece coordination and king safety.' : playerLevel === 'intermediate' ? 'tactical patterns and defensive resources.' : 'complex tactical sequences and prophylactic thinking that could have prevented the mate.'}
Use terms like: ${config.terms.slice(0,4).join(', ')}.`;
}

function createGameReportPrompt(fen, evaluation, bestMoves, playerLevel, isCheckmate, winner) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);

  return `You are generating a concise game report summary for a ${playerLevel} based on the current FEN and Stockfish analysis.
Current Position FEN: ${fen}.
${isCheckmate ? `The game ended in checkmate. ${winner} won.` : `The game is in progress. Overall evaluation: ${evaluation}.`}
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  Provide a brief (1-2 sentences) overall assessment of the current position, considering the Stockfish evaluation and whose turn it is.
2.  **Based on Stockfish's Top PV**, what seems to be the main strategic or tactical direction of the game for the current player?
3.  Identify ONE key learning point or area for improvement for a ${playerLevel} player suggested by this position and Stockfish's analysis. (e.g., "Focus on activating your rooks on open files like in the PV", or "Notice how Stockfish's top line prioritizes king safety before launching an attack").
4.  Keep the report very brief and focused.
Terms for ${playerLevel}: ${config.terms.slice(0,4).join(', ')}.`;
}

function createSkillLevelPrompt(fen, evaluation, bestMoves, playerLevel) {
  const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
  const stockfishAnalysisSummary = formatBestMoves(bestMoves, evaluation);
  const gamePhase = determineGamePhase(fen); // Uses the corrected determineGamePhase

  return `You are a chess coach for a ${playerLevel} player.
Game Phase: ${gamePhase}.
Current Position FEN: ${fen}.
Stockfish Analysis (Top Lines):
${stockfishAnalysisSummary}

Your Task:
1.  Explain **Stockfish's Top Suggested Principal Variation (PV)**. What is the main idea behind this line of play?
2.  Connect this explanation to general chess principles relevant to a ${playerLevel} player in the current game phase:
    * Opening Focus: ${config.gamePhases.opening}
    * Middlegame Focus: ${config.gamePhases.middlegame}
    * Endgame Focus: ${config.gamePhases.endgame}
3.  Briefly mention the material balance using: ${config.pieceValues}.
4.  What is one key takeaway from Stockfish's top line that a ${playerLevel} can apply in their games?
5.  Use terms like: ${config.terms.slice(0, 5).join(', ')}.
6.  **Do not suggest your own moves. Explain Stockfish's rationale.** Make it educational and concise.`;
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