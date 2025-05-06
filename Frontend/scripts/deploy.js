const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function section(title) {
  console.log(`\n${colors.yellow}>>> ${title}${colors.reset}\n`);
}

function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}Error: ${message}${colors.reset}`);
}

async function deploy() {
  console.log(`${colors.blue}========================================================${colors.reset}`);
  console.log(`${colors.blue}=== Enpassant Chess App Deployment                   ===${colors.reset}`);
  console.log(`${colors.blue}========================================================${colors.reset}`);

  try {
    // Create the CNAME file if it doesn't exist
    section('Setting up custom domain');
    const publicDir = path.join(__dirname, '..', 'public');
    const cnameFile = path.join(publicDir, 'CNAME');

    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    fs.writeFileSync(cnameFile, 'enpassant.wiki');
    success('CNAME file created with "enpassant.wiki"');

    const envFile = path.join(__dirname, '..', '.env.production');
    if (!fs.existsSync(envFile)) {
      const envContent = `# Production environment variables
# Set to empty to use local processing
VITE_STOCKFISH_URL=
VITE_GEMINI_URL=
VITE_AUDIO_URL=
`;
      fs.writeFileSync(envFile, envContent);
      success('.env.production file created');
    } else {
      success('.env.production file already exists');
    }

    // Build and deploy
    section('Building and deploying');
    console.log('Running build...');
    execSync('npm run build', { stdio: 'inherit' });
    success('Build completed successfully');

    console.log('Deploying to GitHub Pages...');
    execSync('npx gh-pages -d dist', { stdio: 'inherit' });
    success('Deployment to GitHub Pages completed');

    console.log(`\n${colors.green}=== Deployment completed successfully! ===${colors.reset}`);
    console.log(`\nYour app should now be available at https://enpassant.wiki`);
    console.log(`If this is the first deployment, it might take a few minutes to become available.`);
    console.log(`\n${colors.yellow}REMINDER:${colors.reset} Ensure your GitHub repository is configured with the custom domain.`);
    console.log(`GitHub repository > Settings > Pages > Custom domain\n`);

  } catch (err) {
    error(`Deployment failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

deploy();