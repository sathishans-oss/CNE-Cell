import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const codeGsPath = path.join(rootDir, 'Code.gs');
const destPath = path.join(rootDir, 'src', 'backend', 'googleAppsScript.ts');

if (!fs.existsSync(codeGsPath)) {
  console.error('Error: Code.gs not found at ' + codeGsPath);
  process.exit(1);
}

const codeGs = fs.readFileSync(codeGsPath, 'utf8');

// Safely escape backslashes, backticks, and template interpolation for TypeScript template literal
const escaped = codeGs
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const fileContent = `/**
 * Google Apps Script Source Export
 * Authoritative source: Code.gs
 * This file is automatically synchronized from Code.gs
 */
export const APPS_SCRIPT_SOURCE_CODE = \`${escaped}\`;

export const GOOGLE_APPS_SCRIPT_CODE = APPS_SCRIPT_SOURCE_CODE;
`;

fs.writeFileSync(destPath, fileContent, 'utf8');
console.log('Successfully synchronized Code.gs to ' + destPath);
