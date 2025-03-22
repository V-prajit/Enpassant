# Deploying Stockfish Analysis to Google Cloud

Follow these steps to deploy the Stockfish analysis service to Google Cloud.

## 1. Deploy the Cloud Run Service

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

## 2. Deploy the Cloud Function

After the Cloud Run service is deployed, deploy the Cloud Function that will act as a proxy:

```bash
# From the repo root 
cd Backend/gcloud/analyze-position
npm run deploy-stockfish
```

## 3. Update Frontend API URL (if needed)

The deployed Cloud Function will be available at a URL like:
`https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish`

Your frontend should already be configured to use this URL, but you can double-check by looking at:
`Frontend/src/services/api.js`

## Testing

After deployment, your frontend application should be able to use the cloud-based Stockfish analysis. The analysis will now be running on Google Cloud rather than your local machine, solving the M1 Mac compatibility issue.

## Troubleshooting

If you encounter errors:

1. Check that the Cloud Run service deployed correctly:
   ```
   gcloud run services describe stockfish-analysis --region us-central1
   ```

2. Check the Cloud Function logs:
   ```
   gcloud functions logs read analyzeWithStockfish
   ```

3. Test the endpoint directly:
   ```
   curl -X POST https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish \
     -H "Content-Type: application/json" \
     -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"}'
   ```