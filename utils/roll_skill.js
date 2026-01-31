#!/usr/bin/env node
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, '../node_modules/playwright/lib/mcp/terminal/SKILL.md');
const destPath = path.join(__dirname, '../assets/playwright-skill.md');

if (!fs.existsSync(sourcePath)) {
  console.error('Source skill file not found:', sourcePath);
  console.error('Make sure playwright is installed: npm install playwright');
  process.exit(1);
}

const content = fs.readFileSync(sourcePath, 'utf-8');
fs.writeFileSync(destPath, content);

console.log('Copied skill file from:');
console.log('  ' + sourcePath);
console.log('to:');
console.log('  ' + destPath);
