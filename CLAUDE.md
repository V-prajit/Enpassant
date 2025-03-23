# Chess Analysis Project Guidelines

## Build Commands
- **Frontend:** `npm run dev` (development), `npm run build` (production), `npm run preview` (preview build)
- **Frontend Lint:** `npm run lint` (ESLint)
- **Backend:** `npm run start` (start server), `npm run mock` (test with mock data)
- **Deployment:** `npm run deploy` (deploy functions), `npm run deploy-stockfish` (deploy Stockfish to GCP)

## Code Style Guidelines
- **Naming:** PascalCase for components, camelCase for functions/variables, use* prefix for hooks
- **Imports:** React imports first, third-party libraries next, local imports last
- **Components:** Follow functional component pattern with explicit prop types
- **Error Handling:** Use try/catch with specific error messages, console.error for logging
- **API Patterns:** Implement timeout handling, progressive loading for analysis results
- **Documentation:** JSDoc for functions, verbose logging in critical paths

## Project Structure
- **Frontend:** components/, hooks/, services/, utils/, assets/
- **Backend:** Multiple microservices in gcloud/ directory
- **Chess Logic:** Centralized in utils/chess.js and position-analyzer.js

Follow existing patterns when adding new code. Prioritize readability and maintainability over clever solutions.