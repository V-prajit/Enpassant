#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project base directory
BASE_DIR="$(pwd)"
FRONTEND_DIR="$BASE_DIR/Frontend"
BACKEND_DIR="$BASE_DIR/Backend"

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}=== Enigma Chess App Deployment Script              ===${NC}"
echo -e "${BLUE}========================================================${NC}"

# Function to display section headers
section() {
  echo -e "\n${YELLOW}>>> $1${NC}\n"
}

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check for required tools
section "Checking required tools..."

MISSING_TOOLS=0
for tool in npm node gcloud docker; do
  if ! command_exists $tool; then
    echo -e "${RED}Error: $tool is not installed or not in PATH${NC}"
    MISSING_TOOLS=1
  else
    echo -e "${GREEN}✓ $tool found${NC}"
  fi
done

if [ $MISSING_TOOLS -eq 1 ]; then
  echo -e "${RED}Please install the missing tools and try again.${NC}"
  exit 1
fi

# Ensure Google Cloud is properly authenticated
section "Checking Google Cloud authentication..."

GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ -z "$GCLOUD_PROJECT" ]; then
  echo -e "${RED}No Google Cloud project is set. Please run:${NC}"
  echo "gcloud config set project YOUR_PROJECT_ID"
  echo "gcloud auth login"
  exit 1
else
  echo -e "${GREEN}✓ Using Google Cloud project: $GCLOUD_PROJECT${NC}"
fi

# Build and deploy Stockfish Cloud Run service
deploy_stockfish_service() {
  section "Building and deploying Stockfish Cloud Run service..."
  
  cd "$BACKEND_DIR/gcloud/stockfish-cloud-run"
  
  # Check if deployment script exists
  if [ -f "./deploy.sh" ]; then
    echo "Using existing deployment script..."
    chmod +x ./deploy.sh
    ./deploy.sh
  else
    # Build the Docker image
    IMAGE_NAME="stockfish-analysis-service"
    TAG="$(date +%Y%m%d-%H%M%S)"
    FULL_IMAGE_NAME="gcr.io/$GCLOUD_PROJECT/$IMAGE_NAME:$TAG"
    
    echo "Building Docker image: $FULL_IMAGE_NAME"
    docker build -t $FULL_IMAGE_NAME .
    
    # Push to Google Container Registry
    echo "Pushing to Google Container Registry..."
    docker push $FULL_IMAGE_NAME
    
    # Deploy to Cloud Run
    echo "Deploying to Cloud Run..."
    gcloud run deploy stockfish-analysis-service \
      --image $FULL_IMAGE_NAME \
      --platform managed \
      --region us-central1 \
      --memory 2Gi \
      --cpu 2 \
      --allow-unauthenticated
  fi
  
  # Get the service URL
  STOCKFISH_URL=$(gcloud run services describe stockfish-analysis-service --platform managed --region us-central1 --format="value(status.url)")
  echo -e "${GREEN}✓ Stockfish service deployed at: $STOCKFISH_URL${NC}"
  
  # Return to base directory
  cd "$BASE_DIR"
}

# Deploy analyze-position Cloud Function
deploy_analyze_position() {
  section "Deploying analyze-position Cloud Function..."
  
  cd "$BACKEND_DIR/gcloud/analyze-position"
  
  # Ensure dependencies are installed
  echo "Installing dependencies..."
  npm ci || npm install
  
  # Deploy the function
  echo "Deploying Cloud Function..."
  gcloud functions deploy analyzeChessPosition \
    --runtime nodejs18 \
    --trigger-http \
    --allow-unauthenticated \
    --timeout=300s \
    --memory=1024MB
  
  # Get the function URL
  ANALYZE_URL=$(gcloud functions describe analyzeChessPosition --format="value(httpsTrigger.url)")
  echo -e "${GREEN}✓ Analyze position function deployed at: $ANALYZE_URL${NC}"
  
  # Return to base directory
  cd "$BASE_DIR"
}

