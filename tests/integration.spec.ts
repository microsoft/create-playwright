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
import { assertLockFilesExist, expect, packageManagerToNpxCommand, test } from './baseFixtures';

const validGitignore = [
  '# Playwright',
  'node_modules/',
  '/test-results/',
  '/playwright-report/',
  '/blob-report/',
  '/playwright/.cache/',
  '/playwright/.auth/'
].join('\n');

test('should generate a project in the current directory', async ({ run, dir, packageManager }) => {
  test.skip(packageManager === 'yarn-classic' || packageManager === 'yarn-berry');
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
  expect(fs.readFileSync(path.join(dir, '.gitignore'), { encoding: 'utf8' }).trim()).toBe(validGitignore);
  if (packageManager === 'npm') {
    expect(stdout).toContain('Initializing NPM project (npm init -y)…');
    expect(stdout).toContain('Installing Playwright Test (npm install --save-dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (npm install --save-dev @types/node)…');
  } else if (packageManager === 'yarn-classic') {
    expect(stdout).toContain('Initializing Yarn project (yarn init -y)…');
    expect(stdout).toContain('Installing Playwright Test (yarn add --dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (yarn add --dev @types/node)…');
  } else if (packageManager === 'pnpm' || packageManager === 'pnpm-pnp') {
    expect(stdout).toContain('pnpm init'); // pnpm command outputs name in different case, hence we are not testing the whole string
    expect(stdout).toContain('Installing Playwright Test (pnpm add --save-dev @playwright/test)…');
    expect(stdout).toContain('Installing Types (pnpm add --save-dev @types/node)…');
  }
  expect(stdout).toContain('npx playwright install' + process.platform === 'linux' ? ' --with-deps' : '');
});

test('should generate a project in a given directory', async ({ run, dir, packageManager }) => {
  test.skip(packageManager === 'yarn-classic' || packageManager === 'yarn-berry');
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

test('should generate in the root of pnpm workspace', async ({ run, packageManager, exec }) => {
  test.skip(packageManager !== 'pnpm');
  test.fail(packageManager === 'pnpm-pnp', 'something is broken here');

  const dir = test.info().outputDir;
  fs.mkdirSync(dir, { recursive: true });
  await exec('pnpm', ['init'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), `packages:\n  - 'packages/*'\n`);
  fs.mkdirSync(path.join(dir, 'packages', 'foo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages', 'foo', 'package.json'), `{}`);

  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  assertLockFilesExist(dir, packageManager);
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();
});

test('should generate in the root of yarn workspaces', async ({ run, packageManager, exec }) => {
  test.skip(packageManager !== 'yarn-berry' && packageManager !== 'yarn-classic');

  const dir = test.info().outputDir;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), `{
  "name": "yarn-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*"]
}`);
  for (const pkg of ['foo', 'bar']) {
    const packageDir = path.join(dir, 'packages', pkg);
    fs.mkdirSync(packageDir, { recursive: true });
    await exec(`yarn`, ['init', '-y'], { cwd: packageDir });
  }
  await exec(`yarn`, ['install'], { cwd: dir, env: { ...process.env, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false', YARN_ENABLE_HARDENED_MODE: '0' } });

  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  assertLockFilesExist(dir, packageManager);
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.ts'))).toBeTruthy();
  const writesNodeModules = packageManager === 'yarn-classic';
  expect(fs.existsSync(path.join(dir, 'node_modules/playwright'))).toBe(writesNodeModules);
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();
});

test('should not duplicate gitignore entries', async ({ run, dir }) => {
  fs.writeFileSync(path.join(dir, '.gitignore'), validGitignore);

  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  expect(fs.readFileSync(path.join(dir, '.gitignore'), { encoding: 'utf8' }).trim()).toBe(validGitignore);
})

test('should install with "npm ci" in GHA when using npm with package-lock enabled', async ({ dir, run, packageManager }) => {
  test.skip(packageManager !== 'npm');

  await run([], { installGitHubActions: true, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();

  const workflowContent = fs.readFileSync(path.join(dir, '.github/workflows/playwright.yml'), 'utf8');
  expect(workflowContent).not.toContain('run: npm i');
  expect(workflowContent).toContain('run: npm ci');
});

test('should install with "npm i" in GHA when using npm with package-lock disabled', async ({ dir, run, packageManager }) => {
  test.skip(packageManager !== 'npm');

  fs.writeFileSync(path.join(dir, '.npmrc'), 'package-lock=false');
  await run([], { installGitHubActions: true, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();

  const workflowContent = fs.readFileSync(path.join(dir, '.github/workflows/playwright.yml'), 'utf8');
  expect(workflowContent).toContain('run: npm i');
  expect(workflowContent).not.toContain('run: npm ci');
});

test('is proper yarn classic', async ({ packageManager, exec }) => {
  test.skip(packageManager !== 'yarn-classic');
  const result = await exec('yarn --version', [], { cwd: test.info().outputDir, shell: true });
  expect(result.stdout).toMatch(/^1\./);
});

test('is proper yarn berry', async ({ packageManager, exec }) => {
  test.skip(packageManager !== 'yarn-berry');
  const result = await exec('yarn --version', [], { cwd: test.info().outputDir, shell: true });
  expect(result.stdout).toMatch(/^4\./);
});