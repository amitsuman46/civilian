#!/usr/bin/env node
/**
 * Production deploy zip — builds frontend, copies to backend/public,
 * zips backend WITHOUT uploads/ so Hostinger redeploys keep user images.
 *
 * Usage: npm run deploy:zip
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const frontend = path.join(root, 'frontend');
const backend = path.join(root, 'backend');
const zipOut = path.join(root, 'civilian-app.zip');

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

console.log('▸ Building frontend…');
run('npm run build', frontend);

console.log('▸ Copying frontend/dist → backend/public…');
const publicDir = path.join(backend, 'public');
fs.rmSync(publicDir, { recursive: true, force: true });
fs.cpSync(path.join(frontend, 'dist'), publicDir, { recursive: true });

console.log('▸ Creating civilian-app.zip (uploads/ excluded)…');
if (fs.existsSync(zipOut)) fs.rmSync(zipOut);

// Never bundle uploads/ — existing production photos & documents must survive redeploy.
const excludes = [
  'node_modules/*',
  'uploads/*',
  'uploads/**',
  'scripts/*',
  '*.DS_Store',
].map(x => `-x "${x}"`).join(' ');

run(`zip -r "${zipOut}" . ${excludes}`, backend);

const mb = (fs.statSync(zipOut).size / (1024 * 1024)).toFixed(1);
console.log(`\n✓ Done: ${zipOut} (${mb} MB)`);
console.log('');
console.log('  Images are NOT in the zip (by design).');
console.log('  Production stores uploads in ../civilian-uploads/ (outside the deploy folder).');
console.log('  After deploy, check Hostinger logs for: Uploads directory: .../civilian-uploads');
console.log('');
console.log('  If you had a backup of old images, copy them into civilian-uploads/ via File Manager');
console.log('  (same level as your app folder, NOT inside the zip extract folder).');
