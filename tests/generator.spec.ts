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
import { expect, test } from './baseFixtures';
import { Generator } from '../src/generator';

// The CLI falls back to --quiet without a TTY, so the interactive path is exercised in-process.
// A question that is not skipped would wait for input and time out the test.

test('should not prompt for --lang js and --no-gha', async ({ dir }) => {
  const generator = new Generator(dir, { lang: 'js', gha: false, testDir: 'specs', noBrowsers: true, installDeps: true });
  expect(await generator['_askQuestions']()).toMatchObject({
    language: 'JavaScript',
    installGitHubActions: false,
    testDir: 'specs',
    installPlaywrightBrowsers: false,
  });
});

test('should not prompt for --lang ts and --gha', async ({ dir }) => {
  const generator = new Generator(dir, { lang: 'ts', gha: true, testDir: 'specs', noBrowsers: true, installDeps: true });
  expect(await generator['_askQuestions']()).toMatchObject({
    language: 'TypeScript',
    installGitHubActions: true,
    testDir: 'specs',
    installPlaywrightBrowsers: false,
  });
});
