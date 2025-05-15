const express = require('express');
const cors = require('cors');
const { analyzeChessPosition, transcribeAudioWithGemini } = require('./index');

const app = express();
const port = process.env.PORT;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.post('/analyzeChessPosition', async (req, res) => {
    try {
        await analyzeChessPosition(req, res);
    } catch (error) {
        console.error('Error in /analyzeChessPosition endpoint:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.post('/transcribeAudioWithGemini', async (req, res) => {
     try {
        await transcribeAudioWithGemini(req, res);
    } catch (error) {
        console.error('Error in /transcribeAudioWithGemini endpoint:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error for audio' });
        }
    }
});

app.get('/', (req, res) => {
    res.status(200).send('Gemini Analysis Service for Enpassant is running.');
});

app.listen(port, '127.0.0.1', () => {
    console.log(`Gemini Analysis Service listening on port <span class="math-inline">\{port\} at http\://127\.0\.0\.1\:</span>{port}`);
});