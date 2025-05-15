const { VertexAI } = require('@google-cloud/vertexai');
const Busboy = require('busboy');
const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * Cloud Function to transcribe audio with Gemini API and incorporate chess context
 * 
 * @param {Object} req - HTTP request object
 * @param {Object} res - HTTP response object
 */
exports.transcribeAudioWithGemini = async (req, res) => {
  // Set CORS headers for preflight requests
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }
  
  // Log request source
  const userAgent = req.headers['user-agent'] || 'Unknown';
  console.log(`Handling audio transcription request from: ${userAgent}`);
  
  try {
    // Process multipart form data (audio file)
    console.log('Starting to parse form data...');
    const { audioFilePath, fields } = await parseFormData(req);
    
    if (!audioFilePath) {
      console.error('No audio file received in request');
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    // Check file size
    try {
      const stats = fs.statSync(audioFilePath);
      console.log(`Audio file received: ${audioFilePath} (${stats.size} bytes)`);
      
      if (stats.size < 1000) {
        console.error('Audio file too small to process');
        return res.status(400).json({ error: 'Audio file too small or empty. Please try recording again.' });
      }
    } catch (statErr) {
      console.error('Error checking audio file:', statErr);
      return res.status(400).json({ error: 'Error validating audio file' });
    }
    
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
    let hasFileBeenProcessed = false;
    let processingError = null;
    
    try {
      const busboy = Busboy({ headers: req.headers });
      
      // Handle file uploads
      busboy.on('file', (fieldname, file, { filename, mimeType }) => {
        if (!filename) {
          console.warn('File received with no filename');
          file.resume(); // Skip the file
          return;
        }
        
        if (fieldname === 'audio') {
          hasFileBeenProcessed = true;
          const tmpdir = os.tmpdir();
          const safeFilename = filename.replace(/[^a-zA-Z0-9-_.]/g, '_');
          const filepath = path.join(tmpdir, `audio_${Date.now()}_${safeFilename}`);
          
          console.log(`Processing file upload: ${filename} (${mimeType})`);
          
          let fileSize = 0;
          
          // Create write stream
          const writeStream = fs.createWriteStream(filepath);
          
          // Track file size as it's being written
          file.on('data', (chunk) => {
            fileSize += chunk.length;
          });
          
          // Handle file data flow
          file.pipe(writeStream);
          
          writeStream.on('finish', () => {
            console.log(`File written to ${filepath} (${fileSize} bytes)`);
            audioFilePath = filepath;
          });
          
          writeStream.on('error', (err) => {
            console.error('Error writing file:', err);
            processingError = err;
          });
        } else {
          // Discard other file uploads
          console.log(`Skipping non-audio field: ${fieldname}`);
          file.resume();
        }
      });
      
      // Handle form fields
      busboy.on('field', (fieldname, value) => {
        console.log(`Received form field: ${fieldname}`);
        fields[fieldname] = value;
      });
      
      // Handle completion
      busboy.on('finish', () => {
        console.log('Busboy processing finished');
        
        if (processingError) {
          return reject(processingError);
        }
        
        if (!hasFileBeenProcessed) {
          console.warn('No file was processed by busboy');
        }
        
        // Give a small delay to ensure writeStream has finished
        setTimeout(() => {
          resolve({ audioFilePath, fields });
        }, 100);
      });
      
      // Handle errors
      busboy.on('error', (error) => {
        console.error('Busboy error:', error);
        reject(error);
      });
      
      // Feed data to busboy
      if (req.rawBody) {
        // For Cloud Functions environment
        console.log(`Processing rawBody (${req.rawBody.length} bytes)`);
        busboy.end(req.rawBody);
      } else {
        // For standard HTTP environment
        console.log('Piping request to busboy parser');
        req.pipe(busboy);
      }
    } catch (error) {
      console.error('Fatal error in parseFormData:', error);
      reject(error);
    }
  });
}