// Backend/gcloud/analyze-position/mock-function.js
const functions = require('@google-cloud/functions-framework');
const { Chess } = require('chess.js');

// Register the mock function
functions.http('mockAnalyzePosition', (req, res) => {
  // Set CORS headers
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
    
    // Parse request
    const { fen, playerLevel = 'beginner', analysisType = 'general' } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }
    
    // Validate FEN
    try {
      new Chess(fen);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid FEN position' });
    }
    
    // Generate mock explanation based on position
    const explanation = generateMockExplanation(fen, playerLevel, analysisType);
    
    return res.status(200).json({
      explanation,
      playerLevel,
      analysisType
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Generate a mock explanation based on the position and player level
function generateMockExplanation(fen, playerLevel, analysisType) {
  // Extract position part of FEN (everything before the first space)
  const positionPart = fen.split(' ')[0];
  
  // Check if it's a standard starting position
  if (positionPart === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') {
    return generateStartingPositionExplanation(playerLevel, analysisType);
  }
  
  // Check if it's a promotion position
  if (positionPart.includes('7k/1P6/8/8/8/8/8/K7')) {
    return generatePromotionExplanation(playerLevel, analysisType);
  }
  
  // Default generic explanation
  return generateGenericExplanation(fen, playerLevel, analysisType);
}

// Generate explanation for the starting position
function generateStartingPositionExplanation(playerLevel, analysisType) {
  if (playerLevel === 'beginner') {
    return `
This is the starting position of a chess game.

Key points for a beginner:
1. Control the center with pawns (e4 or d4 are strong first moves)
2. Develop your knights and bishops to active squares
3. Castle early to protect your king
4. Don't move the same piece multiple times in the opening

Good first moves include e4 (King's Pawn Opening), d4 (Queen's Pawn Opening), or Nf3 (Réti Opening).
    `;
  } else {
    return `
The starting position offers equal chances for both sides, but White has the advantage of the first move.

For an ${playerLevel} player:
1. Consider your opening repertoire goals - development, space, or preparing for a specific structure
2. Common first moves like e4 and d4 fight for central control, while Nf3, c4, or g3 can transpose into various systems
3. Your first few moves should establish your pawn structure intentions and rapid development

The position is objectively equal (0.0) but White's first move advantage provides initiative.
    `;
  }
}

// Generate explanation for a promotion position
function generatePromotionExplanation(playerLevel, analysisType) {
  if (analysisType === 'tactical') {
    return `
Tactical analysis of this promotion position:

This position features a white pawn on the 7th rank (b7) about to promote. This is a decisive tactical motif.

1. The tactic here is straightforward: push the pawn to b8 and promote to a queen
2. After promoting, you'll have a material advantage of 9 points (the value of a queen)
3. Be careful about creating stalemate - make sure the black king has legal moves after you promote

The evaluation is +9.8, clearly winning for White because of the imminent promotion.
    `;
  } else {
    return `
This position shows a white pawn on the 7th rank about to promote.

For a ${playerLevel} player:
1. Your immediate plan is to promote the pawn to a queen by playing b7-b8=Q
2. After promotion, you'll have a winning material advantage
3. Be careful not to create a stalemate - make sure the black king has legal moves
4. After promotion, use your queen to restrict the enemy king's movement, then deliver checkmate

This is a clearly winning position for White with proper play.
    `;
  }
}

// Generate a generic explanation for any position
function generateGenericExplanation(fen, playerLevel, analysisType) {
  try {
    const chess = new Chess(fen);
    const turn = chess.turn() === 'w' ? 'White' : 'Black';
    const inCheck = chess.isCheck() ? `${turn} is in check.` : '';
    
    if (analysisType === 'tactical') {
      return `
Tactical analysis of this position for a ${playerLevel} player:

${turn} to move. ${inCheck}

Looking at the tactical elements:
1. Check for immediate threats and tactical opportunities like pins, forks, or discovered attacks
2. Calculate forced sequences and ensure each move is safe before playing it
3. Be vigilant for your opponent's tactical possibilities

Without a full evaluation, focus on finding the most forcing moves - checks, captures, and threats - and calculate their consequences carefully.
      `;
    } else if (analysisType === 'educational') {
      return `
Educational analysis of this position for a ${playerLevel} player:

${turn} to move. ${inCheck}

This position teaches important chess principles:
1. Piece coordination is essential - make sure your pieces work together
2. Control of the center provides greater mobility and options
3. King safety should always be a priority, especially in the middlegame
4. Always look for active piece placement rather than passive positioning

Remember that chess is about balancing multiple factors: material, king safety, piece activity, and pawn structure.
      `;
    } else {
      return `
Analysis of this position for a ${playerLevel} player:

${turn} to move. ${inCheck}

Key considerations:
1. Assess the material balance and piece placement
2. Evaluate king safety for both sides
3. Look for active piece placement and potential improvements
4. Consider both immediate tactics and longer-term strategic goals

Without a detailed evaluation, focus on developing pieces to good squares, securing your king, and looking for tactical opportunities.
      `;
    }
  } catch (error) {
    return `
I couldn't fully analyze this position due to an error.

General chess advice for a ${playerLevel} player:
1. Focus on controlling the center
2. Develop your pieces to active squares
3. Keep your king safe, usually by castling
4. Look for tactical opportunities like pins, forks, and discovered attacks

Without seeing the specific position, these principles will help guide your decision-making.
    `;
  }
}