# Update API URLs in frontend config
update_frontend_config() {
  section "Updating frontend configuration with API URLs..."
  
  # Get the service URLs
  STOCKFISH_URL=$(gcloud run services describe stockfish-analysis-service --platform managed --region us-central1 --format="value(status.url)" 2>/dev/null || echo "")
  ANALYZE_URL=$(gcloud functions describe analyzeChessPosition --format="value(httpsTrigger.url)" 2>/dev/null || echo "")
  
  if [ -z "$STOCKFISH_URL" ] || [ -z "$ANALYZE_URL" ]; then
    echo -e "${RED}Could not retrieve service URLs. Skipping frontend config update.${NC}"
    return
  fi
  
  # Update the frontend API config
  API_FILE="$FRONTEND_DIR/src/services/api.js"
  
  if [ -f "$API_FILE" ]; then
    echo "Updating $API_FILE with service URLs..."
    
    # Create a backup
    cp "$API_FILE" "$API_FILE.bak"
    
    # Update the URLs in the file
    sed -i.tmp "s|const GEMINI_URL = '.*'|const GEMINI_URL = '$ANALYZE_URL'|g" "$API_FILE"
    sed -i.tmp "s|const STOCKFISH_URL = '.*'|const STOCKFISH_URL = '$STOCKFISH_URL'|g" "$API_FILE"
    
    # Clean up temp files
    rm -f "$API_FILE.tmp"
    
    echo -e "${GREEN}✓ Frontend API configuration updated${NC}"
  else
    echo -e "${RED}Frontend API file not found at $API_FILE${NC}"
  fi
}

# Build and deploy frontend
deploy_frontend() {
  section "Building and deploying frontend..."
  
  cd "$FRONTEND_DIR"
  
  # Install dependencies
  echo "Installing frontend dependencies..."
  npm ci || npm install
  
  # Build the frontend
  echo "Building frontend..."
  npm run build
  
  # Check if we're deploying via Docker or static hosting
  if [ -f "./Dockerfile" ]; then
    # Deploy using Docker and Cloud Run
    IMAGE_NAME="enigma-frontend"
    TAG="$(date +%Y%m%d-%H%M%S)"
    FULL_IMAGE_NAME="gcr.io/$GCLOUD_PROJECT/$IMAGE_NAME:$TAG"
    
    echo "Building frontend Docker image: $FULL_IMAGE_NAME"
    docker build -t $FULL_IMAGE_NAME .
    
    # Push to Google Container Registry
    echo "Pushing to Google Container Registry..."
    docker push $FULL_IMAGE_NAME
    
    # Deploy to Cloud Run
    echo "Deploying frontend to Cloud Run..."
    gcloud run deploy enigma-frontend \
      --image $FULL_IMAGE_NAME \
      --platform managed \
      --region us-central1 \
      --memory 512Mi \
      --cpu 1 \
      --allow-unauthenticated
    
    # Get the service URL
    FRONTEND_URL=$(gcloud run services describe enigma-frontend --platform managed --region us-central1 --format="value(status.url)")
    echo -e "${GREEN}✓ Frontend deployed at: $FRONTEND_URL${NC}"
  else
    # Deploy to Firebase Hosting or similar static hosting
    echo -e "${YELLOW}Static hosting deployment not implemented in this script.${NC}"
    echo -e "${YELLOW}Please deploy the 'dist' directory to your preferred static hosting.${NC}"
  fi
  
  # Return to base directory
  cd "$BASE_DIR"
}

# Main deployment flow
main() {
  # Ask user what to deploy
  echo -e "\n${BLUE}What would you like to deploy?${NC}"
  echo "1) Everything (Backend + Frontend)"
  echo "2) Backend only (Cloud Functions + Cloud Run)"
  echo "3) Frontend only"
  echo "4) Just update frontend config with existing backend URLs"
  echo "5) Exit"
  
  read -p "Enter your choice (1-5): " CHOICE
  
  case $CHOICE in
    1)
      deploy_stockfish_service
      deploy_analyze_position
      update_frontend_config
      deploy_frontend
      ;;
    2)
      deploy_stockfish_service
      deploy_analyze_position
      ;;
    3)
      update_frontend_config
      deploy_frontend
      ;;
    4)
      update_frontend_config
      ;;
    5)
      echo "Exiting..."
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid choice. Please enter a number between 1 and 5.${NC}"
      main
      ;;
  esac
  
  echo -e "\n${GREEN}=== Deployment completed successfully! ===${NC}"
  
  # Print deployed URLs
  STOCKFISH_URL=$(gcloud run services describe stockfish-analysis-service --platform managed --region us-central1 --format="value(status.url)" 2>/dev/null || echo "Not deployed")
  ANALYZE_URL=$(gcloud functions describe analyzeChessPosition --format="value(httpsTrigger.url)" 2>/dev/null || echo "Not deployed")
  FRONTEND_URL=$(gcloud run services describe enigma-frontend --platform managed --region us-central1 --format="value(status.url)" 2>/dev/null || echo "Not deployed")
  
  echo -e "\n${BLUE}Deployed services:${NC}"
  echo -e "- Stockfish Service: ${GREEN}$STOCKFISH_URL${NC}"
  echo -e "- Analyze Position Function: ${GREEN}$ANALYZE_URL${NC}"
  echo -e "- Frontend: ${GREEN}$FRONTEND_URL${NC}"
}

# Run the main function
main