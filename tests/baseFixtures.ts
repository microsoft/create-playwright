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

import { test as base } from '@playwright/test';
import { spawn, type SpawnOptionsWithoutStdio } from 'child_process';
import path from 'path';
import fs from 'fs';
import type { PromptOptions } from '../src/generator';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export type TestFixtures = {
  packageManager: PackageManager;
  dir: string;
  run: (parameters: string[], options: PromptOptions) => Promise<SpawnResult>,
  exec: typeof spawnAsync,
};

type SpawnResult = {stdout: string, stderr: string, code: number | null, error?: Error};

function spawnAsync(cmd: string, args: string[], options?: SpawnOptionsWithoutStdio): Promise<SpawnResult> {
  const p = spawn(cmd, args, options);

  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    if (process.env.CR_PW_DEBUG) {
      p.stdout.on('data', chunk => process.stdout.write(chunk));
      p.stderr.on('data', chunk => process.stderr.write(chunk));
    }
    if (p.stdout)
      p.stdout.on('data', data => stdout += data);
    if (p.stderr)
      p.stderr.on('data', data => stderr += data);
    p.on('close', code => resolve({ stdout, stderr, code }));
    p.on('error', error => resolve({ stdout, stderr, code: 0, error }));
  });
}

export const test = base.extend<TestFixtures>({
  packageManager: ['npm', { option: true }],
  dir: async ({}, use, testInfo) => {
    const dir = testInfo.outputDir;
    fs.mkdirSync(dir, { recursive: true });
    await use(dir);
  },
  exec: async ({ dir }, use, testInfo) => {
    await use(async (cmd: string, args: string[], options?: SpawnOptionsWithoutStdio): ReturnType<typeof spawnAsync> => {
      const result = await spawnAsync(cmd, args, {
        cwd: dir,
        ...options,
      });
      if (result.code !== 0) {
        throw new Error([
          `Failed to run "${cmd} ${args.join(' ')}"`,
          `stdout:`,
          result.stdout,
          `stderr:`,
          result.stderr,
        ].join('\n'));
      }
      return result;
    });
  },
  run: async ({ packageManager, exec, dir }, use) => {
    await use(async (parameters: string[], options: PromptOptions): Promise<SpawnResult> => {
      return await exec('node', [path.join(__dirname, '..'), ...parameters], {
        shell: true,
        cwd: dir,
        env: {
          ...process.env,
          'npm_config_user_agent': packageManagerToNpmConfigUserAgent(packageManager),
          'TEST_OPTIONS': JSON.stringify(options),
        },
      });
    });
  },
});

function packageManagerToNpmConfigUserAgent(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'npm':
      return 'npm/10.2.4 node/v20.11.0 linux x64 workspaces/false'
    case 'yarn':
      return 'yarn/1.22.21 npm/? node/v20.11.0 linux x64';
    case 'pnpm':
      return 'pnpm/8.14.1 npm/? node/v20.11.0 linux x64';
    case 'bun':
      return 'bun/1.0.22 npm/? node/v20.8.0 linux x64'  
  }
}

export function assertLockFilesExist(dir: string, packageManager: PackageManager) {
  expect(fs.existsSync(path.join(dir, 'package.json'))).toBeTruthy();
  if (packageManager === 'npm')
    expect(fs.existsSync(path.join(dir, 'package-lock.json'))).toBeTruthy();
  else if (packageManager === 'yarn')
    expect(fs.existsSync(path.join(dir, 'yarn.lock'))).toBeTruthy();
  else if (packageManager === 'pnpm')
    expect(fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))).toBeTruthy();
  else if (packageManager === 'bun')
    expect(fs.existsSync(path.join(dir, 'bun.lockb'))).toBeTruthy();
}

export function packageManagerToNpxCommand(packageManager: PackageManager): string {
  switch (packageManager) {
    case 'npm':
      return 'npx';
    case 'yarn':
      return 'yarn';
    case 'pnpm':
      return 'pnpm dlx';
    case 'bun':
      return 'bun --bun x';
  }
  throw new Error(`Unsupported package manager: ${packageManager}!`);
}

export const expect = test.expect;
