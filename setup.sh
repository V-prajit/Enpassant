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
echo -e "${BLUE}===       Enigma Chess App Setup Script             ===${NC}"
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

REQUIRED_TOOLS=("npm" "node" "git")
OPTIONAL_TOOLS=("docker" "gcloud")

MISSING_REQUIRED=0
for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command_exists $tool; then
    echo -e "${RED}Error: $tool is not installed or not in PATH${NC}"
    MISSING_REQUIRED=1
  else
    echo -e "${GREEN}✓ $tool found${NC}"
  fi
done

if [ $MISSING_REQUIRED -eq 1 ]; then
  echo -e "${RED}Please install the missing required tools and try again.${NC}"
  exit 1
fi

echo -e "\nChecking optional tools..."
for tool in "${OPTIONAL_TOOLS[@]}"; do
  if ! command_exists $tool; then
    echo -e "${YELLOW}Warning: $tool is not installed (optional)${NC}"
  else
    echo -e "${GREEN}✓ $tool found${NC}"
  fi
done

# Install frontend dependencies
install_frontend_deps() {
  section "Installing frontend dependencies..."
  
  cd "$FRONTEND_DIR"
  
  if [ -f "package.json" ]; then
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
  else
    echo -e "${RED}Error: package.json not found in $FRONTEND_DIR${NC}"
    return 1
  fi
  
  cd "$BASE_DIR"
}

# Install backend dependencies
install_backend_deps() {
  section "Installing backend dependencies..."
  
  # Install dependencies for analyze-position
  if [ -d "$BACKEND_DIR/gcloud/analyze-position" ]; then
    cd "$BACKEND_DIR/gcloud/analyze-position"
    if [ -f "package.json" ]; then
      npm install
      echo -e "${GREEN}✓ analyze-position dependencies installed${NC}"
    else
      echo -e "${YELLOW}Warning: package.json not found in analyze-position directory${NC}"
    fi
    cd "$BASE_DIR"
  fi
  
  # Install dependencies for stockfish-cloud-run
  if [ -d "$BACKEND_DIR/gcloud/stockfish-cloud-run" ]; then
    cd "$BACKEND_DIR/gcloud/stockfish-cloud-run"
    if [ -f "package.json" ]; then
      npm install
      echo -e "${GREEN}✓ stockfish-cloud-run dependencies installed${NC}"
    else
      echo -e "${YELLOW}Warning: package.json not found in stockfish-cloud-run directory${NC}"
    fi
    cd "$BASE_DIR"
  fi
}

# Setup Google Cloud (if available)
setup_gcloud() {
  if ! command_exists gcloud; then
    echo -e "${YELLOW}Google Cloud SDK not found. Skipping cloud setup.${NC}"
    return
  fi
  
  section "Setting up Google Cloud..."
  
  # Check if already authenticated
  ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null || echo "")
  
  if [ -z "$ACCOUNT" ]; then
    echo "You need to authenticate with Google Cloud."
    echo "Run the following command to login:"
    echo -e "${BLUE}gcloud auth login${NC}"
    echo
    read -p "Do you want to login now? (y/n): " LOGIN_NOW
    
    if [[ $LOGIN_NOW =~ ^[Yy]$ ]]; then
      gcloud auth login
    else
      echo -e "${YELLOW}Skipping Google Cloud authentication.${NC}"
      return
    fi
  else
    echo -e "${GREEN}✓ Already authenticated as $ACCOUNT${NC}"
  fi
  
  # Check current project
  CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
  
  echo "Current Google Cloud project: ${CURRENT_PROJECT:-None}"
  read -p "Do you want to set a different project? (y/n): " CHANGE_PROJECT
  
  if [[ $CHANGE_PROJECT =~ ^[Yy]$ ]]; then
    read -p "Enter your Google Cloud project ID: " NEW_PROJECT
    gcloud config set project $NEW_PROJECT
    echo -e "${GREEN}✓ Project set to $NEW_PROJECT${NC}"
  fi
  
  # Enable required APIs
  echo "Enabling required Google Cloud APIs..."
  gcloud services enable cloudfunctions.googleapis.com
  gcloud services enable cloudbuild.googleapis.com
  gcloud services enable run.googleapis.com
  gcloud services enable artifactregistry.googleapis.com
  
  echo -e "${GREEN}✓ Google Cloud setup complete${NC}"
}

