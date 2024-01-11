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
import { test, expect, packageManagerToNpxCommand, assertLockFilesExist } from './baseFixtures';
import path from 'path';
import fs from 'fs';
import childProcess from 'child_process';

test('should generate a project in the current directory', async ({ run, dir, packageManager }) => {
  test.slow();
  const { stdout } = await run([], { installGitHubActions: true, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  assertLockFilesExist(dir, packageManager);
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();
  const playwrightConfigContent = fs.readFileSync(path.join(dir, 'playwright.config.ts'), 'utf8');
  expect(playwrightConfigContent).toContain('tests');
  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, '.gitignore'))).toBeTruthy();
  if (packageManager === 'npm') {
    expect(stdout).toContain('Initializing NPM project (npm init -y)…');
    expect(stdout).toContain('Installing Playwright Test (npm install --save-dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (npm install --save-dev @types/node)…');
  } else if (packageManager === 'yarn') {
    expect(stdout).toContain('Initializing Yarn project (yarn init -y)…');
    expect(stdout).toContain('Installing Playwright Test (yarn add --dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (yarn add --dev @types/node)…');
  } else if (packageManager === 'pnpm') {
    expect(stdout).toContain('pnpm init'); // pnpm command outputs name in different case, hence we are not testing the whole string
    expect(stdout).toContain('Installing Playwright Test (pnpm add --save-dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (pnpm add --save-dev @types/node)…');
  } else if (packageManager === 'bun') {
    expect(stdout).toContain('Initializing Bun project (bun init -y)…');
    expect(stdout).toContain('Installing Playwright Test (bun install --dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (bun install --dev @types/node)…');
  }
  expect(stdout).toContain('npx playwright install' + process.platform === 'linux' ? ' --with-deps' : '');
});

test('should generate a project in a given directory', async ({ run, dir, packageManager }) => {
  await run(['foobar'], { installGitHubActions: true, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'foobar/tests/example.spec.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'foobar/package.json'))).toBeTruthy();
  assertLockFilesExist(path.join(dir, 'foobar'), packageManager);
  expect(fs.existsSync(path.join(dir, 'foobar/playwright.config.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'foobar/.github/workflows/playwright.yml'))).toBeTruthy();
});

test('should generate a project with JavaScript and without GHA', async ({ run, dir, packageManager }) => {
  await run([], { installGitHubActions: false, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.js'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  assertLockFilesExist(dir, packageManager);
  expect(fs.existsSync(path.join(dir, 'playwright.config.js'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeFalsy();
});

test('should generate be able to run TS examples successfully', async ({ run, dir, exec, packageManager }) => {
  test.slow();
  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();

  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'install-deps']);
  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'test']);
});

test('should generate be able to run JS examples successfully', async ({ run, dir, exec, packageManager }) => {
  test.slow();
  await run([], { installGitHubActions: false, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.js'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'playwright.config.js'))).toBeTruthy();

  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'install-deps']);
  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'test']);
});

test('should generate in the root of pnpm workspace', async ({ run, packageManager }) => {
  test.skip(packageManager !== 'pnpm');

  const dir = test.info().outputDir;
  fs.mkdirSync(dir, { recursive: true });
  childProcess.execSync('pnpm init', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), `packages:\n  - 'packages/*'\n`);
  fs.mkdirSync(path.join(dir, 'packages', 'foo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages', 'foo', 'package.json'), `{}`);

  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  assertLockFilesExist(dir, packageManager);
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();
});
