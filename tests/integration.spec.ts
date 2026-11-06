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
  '/playwright/.auth/'
].join('\n');

for (const language of ['TypeScript', 'JavaScript'] as const) {
  test(`should configure failures-only CI reporting for ${language} end-to-end tests`, async ({ run, dir }) => {
    await run([], {
      language,
      testDir: 'tests',
      installGitHubActions: false,
      installPlaywrightDependencies: false,
      installPlaywrightBrowsers: false,
    });
    const extension = language === 'TypeScript' ? 'ts' : 'js';
    const config = fs.readFileSync(path.join(dir, `playwright.config.${extension}`), 'utf8');
    expect(config).toContain("reporter: process.env.CI ? [['list', { printOnlyFailures: true }], ['html']] : 'html',");
  });
}

test('should generate a project in the current directory', async ({ run, dir, packageManager }) => {
  test.skip(packageManager === 'yarn-classic' || packageManager === 'yarn-berry');
  test.slow();
  const { stdout } = await run([], { installGitHubActions: true, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).toBeTruthy();
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
  expect(fs.existsSync(path.join(dir, 'foobar/tsconfig.json'))).toBeTruthy();
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

test('should generate be able to run TS examples successfully', { lock: 'apt-get' }, async ({ run, dir, exec, packageManager }) => {
  test.skip(packageManager === 'yarn-berry' && process.version.startsWith('v20.'), 'Playwright ESM loader cannot be loaded from the Yarn PnP cache on Node 20');
  test.slow();
  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.ts'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();

  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'install-deps']);
  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'test']);
});

for (const testDir of ['tests', 'e2e']) {
  test(`should generate a tsconfig.json that type-checks the generated files in ${testDir}`, async ({ run, exec, packageManager }) => {
    test.skip(packageManager !== 'npm' && packageManager !== 'pnpm', 'tsc cannot resolve modules with PnP');
    await run([], { installGitHubActions: false, testDir, language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
    const tsc = require.resolve('typescript/bin/tsc');
    const { stdout } = await exec('node', [tsc, '-p', '.', '--listFilesOnly']);
    // tsc prints absolute paths with forward slashes, resolved through symlinks (e.g. /private/var on macOS).
    const files = stdout.split('\n').map(f => f.trim().replace(/\\/g, '/')).filter(f => f && !f.includes('/node_modules/'));
    expect(files).toHaveLength(2);
    expect(files.some(f => f.endsWith('/playwright.config.ts'))).toBeTruthy();
    expect(files.some(f => f.endsWith(`/${testDir}/example.spec.ts`))).toBeTruthy();
    await exec('node', [tsc, '-p', '.']);
  });
}

test('should not overwrite an existing tsconfig.json', async ({ run, dir }) => {
  const tsconfig = JSON.stringify({ compilerOptions: { strict: true } });
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), tsconfig);
  await run(['--quiet'], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  expect(fs.readFileSync(path.join(dir, 'tsconfig.json'), 'utf8')).toBe(tsconfig);
  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeTruthy();
});

test('should generate be able to run JS examples successfully', { lock: 'apt-get' }, async ({ run, dir, exec, packageManager }) => {
  test.skip(packageManager === 'yarn-berry' && process.version.startsWith('v20.'), 'Playwright ESM loader cannot be loaded from the Yarn PnP cache on Node 20');
  test.slow();
  await run([], { installGitHubActions: false, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, 'tests/example.spec.js'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'playwright.config.js'))).toBeTruthy();

  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'install-deps']);
  await exec(packageManagerToNpxCommand(packageManager), ['playwright', 'test']);
});

test('should generate in the root of pnpm workspace', async ({ run, packageManager, exec }) => {
  test.skip(packageManager !== 'pnpm' && packageManager !== 'pnpm-pnp');

  // not sure what's going wrong. removing pnpm-workspace.yaml would help, as discussed in https://github.com/pnpm/pnpm/issues/4129#issuecomment-2830362402.
  // but I don't understand PNPM enough to know whether that make the test meaningless.
  // disabling for now.
  test.fail(packageManager === 'pnpm-pnp', 'something is broken here');

  const dir = test.info().outputDir;
  fs.mkdirSync(dir, { recursive: true });
  await exec('pnpm', ['init'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), `packages:\n  - 'packages/*'\n`);
  fs.mkdirSync(path.join(dir, 'packages', 'foo'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'packages', 'foo', 'package.json'), `{}`);

  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  assertLockFilesExist(dir, packageManager);
  expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).toBeTruthy();
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
  expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).toBeTruthy();
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