# Setup local development config
setup_local_config() {
  section "Setting up local development configuration..."
  
  # Create frontend .env if it doesn't exist
  FRONTEND_ENV="$FRONTEND_DIR/.env.local"
  if [ ! -f "$FRONTEND_ENV" ]; then
    cat > "$FRONTEND_ENV" << EOF
# Local development API endpoints
VITE_STOCKFISH_URL=http://localhost:8080
VITE_GEMINI_URL=http://localhost:8081/analyzeChessPosition

# Production API endpoints - uncomment these when building for production
# VITE_STOCKFISH_URL=https://stockfish-analysis-service-xxxxx-uc.a.run.app
# VITE_GEMINI_URL=https://us-central1-your-project-id.cloudfunctions.net/analyzeChessPosition
EOF
    echo -e "${GREEN}✓ Created frontend .env.local file${NC}"
  else
    echo -e "${GREEN}Frontend .env.local already exists${NC}"
  fi
  
  # Make development scripts executable
  if [ -f "$BASE_DIR/dev.sh" ]; then
    chmod +x "$BASE_DIR/dev.sh"
  fi
  
  if [ -f "$BASE_DIR/deploy.sh" ]; then
    chmod +x "$BASE_DIR/deploy.sh"
  fi
}

# Update Stockfish and ensure it's available
setup_stockfish() {
  section "Setting up Stockfish..."
  
  # Create directory for stockfish binary if needed
  if [ ! -d "$BACKEND_DIR/gcloud/stockfish-cloud-run/bin" ]; then
    mkdir -p "$BACKEND_DIR/gcloud/stockfish-cloud-run/bin"
  fi
  
  # Check if Stockfish is already available
  if command_exists stockfish; then
    echo -e "${GREEN}✓ Stockfish is available in system PATH${NC}"
    echo "You can use the system installation for development."
    return
  fi
  
  # Determine platform
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="mac"
  else
    echo -e "${YELLOW}Warning: Unsupported platform for automatic Stockfish installation.${NC}"
    echo "Please download Stockfish manually from https://stockfishchess.org/download/"
    return
  fi
  
  echo "Attempting to download Stockfish for $PLATFORM..."
  
  # Download and setup Stockfish based on platform
  if [ "$PLATFORM" == "linux" ]; then
    echo "For Linux, please install Stockfish using your package manager:"
    echo "  Ubuntu/Debian: sudo apt-get install stockfish"
    echo "  Fedora: sudo dnf install stockfish"
    echo "  Arch: sudo pacman -S stockfish"
  elif [ "$PLATFORM" == "mac" ]; then
    echo "For macOS, you can install Stockfish using Homebrew:"
    echo "  brew install stockfish"
    
    if command_exists brew; then
      read -p "Do you want to install Stockfish via Homebrew now? (y/n): " INSTALL_STOCKFISH
      if [[ $INSTALL_STOCKFISH =~ ^[Yy]$ ]]; then
        brew install stockfish
        echo -e "${GREEN}✓ Stockfish installed via Homebrew${NC}"
      fi
    fi
  fi
}

# Main menu
main() {
  echo -e "\n${BLUE}Enigma Chess App Setup${NC}"
  echo -e "${YELLOW}This script will help you set up the Enigma Chess application.${NC}"
  echo -e "It will install dependencies and configure your development environment.\n"
  
  read -p "Do you want to continue? (y/n): " CONTINUE
  if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
  fi
  
  # Check if this is a fresh git clone
  GIT_FILES=$(git ls-files | wc -l)
  if [ "$GIT_FILES" -eq 0 ]; then
    echo -e "${RED}Error: No git files found. Make sure you're in the Enigma repository.${NC}"
    exit 1
  fi
  
  # Run setup steps
  install_frontend_deps
  install_backend_deps
  setup_local_config
  setup_stockfish
  
  # Offer Google Cloud setup if gcloud is available
  if command_exists gcloud; then
    read -p "Do you want to set up Google Cloud for deployment? (y/n): " SETUP_CLOUD
    if [[ $SETUP_CLOUD =~ ^[Yy]$ ]]; then
      setup_gcloud
    fi
  fi
  
  echo -e "\n${GREEN}✓ Setup completed successfully!${NC}"
  echo -e "\nNext steps:"
  echo -e "1. Run ${BLUE}./dev.sh${NC} to start the local development environment"
  echo -e "2. Visit ${BLUE}http://localhost:3000${NC} in your browser"
  echo -e "3. When ready to deploy, run ${BLUE}./deploy.sh${NC}"
}

# Run the main function
main