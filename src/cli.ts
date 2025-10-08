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
import { Command } from 'commander';
import { CliOptions, Generator } from './generator';

const program = new Command();

program
  .name('create-playwright')
  .description('Getting started with writing end-to-end tests with Playwright.')
  .argument('[rootDir]', 'Target directory for the Playwright project', '.')
  .option('--browser <browser...>', `browsers to use in default config (default: 'chromium,firefox,webkit')`)
  .option('--no-browsers', 'do not download browsers (can be done manually via \'npx playwright install\')')
  .option('--no-examples', 'do not create example test files')
  .option('--install-deps', 'install dependencies')
  .option('--next', 'install @next version of Playwright')
  .option('--beta', 'install @beta version of Playwright')
  .option('--ct', 'install Playwright Component testing')
  .option('--quiet', 'do not ask for interactive input prompts')
  .option('--gha', 'install GitHub Actions')
  .option('--lang <language>', 'language to use (js, TypeScript)')
  .action(async (rootDir, options) => {

    const cliOptions: CliOptions = {
      browser: options.browser,
      noBrowsers: !options.browsers,
      noExamples: !options.examples,
      installDeps: options.installDeps,
      next: options.next,
      beta: options.beta,
      ct: options.ct,
      quiet: options.quiet,
      gha: options.gha,
      lang: options.lang,
    };
    const resolvedRootDir = path.resolve(process.cwd(), rootDir || '.');
    const generator = new Generator(resolvedRootDir, cliOptions);
    await generator.run();
  });

program.parseAsync().catch(error => {
  console.error(error);
  process.exit(1);
});
