# Stockfish Analysis Service for Google Cloud Run

This service runs Stockfish chess engine in a Docker container on Google Cloud Run, enabling chess position analysis in the cloud.

## Architecture

The solution consists of two main components:

1. **Stockfish Analysis Service (Cloud Run)**: A Docker container running Stockfish with an Express.js API
2. **Analysis Function (Cloud Function)**: A lightweight proxy that forwards requests to the Cloud Run service

This separation allows the heavy computation (Stockfish analysis) to run on Cloud Run's scalable infrastructure, while keeping the API interface consistent.

## Prerequisites

- Google Cloud CLI (`gcloud`) installed and configured
- Docker installed (only needed if testing locally)
- Node.js and npm installed
- A Google Cloud project with billing enabled

## Deployment Steps

### 1. Deploy the Stockfish Service to Cloud Run

Run the deployment script:

```bash
cd Backend/gcloud/stockfish-cloud-run
./deploy.sh
```

This script will:
1. Build the Docker image and upload it to Google Container Registry
2. Deploy the service to Cloud Run
3. Create a `stockfish-client.js` file with the correct service URL

Note the Cloud Run service URL that is displayed after deployment.

### 2. Deploy the Stockfish Analysis Cloud Function

```bash
cd Backend/gcloud/analyze-position
npm install  # Install dependencies including node-fetch
npm run deploy-stockfish
```

### 3. Update your Frontend to use the Cloud Function

The frontend API client is already configured to use the Cloud Function, so it should work without changes once the Cloud Function is deployed.

## Testing the Deployment

You can test your deployment by running:

```bash
curl -X POST https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeWithStockfish \
  -H "Content-Type: application/json" \
  -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "depth": 15}'
```

Replace the URL with your actual Cloud Function URL.

## Local Development

To run the Stockfish analysis service locally (not recommended on M1 Macs due to architecture differences):

```bash
cd Backend/gcloud/stockfish-cloud-run
docker build -t stockfish-analysis-service .
docker run -p 8081:8080 stockfish-analysis-service
```

Then test with:

```bash
curl -X POST http://localhost:8081 \
  -H "Content-Type: application/json" \
  -d '{"fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "depth": 15}'
```

## Advantages of This Approach

1. **Scalability**: Cloud Run automatically scales based on load
2. **Cost Efficiency**: You only pay for what you use
3. **Architecture Independence**: Works on any device since computation happens in the cloud
4. **Performance**: Uses Google's infrastructure for fast analysis