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
import { InvalidArgumentError } from 'commander';
import { PromptOptions } from './generator';

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

/**
 * Returns the files that need to be written. Existing files with the same content are skipped.
 * Existing files with different content are overridden with `force` or after confirmation;
 * in quiet mode, they abort the run before anything is installed or written.
 */
export async function resolveFileConflicts(rootDir: string, files: Map<string, string>, options: { force: boolean, quiet: boolean }): Promise<Map<string, string>> {
  const unchangedFiles: string[] = [];
  const conflictingFiles: string[] = [];
  for (const [relativeFilePath, value] of files) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    if (!fs.existsSync(absoluteFilePath))
      continue;
    if (fs.readFileSync(absoluteFilePath, 'utf-8') === value)
      unchangedFiles.push(relativeFilePath);
    else
      conflictingFiles.push(relativeFilePath);
  }

  if (options.quiet && !options.force && conflictingFiles.length) {
    console.log('These files already exist:');
    for (const f of conflictingFiles)
      console.log(`  ${path.relative(process.cwd(), path.join(rootDir, f))}`);
    console.log('If you want to override them, run again with --force.');
    process.exit(1);
  }

  const result = new Map<string, string>();
  for (const [relativeFilePath, value] of files) {
    if (unchangedFiles.includes(relativeFilePath))
      continue;
    if (conflictingFiles.includes(relativeFilePath) && !options.force) {
      const { override } = await prompt<{ override: boolean }>({
        type: 'confirm',
        name: 'override',
        message: `${path.relative(process.cwd(), path.join(rootDir, relativeFilePath))} already exists. Override it?`,
        initial: false
      });
      if (!override)
        continue;
    }
    result.set(relativeFilePath, value);
  }
  return result;
}

export function writeFiles(rootDir: string, files: Map<string, string>) {
  for (const [relativeFilePath, value] of files) {
    const absoluteFilePath = path.join(rootDir, relativeFilePath);
    console.log(colors.gray(`Writing ${path.relative(process.cwd(), absoluteFilePath)}.`));
    fs.mkdirSync(path.dirname(absoluteFilePath), { recursive: true });
    fs.writeFileSync(absoluteFilePath, value, 'utf-8');
  }
}

export function executeTemplate(input: string, args: Record<string, string>, sections: Map<string, 'show' | 'hide' | 'comment'>): string {
  for (const key in args)
    input = input.replace(new RegExp('{{' + key + '}}', 'g'), () => args[key]!);
  const result: string[] = [];
  let mode: 'show' | 'hide' | 'comment' = 'show';
  let indent = '';
  for (const line of input.split('\n')) {
    const match = line.match(/(\s*)\/\/--begin-(.*)/);
    if (match) {
      mode = sections.get(match[2]!) || 'comment';
      indent = match[1]!;
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

// Escapes a value for use inside a double-quoted JSON string.
export function escapeJSONString(value: string): string {
  return JSON.stringify(value).slice(1, -1);
}

// Escapes a value for use inside a single-quoted JavaScript string.
export function escapeJSString(value: string): string {
  return escapeJSONString(value).replace(/'/g, `\\'`);
}

export const browserNames = ['chromium', 'firefox', 'webkit'] as const;
export type BrowserName = typeof browserNames[number];

export function parseBrowsers(value: string, previous: BrowserName[] = []): BrowserName[] {
  const result = [...previous];
  for (const name of value.split(',').map(b => b.trim().toLowerCase()).filter(Boolean)) {
    const browser = browserNames.find(b => b === name);
    if (!browser)
      throw new InvalidArgumentError(`Expected a comma-separated list of: ${browserNames.join(', ')}.`);
    if (!result.includes(browser))
      result.push(browser);
  }
  if (!result.length)
    throw new InvalidArgumentError(`Expected a comma-separated list of: ${browserNames.join(', ')}.`);
  return result;
}

export function parseLanguage(value: string): PromptOptions['language'] {
  switch (value.toLowerCase()) {
    case 'js':
    case 'javascript':
      return 'JavaScript';
    case 'ts':
    case 'typescript':
      return 'TypeScript';
  }
  throw new InvalidArgumentError('Expected one of: js, ts, JavaScript, TypeScript.');
}

export function languageToFileExtension(language: PromptOptions['language']): 'js' | 'ts' {
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
