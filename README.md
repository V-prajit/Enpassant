# Chess Voice Coach

An AI-powered chess coach that uses voice commands to interact with a chessboard and provides intelligent move explanations using Google's Gemini API.

## Quick Start Guide

### Frontend Setup
```bash
# Navigate to frontend directory
cd Frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Backend Setup
```bash
# Navigate to backend directory
cd Backend/gcloud/analyze-position

# Install dependencies
npm install

# Authenticate with Google Cloud (shared project)
npm run auth

# Run the local server (Choose one of these options)
npm run start     # Use real Gemini API
npm run mock      # Use mock responses (no authentication needed)
```

Visit http://localhost:5173 to use the application. The frontend will automatically try to connect to your local backend first, and if that's not available, it will fall back to production or use mock responses.

## Project Structure

- `Frontend/`: React application
  - `src/components/`: React components
  - `src/hooks/`: Custom React hooks
  - `src/services/`: API services
  - `src/utils/`: Utility functions
- `Backend/`: Server-side code
  - `gcloud/analyze-position/`: Google Cloud Function for position analysis

## Features

- Interactive chessboard with move validation
- Position analysis with AI explanations
- Move history tracking
- Skill level adjustments for personalized feedback
- Voice commands (coming soon)

## Troubleshooting

### Authentication Issues
If you encounter Google Cloud authentication issues:

1. Make sure you're logged in with the correct account:
   ```bash
   npm run auth
   ```

2. If still having issues, use the mock backend:
   ```bash
   npm run mock
   ```

### API Response Issues
The application has three fallback layers:
1. Local backend
2. Production backend (https://us-central1-tidal-hack25tex-223.cloudfunctions.net/analyzeChessPosition)
3. Mock responses

### Deployment
To deploy the backend function (if you have permission):
```bash
cd Backend/gcloud/analyze-position
npm run deploy
```

## Development Workflow

1. Make frontend changes in the `Frontend/src` directory
2. Make backend changes in `Backend/gcloud/analyze-position/index.js`
3. Test locally using the development servers
4. Deploy to Google Cloud Functions if needed

The frontend will automatically connect to whatever backend is available, prioritizing local development.