const express = require('express');
const cors = require('cors');
const { analyzeChessPosition } = require('./index');

const app = express();
const port = process.env.PORT;
const host = process.env.HOST || '127.0.0.1'; 

console.log(port);

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

app.get('/', (req, res) => {
    res.status(200).send('Gemini Analysis Service for Enpassant is running.');
});

app.listen(port, host, () => {
    console.log(`Gemini Analysis Service listening on port ${port} at http://${host}:${port}`);
    if (host === '0.0.0.0') {
        console.log(`(Service is accessible on all interfaces within its container/environment)`);
    } else {
        console.log(`(Service is accessible only from ${host} within its environment)`);
    }
});