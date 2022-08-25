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
import { execSync } from 'child_process';
import path from 'path';

import { prompt } from 'enquirer';
import colors from 'ansi-colors';
import { PackageManager } from './types';

export type Command = {
  command: string;
  name: string;
};

export function executeCommands(cwd: string, commands: Command[]) {
  for (const { command, name } of commands) {
    console.log(`${name} (${command})…`);
    execSync(command, {
      stdio: 'inherit',
      cwd,
    });
  }
}

export async function createFiles(rootDir: string, files: Map<string, string>, force: boolean = false) {
  for (const [relativeFilePath, value] of files) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    if (fs.existsSync(absoluteFilePath) && !force) {
      const { override } = await prompt<{ override: boolean }>({
        type: 'confirm',
        name: 'override',
        message: `${absoluteFilePath} already exists. Override it?`,
        initial: false
      });
      if (!override)
        continue;
    }
    console.log(colors.gray(`Writing ${path.relative(process.cwd(), absoluteFilePath)}.`));
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, value, 'utf-8');
  }
}

export function determinePackageManager(rootDir: string): PackageManager {
  if (fs.existsSync(path.join(rootDir, 'yarn.lock')))
    return 'yarn';
  if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml')))
    return 'pnpm';
  if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.includes('yarn'))
      return 'yarn'
    if (process.env.npm_config_user_agent.includes('pnpm'))
      return 'pnpm'
    return 'npm';
  }
  return 'npm';
}

export function executeTemplate(input: string, args: Record<string, string>, sections: Map<string, 'show' | 'hide' | 'comment'>): string {
  for (const key in args)
    input = input.replace(new RegExp('{{' + key + '}}', 'g'), args[key]);
  const result: string[] = [];
  let mode: 'show' | 'hide' | 'comment' = 'show';
  let indent = '';
  for (const line of input.split('\n')) {
    const match = line.match(/(\s*)\/\/--begin-(.*)/);
    if (match) {
      mode = sections.get(match[2]) || 'comment';
      indent = match[1];
      continue;
    }
    if (line.trim().startsWith('//--end-')) {
      mode = 'show';
      continue;
    }
    if (mode === 'show')
      result.push(line);
    else if (mode === 'comment')
      result.push(line.slice(0, indent.length) + '// ' + line.slice(indent.length));
  }
  return result.join('\n');
}

export function languageToFileExtension(language: 'JavaScript' | 'TypeScript'): 'js' | 'ts' {
  return language === 'JavaScript' ? 'js' : 'ts';
}

export async function readDirRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map(async (dirent): Promise<string[]|string> => {
    const res = path.join(dir, dirent.name);
    return dirent.isDirectory() ? await readDirRecursively(res) : res;
  }));
  return files.flat();
}
