#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '..', 'lib', 'version.ts');

// Read current version
let content = fs.readFileSync(versionFile, 'utf8');

// Extract current version
const versionMatch = content.match(/export const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/);
if (!versionMatch) {
  console.error('Could not parse version from version.ts');
  process.exit(1);
}

const major = parseInt(versionMatch[1]);
const minor = parseInt(versionMatch[2]);
let patch = parseInt(versionMatch[3]);

// Increment patch version
patch += 1;

const newVersion = `${major}.${minor}.${patch}`;
const timestamp = new Date().toISOString();

// Update the file
const newContent = `// Auto-incremented version for deployment tracking
// This file is updated automatically on each deployment
export const APP_VERSION = "${newVersion}"
export const BUILD_TIMESTAMP = "${timestamp}"`;

fs.writeFileSync(versionFile, newContent);

console.log(`🚀 Version incremented to ${newVersion}`);
console.log(`📅 Build timestamp: ${timestamp}`);
