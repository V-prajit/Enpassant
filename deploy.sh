#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

BASE_DIR="$(pwd)"
FRONTEND_DIR="$BASE_DIR/Frontend"

echo -e "${BLUE}========================================================${NC}"
echo -e "${BLUE}=== Enpassant Chess App Custom Domain Deployment      ===${NC}"
echo -e "${BLUE}========================================================${NC}"

# Function to display section headers
section() {
  echo -e "\n${YELLOW}>>> $1${NC}\n"
}

section "Checking required tools..."

MISSING_TOOLS=0
for tool in npm node gh-pages; do # gh-pages is from Frontend/package.json "deploy" script
  if ! command -v $tool &> /dev/null; then
    echo -e "${RED}Error: $tool is not installed or not in PATH${NC}"
    MISSING_TOOLS=1
  else
    echo -e "${GREEN}✓ $tool found${NC}"
  fi
done

if [ $MISSING_TOOLS -eq 1 ]; then
  echo -e "${RED}Please install the missing tools. For gh-pages, run: npm install -g gh-pages (or check Frontend devDependencies)${NC}"
  exit 1
fi

deploy_frontend() {
  section "Building and deploying frontend to GitHub Pages with custom domain..."
  
  cd "$FRONTEND_DIR"
  
  echo "Installing frontend dependencies..."
  npm ci || npm install
  
  if [ ! -f "public/CNAME" ]; then
    echo "Creating CNAME file for custom domain..."
    echo "enpassant.wiki" > public/CNAME
  fi
  
  if [ ! -f ".env.production" ]; then
    echo "Creating .env.production file..."
    cat > .env.production << EOL
# Production environment variables
VITE_GEMINI_URL='https://your-production-gemini-backend-url.cloudfunctions.net/analyzeChessPosition' # Replace with your actual deployed Gemini function URL
EOL
  else
    echo ".env.production already exists. Please ensure VITE_GEMINI_URL is set for your production Gemini backend, and VITE_STOCKFISH_URL/VITE_AUDIO_URL are empty."
  fi
  
  echo "Building frontend for production..."
  # This will use .env.production variables
  npm run build 
  
  echo "Deploying to GitHub Pages with custom domain..."
  npm run deploy 
  
  echo -e "${GREEN}✓ Deployment to GitHub Pages with custom domain complete!${NC}"
  
  cd "$BASE_DIR"
}

main() {
  echo -e "\n${BLUE}This script will build and deploy the Enpassant Chess App Frontend to GitHub Pages with custom domain.${NC}"
  echo -e "Make sure you have configured Git to use your GitHub credentials."
  echo -e "IMPORTANT: Ensure your DNS settings point 'enpassant.wiki' to GitHub Pages."
  echo -e "Ensure your production VITE_GEMINI_URL is correctly set in Frontend/.env.production"
  
  read -p "Do you want to continue? (y/n): " CONTINUE
  if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
  fi
  
  cd "$FRONTEND_DIR"
  if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}Warning: You have uncommitted changes in your frontend directory.${NC}"
    read -p "Continue anyway? (y/n): " CONTINUE_UNCOMMITTED
    if [[ ! $CONTINUE_UNCOMMITTED =~ ^[Yy]$ ]]; then
      echo "Deployment cancelled. Please commit your changes first."
      exit 0
    fi
  fi
  cd "$BASE_DIR"
  
  deploy_frontend
  
  echo -e "\n${GREEN}=== Deployment completed successfully! ===${NC}"
  echo -e "\nYour app should now be available at https://enpassant.wiki"
  echo -e "If this is the first deployment, it might take a few minutes to become available."
  echo -e "\n${YELLOW}REMINDER:${NC} Make sure you've set up your custom domain in GitHub repository settings."
  echo -e "GitHub repository > Settings > Pages > Custom domain"
}

main