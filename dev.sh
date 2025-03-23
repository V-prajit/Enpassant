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
echo -e "${BLUE}=== Enigma Chess App Local Development Script        ===${NC}"
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
for tool in npm node docker docker-compose; do
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

# Create Docker Compose file if it doesn't exist
create_docker_compose() {
  section "Setting up Docker Compose configuration..."
  
  COMPOSE_FILE="$BASE_DIR/docker-compose.yml"
  
  if [ -f "$COMPOSE_FILE" ]; then
    echo -e "${GREEN}Docker Compose file already exists at $COMPOSE_FILE${NC}"
    return
  fi
  
  cat > "$COMPOSE_FILE" << 'EOF'
version: '3'

services:
  stockfish-service:
    build: 
      context: ./Backend/gcloud/stockfish-cloud-run
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
    volumes:
      - ./Backend/gcloud/stockfish-cloud-run/analysis-cache:/app/analysis-cache
      - ./Backend/gcloud/stockfish-cloud-run/tmp-cache:/app/tmp-cache
    restart: unless-stopped

  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./Frontend:/app
      - /app/node_modules
    environment:
      - VITE_STOCKFISH_URL=http://localhost:8080
      - VITE_GEMINI_URL=http://localhost:8081/analyzeChessPosition
    depends_on:
      - stockfish-service
    restart: unless-stopped

  analyze-position:
    build:
      context: ./Backend/gcloud/analyze-position
      dockerfile: Dockerfile.dev
    ports:
      - "8081:8081"
    volumes:
      - ./Backend/gcloud/analyze-position:/app
      - /app/node_modules
    environment:
      - PORT=8081
      - STOCKFISH_URL=http://stockfish-service:8080
    depends_on:
      - stockfish-service
    restart: unless-stopped
EOF

  echo -e "${GREEN}✓ Created Docker Compose file at $COMPOSE_FILE${NC}"
}

# Create development Dockerfiles if they don't exist
create_dev_dockerfiles() {
  section "Creating development Dockerfiles..."
  
  # Frontend development Dockerfile
  FRONTEND_DEV_DOCKERFILE="$FRONTEND_DIR/Dockerfile.dev"
  if [ ! -f "$FRONTEND_DEV_DOCKERFILE" ]; then
    cat > "$FRONTEND_DEV_DOCKERFILE" << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
EOF
    echo -e "${GREEN}✓ Created Frontend development Dockerfile${NC}"
  else
    echo -e "${GREEN}Frontend development Dockerfile already exists${NC}"
  fi
  
  # Analyze Position development Dockerfile
  ANALYZE_DEV_DOCKERFILE="$BACKEND_DIR/gcloud/analyze-position/Dockerfile.dev"
  if [ ! -f "$ANALYZE_DEV_DOCKERFILE" ]; then
    mkdir -p "$(dirname "$ANALYZE_DEV_DOCKERFILE")"
    cat > "$ANALYZE_DEV_DOCKERFILE" << 'EOF'
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8081

# Create a simple Express server to simulate Cloud Functions locally
RUN echo 'const express = require("express");' > server.js
RUN echo 'const cors = require("cors");' >> server.js
RUN echo 'const { analyzeChessPosition } = require("./index");' >> server.js
RUN echo 'const app = express();' >> server.js
RUN echo 'const port = process.env.PORT || 8081;' >> server.js
RUN echo 'app.use(cors());' >> server.js
RUN echo 'app.use(express.json());' >> server.js
RUN echo 'app.post("/analyzeChessPosition", (req, res) => analyzeChessPosition(req, res));' >> server.js
RUN echo 'app.listen(port, () => console.log(`Analyze Position service running on port ${port}`));' >> server.js

CMD ["node", "server.js"]
EOF
    echo -e "${GREEN}✓ Created Analyze Position development Dockerfile${NC}"
  else
    echo -e "${GREEN}Analyze Position development Dockerfile already exists${NC}"
  fi
  
  # Create package.json for analyze-position if it doesn't exist
  ANALYZE_PACKAGE="$BACKEND_DIR/gcloud/analyze-position/package.json"
  if [ ! -f "$ANALYZE_PACKAGE" ]; then
    if [ -f "$ANALYZE_PACKAGE.dev" ]; then
      cp "$ANALYZE_PACKAGE.dev" "$ANALYZE_PACKAGE"
    else
      cat > "$ANALYZE_PACKAGE" << 'EOF'
{
  "name": "analyze-chess-position",
  "version": "1.0.0",
  "description": "Chess position analysis with Gemini API",
  "main": "index.js",
  "dependencies": {
    "@google-cloud/vertexai": "^0.5.0",
    "chess.js": "^1.0.0-beta.6",
    "cors": "^2.8.5",
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node server.js"
  }
}
EOF
      echo -e "${GREEN}✓ Created analyze-position package.json${NC}"
    fi
  else
    echo -e "${GREEN}analyze-position package.json already exists${NC}"
  fi
}

# Start local development environment
start_dev_environment() {
  section "Starting local development environment..."
  
  # Create required directories
  mkdir -p "$BACKEND_DIR/gcloud/stockfish-cloud-run/analysis-cache"
  mkdir -p "$BACKEND_DIR/gcloud/stockfish-cloud-run/tmp-cache"
  
  echo "Starting Docker Compose services..."
  docker-compose up -d
  
  echo -e "${GREEN}✓ Development environment started!${NC}"
  echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
  echo -e "${BLUE}Stockfish API:${NC} http://localhost:8080"
  echo -e "${BLUE}Analyze Position API:${NC} http://localhost:8081/analyzeChessPosition"
  
  echo -e "\n${YELLOW}To view logs, run:${NC}"
  echo "docker-compose logs -f"
  
  echo -e "\n${YELLOW}To stop the development environment, run:${NC}"
  echo "docker-compose down"
}

# Install frontend dependencies
install_frontend_deps() {
  section "Installing frontend dependencies..."
  
  cd "$FRONTEND_DIR"
  npm install
  cd "$BASE_DIR"
  
  echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
}

# Install backend dependencies
install_backend_deps() {
  section "Installing backend dependencies..."
  
  if [ -d "$BACKEND_DIR/gcloud/analyze-position" ]; then
    cd "$BACKEND_DIR/gcloud/analyze-position"
    npm install
    cd "$BASE_DIR"
  fi
  
  echo -e "${GREEN}✓ Backend dependencies installed${NC}"
}

# Main menu
main() {
  echo -e "\n${BLUE}What would you like to do?${NC}"
  echo "1) Start development environment (with Docker)"
  echo "2) Setup development environment only (create config files)"
  echo "3) Install dependencies only (npm install)"
  echo "4) Exit"
  
  read -p "Enter your choice (1-4): " CHOICE
  
  case $CHOICE in
    1)
      create_docker_compose
      create_dev_dockerfiles
      start_dev_environment
      ;;
    2)
      create_docker_compose
      create_dev_dockerfiles
      echo -e "${GREEN}✓ Development environment setup complete${NC}"
      ;;
    3)
      install_frontend_deps
      install_backend_deps
      echo -e "${GREEN}✓ Dependencies installation complete${NC}"
      ;;
    4)
      echo "Exiting..."
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid choice. Please enter a number between 1 and 4.${NC}"
      main
      ;;
  esac
}

# Run the main function
main