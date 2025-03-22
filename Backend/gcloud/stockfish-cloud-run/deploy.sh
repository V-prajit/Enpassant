#!/bin/bash
set -e

# Configuration
PROJECT_ID="tidal-hack25tex-223"  # Your Google Cloud project ID
SERVICE_NAME="stockfish-analysis"
REGION="us-central1"
IMAGE_NAME="stockfish-analysis-service"

echo "Building and deploying Stockfish Analysis service to Google Cloud Run..."

# Build the container image
echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$IMAGE_NAME .

# Deploy to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --concurrency 40 \
  --timeout 300s

# Get the service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Deployment complete! Service URL: $SERVICE_URL"

# Update the stockfish-analysis function to call the Cloud Run service
echo "Updating analyze-with-stockfish function..."
cd ../analyze-position
mkdir -p function-source
cat > function-source/index.js << EOL
// stockfish-client.js
const fetch = require('node-fetch');

const STOCKFISH_SERVICE_URL = '$SERVICE_URL';

exports.analyzeWithStockfish = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    const { fen, depth = 30 } = req.body || {};
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    console.log(\`Sending position to Stockfish service: \${fen} at depth \${depth}\`);
    
    // Forward the request to the Stockfish service
    const response = await fetch(STOCKFISH_SERVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fen, depth }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(\`Stockfish service error: \${response.status} \${errorText}\`);
    }

    const analysisResult = await response.json();
    console.log('Analysis complete:', analysisResult);
    
    return res.status(200).json(analysisResult);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
EOL

cat > function-source/package.json << EOL
{
  "name": "stockfish-client",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "node-fetch": "^2.6.9"
  }
}
EOL

echo ""
echo "Next steps:"
echo "1. Update your analyze-with-stockfish Cloud Function with the new stockfish-client.js file"
echo "2. Deploy your Cloud Function using:"
echo "   gcloud functions deploy analyzeWithStockfish --runtime nodejs18 --trigger-http --allow-unauthenticated"
echo ""
echo "Your Stockfish analysis should now be running entirely in the cloud!"