#!/usr/bin/env node
// Merges official + custom templates into dist-deploy/ for device deployment.
// Usage: node scripts/merge-templates.mjs

import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync, existsSync } from 'fs';

/**
 * Resolves and strips non-scalar constants for device compatibility.
 * Mirror of src/lib/customTemplates.ts resolveStringConstants — plain JS for Node.js.
 * @param {string} json
 * @returns {string}
 */
function resolveStringConstants(json) {
  const parsed = JSON.parse(json);
  const constants = Array.isArray(parsed.constants) ? parsed.constants : [];
  const orientation = parsed.orientation ?? 'portrait';

  // Device builtins for portrait/landscape
  const portraitW = 1404, portraitH = 1872;
  const w = orientation === 'portrait' ? portraitW : portraitH;
  const h = orientation === 'portrait' ? portraitH : portraitW;
  const ctx = {
    templateWidth: w, templateHeight: h,
    paperOriginX: w / 2 - h / 2, paperOriginY: 0,
    parentWidth: w, parentHeight: h,
  };

  // Attempt to evaluate a string constant as arithmetic.
  function tryEvalScalar(value) {
    if (value.startsWith('#')) throw new Error('hex');
    let s = value;
    for (const [k, v] of Object.entries(ctx)) {
      s = s.replace(new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), String(v));
    }
    if (!/^[\d\s+\-*/().]+$/.test(s)) throw new Error('non-numeric');
    return Function('"use strict"; return (' + s + ')')();
  }

  const nonScalarMap = {};
  const keptConstants = [];

  for (const entry of constants) {
    for (const [k, v] of Object.entries(entry)) {
      if (typeof v === 'number') {
        ctx[k] = v;
        keptConstants.push(entry);
      } else if (typeof v === 'string' && v.startsWith('#')) {
        nonScalarMap[k] = v;
      } else if (typeof v === 'string') {
        try {
          ctx[k] = tryEvalScalar(v);
          keptConstants.push(entry);
        } catch {
          nonScalarMap[k] = v;
        }
      }
    }
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function wordBoundarySub(value) {
    let result = value;
    for (const [name, replacement] of Object.entries(nonScalarMap)) {
      result = result.replace(new RegExp(`\\b${escapeRe(name)}\\b`, 'g'), `(${replacement})`);
    }
    return result;
  }

  function resolveItem(item) {
    if (typeof item !== 'object' || item === null) return item;
    const result = { ...item };

    if (typeof result.fillColor === 'string' && result.fillColor in nonScalarMap) {
      result.fillColor = nonScalarMap[result.fillColor];
    }
    if (typeof result.strokeColor === 'string' && result.strokeColor in nonScalarMap) {
      result.strokeColor = nonScalarMap[result.strokeColor];
    }
    if (typeof result.text === 'string' && result.text in nonScalarMap) {
      result.text = nonScalarMap[result.text];
    }

    if (Array.isArray(result.data)) {
      result.data = result.data.map(token => typeof token === 'string' ? wordBoundarySub(token) : token);
    }
    for (const key of ['x', 'y', 'fontSize', 'strokeWidth']) {
      if (typeof result[key] === 'string') result[key] = wordBoundarySub(result[key]);
    }
    if (typeof result.boundingBox === 'object' && result.boundingBox !== null) {
      const bb = { ...result.boundingBox };
      for (const k of ['x', 'y', 'width', 'height']) {
        if (typeof bb[k] === 'string') bb[k] = wordBoundarySub(bb[k]);
      }
      result.boundingBox = bb;
    }
    if (typeof result.repeat === 'object' && result.repeat !== null) {
      const rep = { ...result.repeat };
      for (const k of ['rows', 'columns']) {
        if (typeof rep[k] === 'string') rep[k] = wordBoundarySub(rep[k]);
      }
      result.repeat = rep;
    }

    if (Array.isArray(result.children)) {
      result.children = result.children.map(resolveItem);
    }
    return result;
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return JSON.stringify({ ...parsed, constants: keptConstants, items: items.map(resolveItem) }, null, 2);
}
/** Escape non-ASCII characters as \uXXXX so the output matches device JSON format. */
function escapeUnicode(str) {
  return str.replace(/[\u0080-\uFFFF]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

import { join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');

const OFFICIAL_DIR = join(root, 'remarkable_official_templates');
const CUSTOM_DIR = join(root, 'public', 'templates', 'custom');
const DIST_DIR = join(root, 'dist-deploy');
const DEBUG_DIR = join(root, 'public', 'templates', 'debug');
const DEBUG_REGISTRY_PATH = join(DEBUG_DIR, 'debug-registry.json');

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

// 4b. Read debug templates (always override official entries of same filename)
let debugEntries = [];
if (existsSync(DEBUG_REGISTRY_PATH)) {
  const dr = JSON.parse(readFileSync(DEBUG_REGISTRY_PATH, 'utf8'));
  debugEntries = (dr.templates ?? []).map(({ isCustom: _drop, filename, ...rest }) => ({
    ...rest,
    filename: filename.replace(/^debug\//, ''),
  }));
}
const debugFilenames = new Set(debugEntries.map(e => e.filename));
const filteredOfficialEntries = officialEntries.filter(e => !debugFilenames.has(e.filename));

// 5. Merge registry
const mergedEntries = [...debugEntries, ...filteredOfficialEntries, ...dedupedCustom];

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

// 7.5 Copy debug .template files (driven by registry, not directory scan)
for (const entry of debugEntries) {
  const file = `${entry.filename}.template`;
  const filePath = join(DEBUG_DIR, file);
  if (existsSync(filePath) && !copiedFilenames.has(file)) {
    const raw = readFileSync(filePath, 'utf8');
    writeFileSync(join(DIST_DIR, file), resolveStringConstants(raw));
    copiedFilenames.add(file);
    officialCount++;
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
        const raw = readFileSync(join(CUSTOM_DIR, file), 'utf8');
        writeFileSync(join(DIST_DIR, file), resolveStringConstants(raw));
        customCount++;
      }
    }
  }
}

// 9. Write merged registry (escape non-ASCII chars as \uXXXX to match device format)
writeFileSync(join(DIST_DIR, 'templates.json'), escapeUnicode(JSON.stringify({ templates: mergedEntries }, null, 2)) + '\n');

// 10. Print summary
const total = officialCount + customCount;
console.log(`Merged: ${officialCount} official + ${customCount} custom = ${total} files`);
if (skippedCount > 0) {
  console.log(`Skipped: ${skippedCount} custom file(s) due to conflicts`);
}
