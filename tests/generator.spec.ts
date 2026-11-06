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
import fs from 'fs';
import path from 'path';
import { expect, test } from './baseFixtures';
import { Generator } from '../src/generator';
import { escapeJSString, executeTemplate, parseBrowsers, parseLanguage, resolveFileConflicts } from '../src/utils';

// The CLI falls back to --quiet without a TTY, so the interactive path is exercised in-process.
// A question that is not skipped would wait for input and time out the test.

test('should not prompt for --lang js and --no-gha', async ({ dir }) => {
  const generator = new Generator(dir, { lang: 'JavaScript', gha: false, testDir: 'specs', noBrowsers: true, installDeps: true });
  expect(await generator['_askQuestions']()).toMatchObject({
    language: 'JavaScript',
    installGitHubActions: false,
    testDir: 'specs',
    installPlaywrightBrowsers: false,
  });
});

test('should not prompt for --lang ts and --gha', async ({ dir }) => {
  const generator = new Generator(dir, { lang: 'TypeScript', gha: true, testDir: 'specs', noBrowsers: true, installDeps: true });
  expect(await generator['_askQuestions']()).toMatchObject({
    language: 'TypeScript',
    installGitHubActions: true,
    testDir: 'specs',
    installPlaywrightBrowsers: false,
  });
});

test('should ask before overriding existing files that differ', async ({ dir }) => {
  fs.writeFileSync(path.join(dir, 'changed.txt'), 'old');
  fs.writeFileSync(path.join(dir, 'unchanged.txt'), 'same');
  const messages: string[] = [];
  // Interactive prompts need a TTY, so answer them in-process.
  const enquirer = require('enquirer');
  const descriptor = Object.getOwnPropertyDescriptor(enquirer, 'prompt')!;
  Object.defineProperty(enquirer, 'prompt', {
    configurable: true,
    get: () => async (question: { message: string }) => {
      messages.push(question.message);
      return { override: false };
    },
  });
  try {
    const files = new Map([['changed.txt', 'new'], ['unchanged.txt', 'same'], ['added.txt', 'new']]);
    const result = await resolveFileConflicts(dir, files, { force: false, quiet: false });
    expect(messages).toEqual([`${path.relative(process.cwd(), path.join(dir, 'changed.txt'))} already exists. Override it?`]);
    expect([...result.keys()]).toEqual(['added.txt']);
    expect([...(await resolveFileConflicts(dir, files, { force: true, quiet: false })).keys()]).toEqual(['changed.txt', 'added.txt']);
    expect(messages).toHaveLength(1);
  } finally {
    Object.defineProperty(enquirer, 'prompt', descriptor);
  }
});

test('should parse --lang', async () => {
  for (const value of ['js', 'JS', 'javascript', 'JavaScript'])
    expect(parseLanguage(value)).toBe('JavaScript');
  for (const value of ['ts', 'TS', 'typescript', 'TypeScript'])
    expect(parseLanguage(value)).toBe('TypeScript');
  expect(() => parseLanguage('python')).toThrow('Expected one of');
});

test('should parse --browser', async () => {
  expect(parseBrowsers('chromium,Firefox')).toEqual(['chromium', 'firefox']);
  expect(parseBrowsers('webkit', parseBrowsers('chromium'))).toEqual(['chromium', 'webkit']);
  expect(parseBrowsers('firefox, firefox')).toEqual(['firefox']);
  expect(() => parseBrowsers('chrome')).toThrow('Expected a comma-separated list of: chromium, firefox, webkit.');
  expect(() => parseBrowsers(',')).toThrow('Expected a comma-separated list');
});

test('should insert template values verbatim', async () => {
  expect(executeTemplate(`testDir: '{{testDir}}'`, { testDir: escapeJSString(`it's $& $1 \\`) }, new Map())).toBe(`testDir: 'it\\'s $& $1 \\\\'`);
});
