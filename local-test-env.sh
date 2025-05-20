#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
GEMINI_BACKEND_DIR="$BASE_DIR/Backend/gcloud/analyze-position" # Corrected path

DOCKER_COMPOSE_FILE="$BASE_DIR/docker-compose.local-gemini-only.yml" # New name for clarity

echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}=== Enpassant Local Gemini Backend Test Environment Setup  ===${NC}"
echo -e "${BLUE}============================================================${NC}"

section() {
  echo -e "\n${YELLOW}>>> $1${NC}\n"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

check_tools() {
  section "Checking required tools..."
  local missing_tools=0
  for tool in docker docker-compose node npm; do # node/npm for Dockerfile if needed by gemini service
    if ! command_exists $tool; then
      echo -e "${RED}Error: $tool is not installed or not in PATH${NC}"
      missing_tools=1
    else
      echo -e "${GREEN}✓ $tool found${NC}"
    fi
  done
  if [ $missing_tools -eq 1 ]; then
    echo -e "${RED}Please install the missing tools and try again.${NC}"
    exit 1
  fi
}

create_docker_compose_local_for_gemini_backend() {
  section "Ensuring Docker Compose configuration for local Gemini backend testing..."
  
  echo "Creating/Overwriting $DOCKER_COMPOSE_FILE for Gemini backend service..."
  cat > "$DOCKER_COMPOSE_FILE" << EOF
version: '3.8'

services:
  gemini-analysis-service:
    build:
      context: ./Backend/gcloud/analyze-position
      dockerfile: Dockerfile.dev 
    platform: linux/amd64 
    ports:
      - "8081:8081" 
    volumes:
      - ./Backend/gcloud/analyze-position:/app 
      - /app/node_modules
      - ~/.gcp-keys/enpassant-local-dev-key.json:/app/gcp-key.json:ro
    environment:
      - PORT=8081
      - HOST=0.0.0.0 
      - GOOGLE_CLOUD_PROJECT=enpassant-459102
      - GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
    restart: unless-stopped
EOF
  echo -e "${GREEN}✓ Created local Docker Compose file for Gemini backend: $DOCKER_COMPOSE_FILE${NC}"
}

create_gemini_backend_dockerfile_if_needed() {
  section "Ensuring Gemini backend development Dockerfile exists..."

  local gemini_df="$GEMINI_BACKEND_DIR/Dockerfile.dev"
  echo "Generating/Overwriting $gemini_df for amd64 build..."
  cat > "$gemini_df" << 'EOF'
FROM --platform=linux/amd64 node:18-slim 

WORKDIR /app

COPY package.json package-lock.json* ./
# Clean install if targeting different arch than host
RUN rm -rf node_modules && rm -f package-lock.json && npm install --include=optional

COPY . .

EXPOSE 8081
# This should match the start script in your analyze-position/package.json
CMD ["node", "gemini-server.js"] 
EOF
  echo -e "${GREEN}✓ Created/Updated Gemini Backend dev Dockerfile (for amd64).${NC}"
}

start_gemini_backend_service() {
  section "Building and Starting Local Gemini Backend Service with Docker Compose..."
  if docker-compose -f "$DOCKER_COMPOSE_FILE" up --build -d; then
    echo -e "${GREEN}✓ Local Gemini backend service started successfully!${NC}"
    echo -e "\nGemini backend service is available at:"
    echo -e "  Gemini API:    ${BLUE}http://localhost:8081${NC}"
    echo -e "\nTo view backend logs: ${YELLOW}docker-compose -f \"$DOCKER_COMPOSE_FILE\" logs -f${NC}"
    echo -e "To stop backend services: ${YELLOW}docker-compose -f \"$DOCKER_COMPOSE_FILE\" down${NC}"
  else
    echo -e "${RED}Failed to start Docker Compose services for Gemini backend. Check for errors above.${NC}"
    exit 1
  fi
}

stop_gemini_backend_service() {
  section "Stopping Local Gemini Backend Service..."
  if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    if docker-compose -f "$DOCKER_COMPOSE_FILE" down; then
      echo -e "${GREEN}✓ Local Gemini backend service stopped.${NC}"
    else
      echo -e "${RED}Error stopping Gemini backend Docker Compose services.${NC}"
    fi
  else
    echo -e "${YELLOW}No local Docker Compose file ($DOCKER_COMPOSE_FILE) found to stop services.${NC}"
  fi
}

# --- Main Script Logic ---
if [[ "$1" == "stop" ]]; then
  stop_gemini_backend_service
  exit 0
fi

check_tools
create_docker_compose_local_for_gemini_backend
create_gemini_backend_dockerfile_if_needed
start_gemini_backend_service

echo -e "\n${GREEN}Local Gemini backend setup complete. Service should be running.${NC}"
echo -e "Now, navigate to your ${YELLOW}Frontend${NC} directory and run ${BLUE}npm run dev${NC} manually."
echo -e "Ensure your Frontend/.env.local (or similar) points to:"
echo -e "  VITE_GEMINI_URL=http://localhost:8081/analyzeChessPosition"
# VITE_STOCKFISH_URL and VITE_AUDIO_URL are for client-side or removed
echo -e "  (VITE_STOCKFISH_URL is not needed for client-side Stockfish)"
echo -e "  (VITE_AUDIO_URL is not needed if audio transcription is fully client-side)"
echo -e "\nTest your changes thoroughly by accessing the frontend."