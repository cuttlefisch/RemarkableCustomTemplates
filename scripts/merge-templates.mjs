#!/usr/bin/env node
// Merges official + custom templates into dist-deploy/ for device deployment.
// Usage: node scripts/merge-templates.mjs

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

const OFFICIAL_DIR = join(root, 'remarkable_official_templates');
const CUSTOM_DIR = join(root, 'public', 'templates', 'custom');
const DIST_DIR = join(root, 'dist-deploy');

// 1. Read official registry — fatal if missing
const officialRegistryPath = join(OFFICIAL_DIR, 'templates.json');
if (!existsSync(officialRegistryPath)) {
  console.error('Error: remarkable_official_templates/templates.json not found.');
  console.error('Run `make pull` first to fetch templates from the device.');
  process.exit(1);
}
const officialRegistry = JSON.parse(readFileSync(officialRegistryPath, 'utf8'));
const officialEntries = officialRegistry.templates ?? [];

// 2. Read custom registry — empty if missing
let customEntries = [];
const customRegistryPath = join(CUSTOM_DIR, 'custom-registry.json');
if (existsSync(customRegistryPath)) {
  const customRegistry = JSON.parse(readFileSync(customRegistryPath, 'utf8'));
  customEntries = customRegistry.templates ?? [];
}

// 3. Flatten custom entries: strip "custom/" prefix, drop isCustom field
const flattenedCustom = customEntries.map(({ isCustom: _drop, filename, ...rest }) => ({
  ...rest,
  filename: filename.replace(/^custom\//, ''),
}));

// 4. Deduplicate: skip custom entries whose flat filename conflicts with an official one
const officialFilenames = new Set(officialEntries.map((e) => e.filename));
const dedupedCustom = [];
for (const entry of flattenedCustom) {
  if (officialFilenames.has(entry.filename)) {
    console.warn(`Warning: skipping custom entry "${entry.name}" — filename "${entry.filename}" conflicts with an official template.`);
  } else {
    dedupedCustom.push(entry);
  }
}

// 5. Merge registry
const mergedEntries = [...officialEntries, ...dedupedCustom];

// 6. Create dist-deploy/
mkdirSync(DIST_DIR, { recursive: true });

// 7. Copy official .template files
let officialCount = 0;
const copiedFilenames = new Set();
if (existsSync(OFFICIAL_DIR)) {
  for (const file of readdirSync(OFFICIAL_DIR)) {
    if (file.endsWith('.template')) {
      copyFileSync(join(OFFICIAL_DIR, file), join(DIST_DIR, file));
      copiedFilenames.add(file);
      officialCount++;
    }
  }
}

// 8. Copy custom .template files (skip if official already copied same name)
let customCount = 0;
let skippedCount = 0;
if (existsSync(CUSTOM_DIR)) {
  for (const file of readdirSync(CUSTOM_DIR)) {
    if (file.endsWith('.template')) {
      if (copiedFilenames.has(file)) {
        console.warn(`Warning: skipping custom file "${file}" — conflicts with an official file already copied.`);
        skippedCount++;
      } else {
        copyFileSync(join(CUSTOM_DIR, file), join(DIST_DIR, file));
        customCount++;
      }
    }
  }
}

// 9. Write merged registry
writeFileSync(join(DIST_DIR, 'templates.json'), JSON.stringify({ templates: mergedEntries }, null, 2) + '\n');

// 10. Print summary
const total = officialCount + customCount;
console.log(`Merged: ${officialCount} official + ${customCount} custom = ${total} files`);
if (skippedCount > 0) {
  console.log(`Skipped: ${skippedCount} custom file(s) due to conflicts`);
}
