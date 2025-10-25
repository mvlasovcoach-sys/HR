#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['shared', 'docs'];
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.husky',
  '.github',
  'assets/fonts',
  'tests/visual/__screenshots__'
]);
const IGNORED_PATHS = ['assets/css', 'node_modules'];
const IGNORED_FILES = new Set([
  path.join('shared', 'tokens.css')
]);
const TARGET_EXTENSIONS = new Set(['.css', '.html', '.js', '.ts', '.tsx']);
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/;
const FONT_PATTERN = /font-family\s*:\s*([^;]+)/gi;
const RADIUS_PATTERN = /(border-radius|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius)\s*:\s*([^;]+)/gi;

let violations = [];

function shouldSkip(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return IGNORED_PATHS.some(prefix => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function walk(dir){
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const resolved = path.join(dir, entry.name);
    const relative = path.relative(ROOT, resolved);
    if (shouldSkip(relative)) continue;
    if (entry.isDirectory()) {
      walk(resolved);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!TARGET_EXTENSIONS.has(ext)) continue;
    if (IGNORED_FILES.has(relative)) continue;
    scanFile(resolved, relative);
  }
}

function scanFile(absPath, relPath){
  const text = fs.readFileSync(absPath, 'utf8');
  if (HEX_PATTERN.test(text)) {
    violations.push(`${relPath}: found raw hex color`);
  }
  FONT_PATTERN.lastIndex = 0;
  let match;
  while ((match = FONT_PATTERN.exec(text))) {
    const value = match[1].trim();
    if (value.startsWith('var(')) continue;
    if (/^(inherit|initial|unset)/i.test(value)) continue;
    if (/system-ui|sans-serif|monospace/.test(value) && !/Inter/i.test(value)) continue;
    violations.push(`${relPath}: font-family must use var() — "${value}"`);
    break;
  }

  RADIUS_PATTERN.lastIndex = 0;
  while ((match = RADIUS_PATTERN.exec(text))) {
    const value = match[2].trim();
    if (value.startsWith('var(')) continue;
    if (/^calc\(/.test(value)) continue;
    violations.push(`${relPath}: border radius must use var() — "${value}"`);
    break;
  }
}

function scanRootHtml(){
  const entries = fs.readdirSync(ROOT, {withFileTypes: true});
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (path.extname(entry.name) !== '.html') continue;
    const absPath = path.join(ROOT, entry.name);
    scanFile(absPath, entry.name);
  }
}

function scanTargets(){
  for (const dir of SCAN_DIRS) {
    const target = path.join(ROOT, dir);
    if (!fs.existsSync(target)) continue;
    walk(target);
  }
}

scanRootHtml();
scanTargets();

if (violations.length) {
  console.error('\nBrand compliance check failed:');
  violations.forEach(msg => console.error(` • ${msg}`));
  console.error('\nPlease replace raw values with design tokens.');
  process.exit(1);
}

console.log('Brand compliance check passed.');
