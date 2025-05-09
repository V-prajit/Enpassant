#!/bin/bash
set -e

echo "Building and deploying Stockfish Analysis Service with persistent storage..."

PROJECT_ID="enpassant-459102"
SERVICE_NAME="stockfish-analysis"
REGION="us-central1"
IMAGE_NAME="stockfish-analysis-service"

gcloud config set project $PROJECT_ID

BUCKET_NAME="${PROJECT_ID}-chess-analysis"
echo "Setting up Cloud Storage bucket: $BUCKET_NAME"

if gsutil ls -b gs://$BUCKET_NAME > /dev/null 2>&1; then
  echo "Bucket $BUCKET_NAME already exists"
else
  echo "Creating bucket $BUCKET_NAME..."
  gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME
  gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
fi

echo "Building container image..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/$IMAGE_NAME .

echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image gcr.io/$PROJECT_ID/$IMAGE_NAME \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 40 \
  --timeout 300s \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=$PROJECT_ID"

SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --platform managed --region $REGION --format 'value(status.url)')
echo "Deployment complete! Service URL: $SERVICE_URL"

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

// Add support for getting cached analysis status
exports.analyzeWithStockfishStatus = async (req, res) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.set('Access-Control-Max-Age', '3600');
    return res.status(204).send('');
  }

  try {
    const fen = req.params.fen;
    const minDepth = req.query.minDepth || 1;
    
    if (!fen) {
      return res.status(400).json({ error: 'FEN position is required' });
    }

    console.log(\`Checking cached analysis for: \${fen} at min depth \${minDepth}\`);
    
    // Forward the request to the Stockfish service status endpoint
    const response = await fetch(\`\${STOCKFISH_SERVICE_URL}/status/\${encodeURIComponent(fen)}?minDepth=\${minDepth}\`);

    if (!response.ok) {
      if (response.status === 404) {
        return res.status(404).json({ error: 'No cached analysis found' });
      }
      
      const errorText = await response.text();
      throw new Error(\`Stockfish service error: \${response.status} \${errorText}\`);
    }

    const analysisResult = await response.json();
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

# Preload popular openings data
echo "Preloading popular openings data..."
curl -X GET $SERVICE_URL

echo ""
echo "Next steps:"
echo "1. Update your analyze-with-stockfish Cloud Function with the new stockfish-client.js file"
echo "2. Deploy your Cloud Functions using:"
echo "   gcloud functions deploy analyzeWithStockfish --runtime nodejs18 --trigger-http --allow-unauthenticated"
echo "   gcloud functions deploy analyzeWithStockfishStatus --runtime nodejs18 --trigger-http --allow-unauthenticated"
echo ""
echo "Your Stockfish analysis with permanent storage is now running in the cloud!"