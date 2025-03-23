# Stockfish Analysis Service with Persistent Storage

This service runs Stockfish chess engine in a Docker container on Google Cloud Run with persistent storage using Firestore. It enables chess position analysis in the cloud with caching and popular openings library.

## Architecture

The solution consists of three main components:

1. **Stockfish Analysis Service (Cloud Run)**: A Docker container running Stockfish with an Express.js API
2. **Analysis Function (Cloud Function)**: A lightweight proxy that forwards requests to the Cloud Run service
3. **Firestore Database**: Persistent storage for caching analysis results and popular openings

This architecture allows for:
- Heavy computation (Stockfish analysis) to run on Cloud Run's scalable infrastructure
- Fast retrieval of previously analyzed positions from the persistent cache
- Preloading of popular openings for instant analysis
- Consistent API interface for frontend applications

## Prerequisites

- Google Cloud CLI (`gcloud`) installed and configured
- Docker installed (only needed if testing locally)
- Node.js and npm installed
- A Google Cloud project with billing enabled

## Deployment Steps

### 1. Deploy the Stockfish Service to Cloud Run with Persistent Storage

Run the enhanced deployment script:

```bash
cd Backend/gcloud/stockfish-cloud-run
./deploy.sh
```

This script will:
1. Set up a service account with Firestore permissions
2. Build the Docker image and upload it to Google Container Registry
3. Deploy the service to Cloud Run with the required environment variables
4. Create a `stockfish-client.js` file with the correct service URL
5. Set up status endpoints for retrieving cached analysis

Note the Cloud Run service URL that is displayed after deployment.

### 2. Deploy the Stockfish Analysis Cloud Functions

```bash
cd Backend/gcloud/analyze-position
npm install  # Install dependencies including node-fetch
gcloud functions deploy analyzeWithStockfish --runtime nodejs18 --trigger-http --allow-unauthenticated
gcloud functions deploy analyzeWithStockfishStatus --runtime nodejs18 --trigger-http --allow-unauthenticated
```

### 3. Initialize Popular Openings (Optional)

The deployment process automatically initializes the popular openings collection. If you want to add more openings later:

```bash
# Set your admin API key in environment
export ADMIN_API_KEY=your-secure-key-here

# Add popular openings
curl -X POST https://your-service-url/admin/popular-openings \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ADMIN_API_KEY" \
  -d @popular-openings.json
```

### 4. Update your Frontend to use the Cloud Functions

The frontend API client is already configured to use the Cloud Functions, so it should work without changes once they're deployed. The caching system will automatically speed up repeated analysis requests.

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
2. **Cost Efficiency**: You only pay for what you use, and caching reduces computation needs
3. **Architecture Independence**: Works on any device since computation happens in the cloud
4. **Performance**: Uses Google's infrastructure for fast analysis with cached results
5. **Persistence**: Analysis results are stored permanently and reused across sessions
6. **Educational Value**: Popular openings are available instantly for study and learning
7. **Progressive Updates**: Provides incremental analysis results for responsive UI feedback