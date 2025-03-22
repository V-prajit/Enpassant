// Backend/gcloud/analyze-position/player-levels.js

// Configuration for different player skill levels
const playerLevelConfig = {
    beginner: {
      concepts: ['piece development', 'controlling the center', 'basic tactics', 'king safety'],
      complexity: 'low',
      terms: ['attack', 'defend', 'protect', 'capture', 'threat'],
      avoidTerms: ['zugzwang', 'prophylaxis', 'pawn structure subtleties']
    },
    intermediate: {
      concepts: ['pawn structure', 'piece coordination', 'tactical patterns', 'initiative'],
      complexity: 'medium',
      terms: ['pin', 'fork', 'discovered attack', 'overloaded piece', 'tempo'],
      avoidTerms: ['deep endgame theory']
    },
    advanced: {
      concepts: ['positional play', 'strategic planning', 'piece imbalances', 'prophylaxis'],
      complexity: 'high',
      terms: ['counterplay', 'compensation', 'initiative', 'weak squares', 'pawn breaks'],
      avoidTerms: []
    }
  };
  
  // Create a prompt tailored to the player's skill level
  function createSkillLevelPrompt(fen, evaluation, bestMoves, playerLevel) {
    const config = playerLevelConfig[playerLevel] || playerLevelConfig.beginner;
    
    return `
    As a chess coach for a ${playerLevel} player, analyze this position:
    
    FEN: ${fen}
    Stockfish evaluation: ${evaluation || 'Not available'}
    Best moves: ${formatBestMoves(bestMoves)}
    
    Provide a clear explanation focusing on:
    1. The key elements in this position appropriate for a ${playerLevel} (${config.complexity} complexity)
    2. Why Stockfish's recommended move is good and what it accomplishes
    3. What the player should watch out for
    4. One specific concept to learn from this position: focus on ${config.concepts.join(', ')}
    
    Use language appropriate for a ${playerLevel} player. Use these chess terms freely: ${config.terms.join(', ')}.
    ${config.avoidTerms.length > 0 ? `Avoid these advanced concepts: ${config.avoidTerms.join(', ')}.` : ''}
    
    Keep your explanation concise and educational.
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
  
  module.exports = {
    createSkillLevelPrompt,
    playerLevelConfig
  };