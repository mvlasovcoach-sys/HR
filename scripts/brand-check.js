#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET_DIR = path.join(ROOT, 'shared');
const IGNORE_FILES = new Set([
  path.join('shared', 'brand.tokens.css'),
  path.join('shared', 'tokens.css')
]);
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_PATTERN = /rgba?\(([^)]*)\)/gi;

let violations = [];

function walk(dir){
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.isDirectory()) {
      walk(path.join(dir, entry.name));
      continue;
    }
    if (path.extname(entry.name) !== '.css') continue;
    const relPath = path.relative(ROOT, path.join(dir, entry.name)).replace(/\\/g, '/');
    if (relPath.startsWith('assets/css/')) continue;
    if (IGNORE_FILES.has(relPath)) continue;
    scanCss(path.join(dir, entry.name), relPath);
  }
}

function scanCss(filePath, relPath){
  const text = fs.readFileSync(filePath, 'utf8');
  let match;
  while ((match = HEX_PATTERN.exec(text))) {
    const value = match[0];
    violations.push(`${relPath}: raw hex color "${value}" — use var(--token)`);
  }
  RGB_PATTERN.lastIndex = 0;
  while ((match = RGB_PATTERN.exec(text))) {
    const value = match[0];
    const inner = match[1];
    if (/var\(/i.test(inner)) continue;
    violations.push(`${relPath}: raw ${value.startsWith('rgba') ? 'rgba' : 'rgb'} value "${value}" — use var(--token)`);
  }
}

if (fs.existsSync(TARGET_DIR)) {
  walk(TARGET_DIR);
}

if (violations.length) {
  console.error('\nBrand compliance check failed:');
  violations.forEach(v => console.error(` • ${v}`));
  console.error('\nPlease replace raw values with design tokens.');
  process.exit(1);
}

console.log('Brand compliance check passed.');
