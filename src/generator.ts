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
import fs from 'fs';

import { prompt } from 'enquirer';
import colors from 'ansi-colors';

import { executeCommands, createFiles, determinePackageManager, executeTemplate, Command, languageToFileExtension } from './utils';
import { PackageManager } from './types';

export type PromptOptions = {
  testDir: string,
  installGitHubActions: boolean,
  language: 'JavaScript' | 'TypeScript',
  framework: 'react' | 'vue' | 'svelte' | undefined,
  installPlaywrightDependencies: boolean,
};

const assetsDir = path.join(__dirname, '..', 'assets');

export class Generator {
  packageManager: PackageManager;
  constructor(private readonly rootDir: string, private readonly options: { [key: string]: string[] }) {
    if (!fs.existsSync(rootDir))
      fs.mkdirSync(rootDir);
    this.packageManager = determinePackageManager(this.rootDir);
  }

  async run() {
    this._printPrologue();
    const answers = await this._askQuestions();
    const { files, commands } = await this._identifyChanges(answers);
    executeCommands(this.rootDir, commands);
    await createFiles(this.rootDir, files);
    this._patchGitIgnore();
    await this._patchPackageJSON(answers);
    if (answers.framework)
      this._printEpilogueCT(answers);
    else
      this._printEpilogue(answers);
  }

  private _printPrologue() {
    console.log(colors.yellow(`Getting started with writing ${colors.bold('end-to-end')} tests with ${colors.bold('Playwright')}:`));
    console.log(`Initializing project in '${path.relative(process.cwd(), this.rootDir) || '.'}'`);
  }

  private async _askQuestions(): Promise<PromptOptions> {
    if (process.env.TEST_OPTIONS)
      return JSON.parse(process.env.TEST_OPTIONS);
    if (this.options.quiet) {
      return {
        installGitHubActions: !!this.options.gha,
        language: this.options.lang?.[0] === 'js' ? 'JavaScript' : 'TypeScript',
        installPlaywrightDependencies: !!this.options['install-deps'],
        testDir: fs.existsSync(path.join(this.rootDir, 'tests')) ? 'e2e' : 'tests',
        framework: undefined,
      };
    }

    const isDefinitelyTS = fs.existsSync(path.join(this.rootDir, 'tsconfig.json'));

    const questions = [
      !isDefinitelyTS && {
        type: 'select',
        name: 'language',
        message: 'Do you want to use TypeScript or JavaScript?',
        choices: [
          { name: 'TypeScript' },
          { name: 'JavaScript' },
        ],
      },
      this.options.ct && {
        type: 'select',
        name: 'framework',
        message: 'Which framework do you use? (experimental)',
        choices: [
          { name: 'react' },
          { name: 'vue' },
          { name: 'svelte' },
        ],
      },
      !this.options.ct && {
        type: 'text',
        name: 'testDir',
        message: 'Where to put your end-to-end tests?',
        initial: fs.existsSync(path.join(this.rootDir, 'tests')) ? 'e2e' : 'tests',
      },
      !this.options.ct && {
        type: 'confirm',
        name: 'installGitHubActions',
        message: 'Add a GitHub Actions workflow?',
        initial: false,
      },
      // Avoid installing dependencies on Windows (vast majority does not run create-playwright on Windows)
      // Avoid installing dependencies on Mac (there are no dependencies)
      process.platform === 'linux' && {
        type: 'confirm',
        name: 'installPlaywrightDependencies',
        message: 'Install Playwright operating system dependencies (requires sudo / root - can be done manually via \sudo npx playwright install-deps\')?',
        initial: false,
      },
    ];
    const result = await prompt<PromptOptions>(questions.filter(Boolean) as any);
    if (isDefinitelyTS)
      result.language = 'TypeScript';
    return result;
  }

