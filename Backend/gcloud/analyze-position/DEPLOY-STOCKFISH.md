# Deploying Analysis Functions to Google Cloud

Follow these steps to deploy both Stockfish and Gemini analysis services to Google Cloud.

## 1. Deploy the Cloud Run Service for Stockfish

First, deploy the Stockfish engine to Google Cloud Run:

```bash
# From the repo root
cd Backend/gcloud/stockfish-cloud-run
./deploy.sh
```

This will:
- Build and deploy the Docker container with Stockfish to Cloud Run
- Create the necessary proxy function files
- Output a service URL (make note of this)

## 2. Deploy the Cloud Functions

After the Cloud Run service is deployed, deploy the Cloud Functions:

```bash
# From the repo root 
cd Backend/gcloud/analyze-position

# Deploy Stockfish analysis function
npm run deploy-stockfish

# Deploy Gemini analysis function
gcloud functions deploy analyzeChessPosition \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated
```

## 3. Testing the Endpoints

The deployed Cloud Functions will be available at URLs like:
- `https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish`
- `https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition`

You can test them with curl:

```bash
# Test Stockfish endpoint
curl -X POST https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish \
  -H "Content-Type: application/json" \
  -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}'

# Test Gemini endpoint
curl -X POST https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition \
  -H "Content-Type: application/json" \
  -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "playerLevel": "advanced"}'
```

## Troubleshooting

If you encounter errors:

1. Check that the Cloud Run service deployed correctly:
   ```
   gcloud run services describe stockfish-analysis --region us-central1
   ```

2. Check the Cloud Function logs:
   ```
   gcloud functions logs read analyzeWithStockfish
   gcloud functions logs read analyzeChessPosition
   ```

3. Check CORS headers with an OPTIONS request:
   ```
   curl -X OPTIONS -v https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition \
     -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type"
   ```
   
   You should see `Access-Control-Allow-Origin: *` in the response headers.