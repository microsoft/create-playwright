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

import path from 'path';
import { Generator } from './generator';

(async () => {
  const argv = process.argv.slice(2);
  const args = argv.filter(a => !a.startsWith('--'));
  const options: { [key: string]: string[] } = {};
  for (const token of argv.filter(a => a.startsWith('--'))) {
    const match = token.match(/--([^=]+)(?:=(.*))?/);
    if (!match)
      continue;
    const [, name, value] = match;
    const oldValue = options[name];
    if (oldValue)
      oldValue.push(value);
    else if (value)
      options[name] = [value];
    else
      options[name] = [];
  }
  const rootDir = path.resolve(process.cwd(), args[0] || '');
  if (options.help) {
    _printHelp();
    process.exit(1);
  }
  const generator = new Generator(rootDir, options);
  await generator.run();
})().catch(error => {
  console.error(error);
  process.exit(1);
});

function _printHelp() {
  console.log(`Usage: npx create-playwright@latest [options] [rootDir]
    Available options are:
      --help: print this message
      --browser=<name>: browsers to use in default config (default: 'chromium,firefox,webkit')
      --no-browsers: do not download browsers (can be done manually via 'npx playwright install')
      --install-deps: install dependencies (default: false)
      --next: install @next version of Playwright
      --beta: install @beta version of Playwright
      --ct: install Playwright Component testing
      --quiet: do not ask for interactive input prompts
      --gha: install GitHub Actions
      --lang=<js>: language to use (default: 'TypeScript'. Potential values: 'js', 'TypeScript')
    `);
}