test('should match whole gitignore entries', async ({ run, dir, packageManager }) => {
  test.skip(packageManager !== 'npm');
  fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules_cache/\r\nplaywright-report/\r\n/test-results\n');

  await run([], { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  expect(fs.readFileSync(path.join(dir, '.gitignore'), { encoding: 'utf8' })).toBe([
    'node_modules_cache/\r',
    'playwright-report/\r',
    '/test-results',
    '',
    '# Playwright',
    'node_modules/',
    '/blob-report/',
    '/playwright/.auth/',
    '',
  ].join('\n'));
})

test('should install with "npm ci" in GHA when using npm with package-lock enabled', async ({ dir, run, packageManager }) => {
  test.skip(packageManager !== 'npm');

  await run([], { installGitHubActions: true, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();

  const workflowContent = fs.readFileSync(path.join(dir, '.github/workflows/playwright.yml'), 'utf8');
  expect(workflowContent).not.toContain('run: npm i');
  expect(workflowContent).toContain('run: npm ci');
  expect(workflowContent).toContain('        node-version: lts/*\n        cache: "npm"\n    - name: Install dependencies');
});

test('should install with "npm i" in GHA when using npm with package-lock disabled', async ({ dir, run, packageManager }) => {
  test.skip(packageManager !== 'npm');

  fs.writeFileSync(path.join(dir, '.npmrc'), 'package-lock=false');
  await run([], { installGitHubActions: true, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: true });
  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();

  const workflowContent = fs.readFileSync(path.join(dir, '.github/workflows/playwright.yml'), 'utf8');
  expect(workflowContent).toContain('run: npm i');
  expect(workflowContent).not.toContain('run: npm ci');
  // actions/setup-node fails to cache without a lock file.
  expect(workflowContent).toContain('        node-version: lts/*\n    - name: Install dependencies');
});

test('should not use the npm cache in GHA for other package managers', async ({ dir, run, packageManager }) => {
  test.skip(packageManager === 'npm');

  await run([], { installGitHubActions: true, testDir: 'tests', language: 'JavaScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false });
  const workflowContent = fs.readFileSync(path.join(dir, '.github/workflows/playwright.yml'), 'utf8');
  expect(workflowContent).not.toContain('cache:');
  expect(workflowContent).not.toContain('//');
});

test('should not prompt and skip existing files in --quiet mode', async ({ run, dir }) => {
  const options = { installGitHubActions: false, testDir: 'tests', language: 'TypeScript', installPlaywrightDependencies: false, installPlaywrightBrowsers: false } as const;
  // First run: generate the project normally
  await run([], options);
  // Second run: unchanged files are not conflicts.
  await run(['--quiet'], options);

  // Third run: modified files are not overwritten without prompting.
  fs.writeFileSync(path.join(dir, 'playwright.config.ts'), '// modified');
  await expect(run(['--quiet'], options)).rejects.toThrowError("run again with --force");
  expect(fs.readFileSync(path.join(dir, 'playwright.config.ts'), 'utf8')).toBe('// modified');

  // Fourth run: --force overwrites them.
  await run(['--quiet', '--force'], options);
  expect(fs.readFileSync(path.join(dir, 'playwright.config.ts'), 'utf8')).toContain('defineConfig');
});

test('should install GHA workflow when --gha is passed', async ({ run, dir }) => {
  await run(['--quiet', '--gha', '--lang', 'js', '--test-dir', 'specs', '--no-browsers']);

  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeTruthy();
  expect(fs.existsSync(path.join(dir, 'specs/example.spec.js'))).toBeTruthy();
  expect(fs.readFileSync(path.join(dir, 'playwright.config.js'), 'utf8')).toContain('specs');
});

test('should not install GHA workflow when --no-gha is passed', async ({ run, dir }) => {
  await run(['--quiet', '--no-gha', '--lang', 'js', '--test-dir', 'specs', '--no-browsers']);

  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeFalsy();
  expect(fs.existsSync(path.join(dir, 'specs/example.spec.js'))).toBeTruthy();
  expect(fs.readFileSync(path.join(dir, 'playwright.config.js'), 'utf8')).toContain('specs');
});

test('should not prompt in non-interactive terminals without --quiet', async ({ run, dir }) => {
  await run(['--lang', 'js', '--test-dir', 'specs', '--no-browsers']);

  expect(fs.existsSync(path.join(dir, '.github/workflows/playwright.yml'))).toBeFalsy();
  expect(fs.existsSync(path.join(dir, 'specs/example.spec.js'))).toBeTruthy();
  expect(fs.readFileSync(path.join(dir, 'playwright.config.js'), 'utf8')).toContain('specs');
});

test('should not overwrite existing files in non-interactive terminals without --quiet', async ({ run, dir }) => {
  fs.mkdirSync(path.join(dir, 'project'));
  fs.writeFileSync(path.join(dir, 'project', 'playwright.config.js'), '// existing');

  const error = await run(['project', '--lang', 'js', '--no-browsers']).catch(e => e);
  expect(error.message).toContain(`These files already exist:\n  ${path.join('project', 'playwright.config.js')}\nIf you want to override them, run again with --force.`);
  expect(fs.readFileSync(path.join(dir, 'project', 'playwright.config.js'), 'utf8')).toBe('// existing');
  // Nothing is installed before the conflict is reported.
  expect(error.message).not.toContain('Installing');
  expect(fs.existsSync(path.join(dir, 'project', 'package.json'))).toBeFalsy();
});

test('should accept --lang JavaScript and comma-separated --browser', async ({ run, dir, packageManager }) => {
  test.skip(packageManager !== 'npm');
  const { stdout } = await run(['--quiet', '--gha', '--lang', 'JavaScript', '--browser', 'firefox,WebKit', '--no-browsers', '--no-examples']);

  expect(fs.existsSync(path.join(dir, 'playwright.config.ts'))).toBeFalsy();
  expect(fs.existsSync(path.join(dir, 'tsconfig.json'))).toBeFalsy();
  const config = fs.readFileSync(path.join(dir, 'playwright.config.js'), 'utf8');
  expect(config).toContain(`    // {\n    //   name: 'chromium',`);
  expect(config).toContain(`    {\n      name: 'firefox',`);
  expect(config).toContain(`    {\n      name: 'webkit',`);

  const workflow = fs.readFileSync(path.join(dir, '.github/workflows/playwright.yml'), 'utf8');
  expect(workflow).toContain('run: npx playwright install --with-deps firefox webkit\n');

  // The epilogue only suggests commands and files that exist.
  expect(stdout).toContain('npx playwright test --project=firefox');
  expect(stdout).not.toContain('--project=chromium');
  expect(stdout).not.toContain('example.spec');
  expect(stdout).not.toContain('Runs the tests in a specific file.');
  expect(stdout).toContain(`.${path.sep}playwright.config.js - Playwright Test configuration`);
});

test('should reject unknown --lang and --browser values', async ({ run, dir }) => {
  await expect(run(['--quiet', '--lang', 'python'])).rejects.toThrowError(`argument 'python' is invalid. Expected one of: js, ts, JavaScript, TypeScript.`);
  await expect(run(['--quiet', '--browser', 'chrome'])).rejects.toThrowError(`argument 'chrome' is invalid. Expected a comma-separated list of: chromium, firefox, webkit.`);
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeFalsy();
});

test('should escape --test-dir in the generated config', async ({ run, exec, dir, packageManager }) => {
  test.skip(packageManager !== 'npm');
  await run(['--quiet', '--no-browsers', '--test-dir', `it's $&`]);

  expect(fs.readFileSync(path.join(dir, 'playwright.config.ts'), 'utf8')).toContain(`testDir: './it\\'s $&',`);
  expect(fs.existsSync(path.join(dir, `it's $&`, 'example.spec.ts'))).toBeTruthy();
  const tsc = require.resolve('typescript/bin/tsc');
  await exec('node', [tsc, '-p', '.']);
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
