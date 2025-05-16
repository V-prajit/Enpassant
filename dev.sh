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
# Removed stockfish-service from dependencies for docker-compose
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
    # Optionally, you might want to overwrite it if the structure changes significantly
    # For now, we'll just return if it exists.
    return
  fi
  
  cat > "$COMPOSE_FILE" << 'EOF'
version: '3'

services:
  frontend:
    build:
      context: ./Frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./Frontend:/app
      - /app/node_modules # Avoids overwriting node_modules from host
    environment:
      # VITE_STOCKFISH_URL is removed as client-side stockfish doesn't need a URL
      - VITE_GEMINI_URL=http://localhost:8081/analyzeChessPosition 
      # VITE_AUDIO_URL should also point to the gemini service if it were handling audio, 
      # but since it's client-side now, this might be irrelevant or empty
      - VITE_AUDIO_URL=http://localhost:8081 # Or set to empty if not used by backend
    depends_on:
      - analyze-position # Frontend depends on the Gemini analysis service
    restart: unless-stopped

  analyze-position: # This is the Gemini service
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
      # STOCKFISH_URL removed as it's no longer a dependency
      # Ensure GOOGLE_CLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS are set if needed
      # Example:
      # - GOOGLE_CLOUD_PROJECT=your-gcp-project-id
      # - GOOGLE_APPLICATION_CREDENTIALS=/app/gcp-key.json 
      # You might need to mount your GCP key file as a volume:
      # - ~/.gcp-keys/your-key.json:/app/gcp-key.json:ro
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
  
  # Analyze Position (Gemini service) development Dockerfile
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

# This assumes your gemini-server.js is the entry point
CMD ["node", "gemini-server.js"]
EOF
    echo -e "${GREEN}✓ Created Analyze Position development Dockerfile${NC}"
  else
    echo -e "${GREEN}Analyze Position development Dockerfile already exists${NC}"
  fi
  
  # Create package.json for analyze-position if it doesn't exist
  # This should match your Backend/gcloud/analyze-position/package.json
  ANALYZE_PACKAGE="$BACKEND_DIR/gcloud/analyze-position/package.json"
  if [ ! -f "$ANALYZE_PACKAGE" ]; then
    # Prefer copying if a .dev version exists or just create a basic one
    if [ -f "$ANALYZE_PACKAGE.dev" ]; then # You might not have this convention
      cp "$ANALYZE_PACKAGE.dev" "$ANALYZE_PACKAGE"
    else
      cat > "$ANALYZE_PACKAGE" << 'EOF'
{
  "name": "analyze-chess-position",
  "version": "1.0.0",
  "description": "Chess position analysis with Gemini API",
  "main": "index.js", 
  "scripts": {
    "start": "node gemini-server.js"
  },
  "dependencies": {
    "@google-cloud/vertexai": "^1.0.0", 
    "busboy": "^1.6.0",
    "cors": "^2.8.5",
    "express": "^4.18.2"
    
  }
}
EOF
      echo -e "${GREEN}✓ Created analyze-position package.json (basic)${NC}"
    fi
  else
    echo -e "${GREEN}analyze-position package.json already exists${NC}"
  fi
}

# Start local development environment
start_dev_environment() {
  section "Starting local development environment..."
  
  # Removed creation of stockfish cache directories
  
  echo "Starting Docker Compose services..."
  docker-compose -f "$BASE_DIR/docker-compose.yml" up --build -d
  
  echo -e "${GREEN}✓ Development environment started!${NC}"
  echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
  # Stockfish API removed
  echo -e "${BLUE}Analyze Position API (Gemini):${NC} http://localhost:8081/analyzeChessPosition"
  
  echo -e "\n${YELLOW}To view logs, run:${NC}"
  echo "docker-compose -f \"$BASE_DIR/docker-compose.yml\" logs -f"
  
  echo -e "\n${YELLOW}To stop the development environment, run:${NC}"
  echo "docker-compose -f \"$BASE_DIR/docker-compose.yml\" down"
}

# Install frontend dependencies
install_frontend_deps() {
  section "Installing frontend dependencies..."
  
  cd "$FRONTEND_DIR"
  npm install
  cd "$BASE_DIR"
  
  echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
}

# Install backend dependencies (only for analyze-position now)
install_backend_deps() {
  section "Installing backend dependencies..."
  
  if [ -d "$BACKEND_DIR/gcloud/analyze-position" ]; then
    cd "$BACKEND_DIR/gcloud/analyze-position"
    npm install
    cd "$BASE_DIR"
  fi
  
  echo -e "${GREEN}✓ Backend (analyze-position) dependencies installed${NC}"
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