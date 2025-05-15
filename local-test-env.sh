#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# FRONTEND_DIR="$BASE_DIR/Frontend" # Not directly managed by this script anymore for Docker
BACKEND_DIR="$BASE_DIR/Backend"
STOCKFISH_BACKEND_DIR="$BACKEND_DIR/gcloud/stockfish-cloud-run"
GEMINI_BACKEND_DIR="$BACKEND_DIR/gcloud/analyze-position"

DOCKER_COMPOSE_FILE="$BASE_DIR/docker-compose.local.yml"

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}=== Enpassant Local Backend Test Environment Setup     ===${NC}"
echo -e "${BLUE}========================================================${NC}"

section() {
  echo -e "\n${YELLOW}>>> $1${NC}\n"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

check_tools() {
  section "Checking required tools..."
  local missing_tools=0
  # Removed npm and node from here as frontend will be run manually, 
  # but Docker images will still need them internally.
  # Docker and docker-compose are the primary tools for this script now.
  for tool in docker docker-compose node npm; do # Keep node/npm for Dockerfile creation checks if any
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

create_docker_compose_local_for_backend() {
  section "Ensuring Docker Compose configuration for local backend testing..."
  
  # Always overwrite to ensure the latest backend-only configuration
  echo "Creating/Overwriting $DOCKER_COMPOSE_FILE for backend services..."
  cat > "$DOCKER_COMPOSE_FILE" << EOF
version: '3.8'

services:
  stockfish-service:
    build: 
      context: ./Backend/gcloud/stockfish-cloud-run 
      dockerfile: Dockerfile # This is the one you manually ensure is for amd64
    platform: linux/amd64 # Explicitly run as amd64 via Rosetta
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
    volumes:
      - ./Backend/gcloud/stockfish-cloud-run:/app # Mount for potential code changes if server reloads
      - stockfish_analysis_cache:/app/analysis-cache
      - stockfish_tmp_cache:/app/tmp-cache
    restart: unless-stopped

  gemini-analysis-service:
    build:
      context: ./Backend/gcloud/analyze-position
      dockerfile: Dockerfile.dev 
    platform: linux/amd64 # Run Gemini backend as amd64 via Rosetta
    ports:
      - "8081:8081" 
    volumes:
      - ./Backend/gcloud/analyze-position:/app # Mount for potential code changes
      # Ensure this path is correct for your local machine where you store the key
      - ~/.gcp-keys/enpassant-local-dev-key.json:/app/gcp-key.json:ro
    environment:
      - PORT=8081
      - STOCKFISH_URL=http://stockfish-service:8080 # Docker internal DNS
      - GOOGLE_CLOUD_PROJECT=enpassant-459102 # Or your GCP project
      - GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json
    depends_on:
      - stockfish-service
    restart: unless-stopped

volumes: 
  stockfish_analysis_cache:
  stockfish_tmp_cache:

EOF
  echo -e "${GREEN}✓ Created local Docker Compose file for backend: $DOCKER_COMPOSE_FILE${NC}"
}

create_backend_dockerfiles_if_needed() {
  section "Ensuring backend development Dockerfiles exist..."

  # Gemini Backend Dockerfile.dev
  local gemini_df="$GEMINI_BACKEND_DIR/Dockerfile.dev"
  # Always regenerate this Dockerfile to ensure it uses the amd64 platform with slim
  echo "Generating/Overwriting $gemini_df for amd64 build..."
  cat > "$gemini_df" << 'EOF'
FROM --platform=linux/amd64 node:18-slim # Use slim for glibc, build for amd64

WORKDIR /app

COPY package.json package-lock.json* ./
# Clean install to avoid issues with host-generated lock files when targeting different arch
RUN rm -rf node_modules && rm -f package-lock.json && npm install --include=optional

COPY . .

EXPOSE 8081
CMD ["node", "gemini-server.js"] 
EOF
  echo -e "${GREEN}✓ Created/Updated Gemini Backend dev Dockerfile (for amd64).${NC}"


  # Stockfish Backend Dockerfile (Actual one needs manual setup for x86-64 compilation)
  local stockfish_df_path="$STOCKFISH_BACKEND_DIR/Dockerfile"
  if [ ! -f "$stockfish_df_path" ]; then
    echo -e "${RED}CRITICAL: Main Dockerfile for Stockfish service ($stockfish_df_path) not found!${NC}"
    echo "This script WILL NOT create the complex Stockfish compilation Dockerfile."
    echo "Please ensure you have a Dockerfile at '$stockfish_df_path' that:"
    echo "1. Starts with: FROM --platform=linux/amd64 node:18-slim (or similar glibc image)"
    echo "2. Installs build-essential, make, g++, git."
    echo "3. Clones Stockfish and compiles it using 'make ARCH=x86-64-avx2'."
    echo "4. Copies the compiled Stockfish binary to a known location (e.g., /usr/local/bin/)."
    echo "5. Sets up and runs your Node.js server (server.js) for the Stockfish API."
    exit 1 
  else
    echo -e "${GREEN}Stockfish Backend Dockerfile already exists at $stockfish_df_path.${NC}"
    if ! grep -q "FROM --platform=linux/amd64" "$stockfish_df_path"; then
      echo -e "${RED}CRITICAL WARNING: $stockfish_df_path does NOT specify 'FROM --platform=linux/amd64...'!${NC}"
      echo -e "${YELLOW}The Stockfish service will likely fail to build the correct x86-64 binary or run correctly on your M1 Mac for x64 targeting.${NC}"
      echo -e "${YELLOW}Please MANUALLY edit it to include '--platform=linux/amd64' in its FROM line.${NC}"
    else
      echo -e "${GREEN}✓ Stockfish Backend Dockerfile appears to specify '--platform=linux/amd64'. Ensure the rest of its content is correct for x86-64 compilation.${NC}"
    fi
  fi
}

start_backend_services() {
  section "Building and Starting Local Backend Services with Docker Compose..."
  if docker-compose -f "$DOCKER_COMPOSE_FILE" up --build -d; then
    echo -e "${GREEN}✓ Local backend services started successfully!${NC}"
    echo -e "\nBackend services are available at:"
    echo -e "  Gemini API:    ${BLUE}http://localhost:8081${NC}"
    echo -e "  Stockfish API: ${BLUE}http://localhost:8080${NC}"
    echo -e "\nTo view backend logs: ${YELLOW}docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f${NC}"
    echo -e "To stop backend services: ${YELLOW}docker-compose -f "$DOCKER_COMPOSE_FILE" down${NC}"
  else
    echo -e "${RED}Failed to start Docker Compose services for backend. Check for errors above.${NC}"
    exit 1
  fi
}

stop_backend_services() {
  section "Stopping Local Backend Services..."
  if [ -f "$DOCKER_COMPOSE_FILE" ]; then
    if docker-compose -f "$DOCKER_COMPOSE_FILE" down; then
      echo -e "${GREEN}✓ Local backend services stopped.${NC}"
    else
      echo -e "${RED}Error stopping backend Docker Compose services.${NC}"
    fi
  else
    echo -e "${YELLOW}No local Docker Compose file ($DOCKER_COMPOSE_FILE) found to stop services.${NC}"
  fi
}

# --- Main Script Logic ---
if [[ "$1" == "stop" ]]; then
  stop_backend_services
  exit 0
fi

check_tools
# lint_code function removed as frontend is run manually
create_docker_compose_local_for_backend # Renamed function
create_backend_dockerfiles_if_needed    # Renamed and modified function
start_backend_services                 # Renamed function

echo -e "\n${GREEN}Local backend setup complete. Services should be running.${NC}"
echo -e "Now, navigate to your ${YELLOW}Frontend${NC} directory and run ${BLUE}npm run dev${NC} manually."
echo -e "Ensure your Frontend/.env.local (or similar) points to:"
echo -e "  VITE_GEMINI_URL=http://localhost:8081"
echo -e "  VITE_STOCKFISH_URL=http://localhost:8080"
echo -e "  VITE_AUDIO_URL=http://localhost:8081" # Or as appropriate
echo -e "\nTest your changes thoroughly by accessing the frontend, which will connect to these local backend services."
echo -e "Once satisfied, commit your changes and push to GitHub to trigger deployment pipelines."