  private async _identifyChanges(answers: PromptOptions) {
    const commands: Command[] = [];
    const files = new Map<string, string>();
    const fileExtension = languageToFileExtension(answers.language);

    const sections = new Map<string, 'show' | 'hide' | 'comment'>();
    for (const browserName of ['chromium', 'firefox', 'webkit'])
      sections.set(browserName, !this.options.browser || this.options.browser.includes(browserName) ? 'show' : 'comment');

    let ctPackageName;
    let installExamples = true;
    if (answers.framework) {
      ctPackageName = `@playwright/experimental-ct-${answers.framework}`;
      installExamples = false;
      files.set(`playwright-ct.config.${fileExtension}`, executeTemplate(this._readAsset(`playwright-ct.config.${fileExtension}`), {
        testDir: answers.testDir || '',
        ctPackageName,
      }, sections));
    } else {
      files.set(`playwright.config.${fileExtension}`, executeTemplate(this._readAsset(`playwright.config.${fileExtension}`), {
        testDir: answers.testDir || '',
      }, sections));
    }

    if (answers.installGitHubActions) {
      const pmInstallCommand: Record<PackageManager, string> = {
        npm: 'npm ci',
        pnpm: 'pnpm install',
        yarn: 'yarn',
      }
      const githubActionsScript = executeTemplate(this._readAsset('github-actions.yml'), {
        installDepsCommand: pmInstallCommand[this.packageManager],
        runTestsCommand: commandToRunTests(this.packageManager),
      }, new Map());
      files.set('.github/workflows/playwright.yml', githubActionsScript);
    }

    if (installExamples) {
      files.set(path.join(answers.testDir, `example.spec.${fileExtension}`), this._readAsset(`example.spec.${fileExtension}`));
      files.set(path.join('tests-examples', `demo-todo-app.spec.${fileExtension}`), this._readAsset(`demo-todo-app.spec.${fileExtension}`));
    }

    if (!fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      const pmInitializeCommand: Record<PackageManager, string> = {
        npm: 'npm init -y',
        pnpm: 'pnpm init',
        yarn: 'yarn init -y'
      }
      const pmOfficialName: Record<PackageManager, string> = {
        npm: 'NPM',
        pnpm: 'Pnpm',
        yarn: 'Yarn',
      }
      commands.push({
        name: `Initializing ${pmOfficialName[this.packageManager]} project`,
        command: pmInitializeCommand[this.packageManager],
      });
    }

    let packageLine = '';
    const packageName = '@playwright/test';
    if (this.options.beta)
      packageLine = '@beta';
    if (this.options.next)
      packageLine = '@next';

    const pmInstallDevDepCommand: Record<PackageManager, string> = {
      npm: 'npm install --save-dev',
      pnpm: 'pnpm add --save-dev',
      yarn: 'yarn add --dev'
    }
    if (!this.options.ct) {
      commands.push({
        name: 'Installing Playwright Test',
        command: `${pmInstallDevDepCommand[this.packageManager]} ${packageName}${packageLine}`,
      });
    }

    if (this.options.ct) {
      commands.push({
        name: 'Installing Playwright Component Testing',
        command: `${pmInstallDevDepCommand[this.packageManager]} ${ctPackageName}${packageLine}`,
      });

      const extension = languageToFileExtension(answers.language);
      const htmlTemplate = executeTemplate(this._readAsset(path.join('playwright', 'index.html')), { extension }, new Map());
      files.set('playwright/index.html', htmlTemplate);

      const jsTemplate = this._readAsset(path.join('playwright', 'index.js'));
      files.set(`playwright/index.${extension}`, jsTemplate);
    }

    const browsersSuffix = this.options.browser ? ' ' + this.options.browser.join(' ') : '';
    commands.push({
      name: 'Downloading browsers',
      command: 'npx playwright install' + (answers.installPlaywrightDependencies ? ' --with-deps' : '') + browsersSuffix,
    });

    return { files, commands };
  }

  private _patchGitIgnore() {
    const gitIgnorePath = path.join(this.rootDir, '.gitignore');
    let gitIgnore = '';
    if (fs.existsSync(gitIgnorePath))
      gitIgnore = fs.readFileSync(gitIgnorePath, 'utf-8').trimEnd() + '\n';
    if (!gitIgnore.includes('node_modules'))
      gitIgnore += 'node_modules/\n';
    gitIgnore += '/test-results/\n';
    gitIgnore += '/playwright-report/\n';
    gitIgnore += '/playwright/.cache/\n';
    fs.writeFileSync(gitIgnorePath, gitIgnore);
  }

  private _readAsset(asset: string): string {
    return fs.readFileSync(path.isAbsolute(asset) ? asset : path.join(assetsDir, asset), 'utf-8');
  }

