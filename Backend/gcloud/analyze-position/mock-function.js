// Save as mock-function.js in Backend/gcloud/analyze-position folder
const functions = require('@google-cloud/functions-framework');

// Register the function
functions.http('mockAnalyzePosition', (req, res) => {
  // Set CORS headers for all response types
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Origin');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }

  try {
    console.log('Request received:', req.method);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    // Parse request body
    const { fen, playerLevel, evaluation, bestMoves } = req.body || {};
    
    // Static mock responses for different positions
    let explanation;
    
    if (fen && fen.includes('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) {
      // Starting position
      explanation = `This is the starting position of a chess game. 
      
As a ${playerLevel || 'beginner'} player, your main goals are:
1. Control the center of the board with pawns (e4 or d4 are strong first moves)
2. Develop your knights and bishops to active squares
3. Castle early to protect your king
4. Connect your rooks by moving the queen

White has the first move advantage. Common openings include 1.e4 (King's Pawn), 1.d4 (Queen's Pawn), or 1.Nf3 (Réti Opening).`;
    } 
    else if (fen && fen.includes('7k/1P6/8/8/8/8/8/K7')) {
      // White pawn promotion
      explanation = `This position shows a white pawn on the 7th rank about to promote.
      
As a ${playerLevel || 'beginner'} player, this is a critical moment:
1. Moving the pawn to b8 will allow promotion, typically to a queen
2. Promotion to a queen gives you a massive material advantage
3. After promotion, focus on checkmating the opponent's king
4. Be careful of stalemate positions - make sure the king has legal moves

This is a winning position for White with proper play.`;
    }
    else {
      // Generic response
      explanation = `Chess position analysis for ${fen || 'unknown position'}.
      
As a ${playerLevel || 'beginner'} player, here are key considerations:
1. Evaluate the material balance (${evaluation || 'equal material'})
2. Look for tactical opportunities and threats
3. Develop pieces toward the center
4. Consider pawn structure and king safety

${bestMoves ? 'Strong moves to consider: ' + JSON.stringify(bestMoves) : 'Focus on finding the best moves through calculation.'}`;
    }

    return res.status(200).json({
      explanation: explanation,
    });
  } catch (error) {
    console.error('Error:', error);
    // Set CORS headers even for error responses
    return res.status(500).json({ error: error.message });
  }
});