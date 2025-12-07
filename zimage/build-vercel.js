import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Run Vite Build
console.log('📦 Running Vite Build...');
execSync('npm run build', { stdio: 'inherit' });

const distDir = path.join(__dirname, 'dist');
const apiDir = path.join(__dirname, 'api');
const vercelConfig = path.join(__dirname, 'vercel.json');

// 2. Copy API directory to dist/api
const targetApiDir = path.join(distDir, 'api');
if (fs.existsSync(apiDir)) {
    console.log('📂 Copying API functions...');
    fs.mkdirSync(targetApiDir, { recursive: true });
    fs.cpSync(apiDir, targetApiDir, { recursive: true });
}

// 3. Copy vercel.json to dist/vercel.json
if (fs.existsSync(vercelConfig)) {
    console.log('⚙️ Copying vercel.json...');
    fs.copyFileSync(vercelConfig, path.join(distDir, 'vercel.json'));
}

console.log('✅ Build ready for Vercel deployment in ./dist');