  private async _patchPackageJSON(answers: PromptOptions) {
    const packageJSON = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
    if (!packageJSON.scripts)
      packageJSON.scripts = {};
    if (packageJSON.scripts['test']?.includes('no test specified'))
      delete packageJSON.scripts['test'];

    const extension = languageToFileExtension(answers.language);
    if (answers.framework)
      packageJSON.scripts['test-ct'] = `playwright test -c playwright-ct.config.${extension}`;

    const files = new Map<string, string>();
    files.set('package.json', JSON.stringify(packageJSON, null, 2) + '\n'); // NPM keeps a trailing new-line
    await createFiles(this.rootDir, files, true);
  }

  private _printEpilogue(answers: PromptOptions) {
    console.log(colors.green('✔ Success!') + ' ' + colors.bold(`Created a Playwright Test project at ${this.rootDir}`));
    const pathToNavigate = path.relative(process.cwd(), this.rootDir);
    const prefix = pathToNavigate !== '' ? `  cd ${pathToNavigate}\n` : '';
    const exampleSpecPath = path.join(answers.testDir, `example.spec.${languageToFileExtension(answers.language)}`);
    const demoTodoAppSpecPath = path.join('tests-examples', `demo-todo-app.spec.${languageToFileExtension(answers.language)}`);
    const playwrightConfigPath = `playwright.config.${languageToFileExtension(answers.language)}`;
    console.log(`
Inside that directory, you can run several commands:

  ${colors.cyan(commandToRunTests(this.packageManager))}
    Runs the end-to-end tests.

  ${colors.cyan(commandToRunTests(this.packageManager, '--project=chromium'))}
    Runs the tests only on Desktop Chrome.

  ${colors.cyan(commandToRunTests(this.packageManager, 'example'))}
    Runs the tests in a specific file.

  ${colors.cyan(`${commandToRunTests(this.packageManager, '--debug')}`)}
    Runs the tests in debug mode.

  ${colors.cyan(`${commandToRunCodegen(this.packageManager)}`)}
    Auto generate tests with Codegen.

We suggest that you begin by typing:

  ${colors.cyan(prefix + '  ' + commandToRunTests(this.packageManager))}

And check out the following files:
  - .${path.sep}${pathToNavigate ? path.join(pathToNavigate, exampleSpecPath) : exampleSpecPath} - Example end-to-end test
  - .${path.sep}${pathToNavigate ? path.join(pathToNavigate, demoTodoAppSpecPath) : demoTodoAppSpecPath} - Demo Todo App end-to-end tests
  - .${path.sep}${pathToNavigate ? path.join(pathToNavigate, playwrightConfigPath) : playwrightConfigPath} - Playwright Test configuration

Visit https://playwright.dev/docs/intro for more information. ✨

Happy hacking! 🎭`);
  }

  private _printEpilogueCT(answers: PromptOptions) {
    console.log(colors.green('✔ Success!') + ' ' + colors.bold(`Created a Playwright Test project at ${this.rootDir}`));
    console.log(`
Inside that directory, you can run several commands:

  ${colors.cyan(`${this.packageManager} run test-ct`)}
    Runs the component tests.

  ${colors.cyan(`${this.packageManager} run test-ct -- --project=chromium`)}
    Runs the tests only on Desktop Chrome.

  ${colors.cyan(`${this.packageManager} run test-ct App.test.ts`)}
    Runs the tests in the specific file.

  ${colors.cyan(`${this.packageManager} run test-ct -- --debug`)}
    Runs the tests in debug mode.

We suggest that you begin by typing:

  ${colors.cyan(`${this.packageManager} run test-ct`)}

Visit https://playwright.dev/docs/intro for more information. ✨

Happy hacking! 🎭`);
  }
}

export function commandToRunTests(packageManager: PackageManager, args?: string) {
  if (packageManager === 'pnpm')
    return `pnpm playwright test${args ? (' ' + args) : ''}`;
  if (packageManager === 'yarn')
    return `yarn playwright test${args ? (' ' + args) : ''}`;
  return `npx playwright test${args ? (' ' + args) : ''}`;
}

export function commandToRunCodegen(packageManager: PackageManager) {
  if (packageManager === 'pnpm')
    return `pnpm playwright codegen`;
  if (packageManager === 'yarn')
    return `yarn playwright codegen`;
  return `npx playwright codegen`;
}
