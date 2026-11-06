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

import colors from 'ansi-colors';
import { prompt } from 'enquirer';
import ini from 'ini';

import { type PackageManager, determinePackageManager } from './packageManager';
import { type BrowserName, browserNames, Command, escapeJSONString, escapeJSString, executeCommands, executeTemplate, languageToFileExtension, resolveFileConflicts, writeFiles } from './utils';

export type PromptOptions = {
  testDir: string,
  installGitHubActions: boolean,
  language: 'JavaScript' | 'TypeScript',
  installPlaywrightDependencies: boolean,
  installPlaywrightBrowsers: boolean,
};

const assetsDir = path.join(__dirname, '..', 'assets');

export type CliOptions = {
  lang?: PromptOptions['language'];
  browser?: BrowserName[];
  noBrowsers?: boolean;
  noExamples?: boolean;
  installDeps?: boolean;
  next?: boolean;
  beta?: boolean;
  quiet?: boolean;
  gha?: boolean;
  testDir?: string;
  force?: boolean;
};

const browserDevices: Record<BrowserName, string> = {
  chromium: 'Desktop Chrome',
  firefox: 'Desktop Firefox',
  webkit: 'Desktop Safari',
};

export class Generator {
  private readonly options: CliOptions
  private packageManager: PackageManager;

  constructor(private readonly rootDir: string, options: CliOptions) {
    this.options = options;
    if (!fs.existsSync(rootDir))
      fs.mkdirSync(rootDir);
    this.packageManager = determinePackageManager(rootDir);
  }

  async run() {
    this._printPrologue();
    const answers = await this._askQuestions();
    const { files, commands: allCommands } = await this._identifyChanges(answers);
    // Resolve conflicts with existing files before installing anything.
    const filesToWrite = await resolveFileConflicts(this.rootDir, files, { force: !!this.options.force, quiet: !!this.options.quiet });
    const [preCommands, postCommands] = allCommands.reduce((acc, command) => {
      acc[command.phase === 'pre' ? 0 : 1].push(command);
      return acc;
    }, [[] as Command[], [] as Command[]]);
    executeCommands(this.rootDir, preCommands);
    writeFiles(this.rootDir, filesToWrite);
    this._patchGitIgnore();
    this._patchPackageJSON();
    executeCommands(this.rootDir, postCommands);
    this._printEpilogue(answers);
  }

  private _printPrologue() {
    console.log(colors.yellow(`Getting started with writing ${colors.bold('end-to-end')} tests with ${colors.bold('Playwright')}:`));
    console.log(`Initializing project in '${path.relative(process.cwd(), this.rootDir) || '.'}'`);
  }

  private async _askQuestions(): Promise<PromptOptions> {
    if (process.env.TEST_OPTIONS)
      return JSON.parse(process.env.TEST_OPTIONS);

    const testDir = this.options.testDir || (fs.existsSync(path.join(this.rootDir, 'tests')) ? 'e2e' : 'tests');

    if (this.options.quiet) {
      return {
        installGitHubActions: !!this.options.gha,
        language: this.options.lang ?? 'TypeScript',
        installPlaywrightDependencies: !!this.options.installDeps,
        testDir,
        installPlaywrightBrowsers: !this.options.noBrowsers,
      };
    }

    const isDefinitelyTS = fs.existsSync(path.join(this.rootDir, 'tsconfig.json'));

    const questions = [
      !isDefinitelyTS && !this.options.lang && {
        type: 'select',
        name: 'language',
        message: 'Do you want to use TypeScript or JavaScript?',
        choices: [
          { name: 'TypeScript' },
          { name: 'JavaScript' },
        ],
      },
      {
        type: 'text',
        name: 'testDir',
        message: 'Where to put your end-to-end tests?',
        initial: testDir,
        skip: !!this.options.testDir,
      },
      {
        type: 'confirm',
        name: 'installGitHubActions',
        message: 'Add a GitHub Actions workflow?',
        initial: this.options.gha ?? true,
        skip: this.options.gha !== undefined,
      },
      {
        type: 'confirm',
        name: 'installPlaywrightBrowsers',
        message: `Install Playwright browsers (can be done manually via '${this.packageManager.npx('playwright', 'install')}')?`,
        initial: !this.options.noBrowsers || !!this.options.browser,
        skip: !!this.options.noBrowsers || !!this.options.browser,
      },
      // Avoid installing dependencies on Windows (vast majority does not run create-playwright on Windows)
      // Avoid installing dependencies on Mac (there are no dependencies)
      process.platform === 'linux' && {
        type: 'confirm',
        name: 'installPlaywrightDependencies',
        message: `Install Playwright operating system dependencies (requires sudo / root - can be done manually via 'sudo ${this.packageManager.npx('playwright', 'install-deps')}')?`,
        initial: !!this.options.installDeps,
        skip: !!this.options.installDeps,
      },
    ];
    const result = await prompt<PromptOptions>(
      questions.filter(Boolean) as Exclude<
        (typeof questions)[number],
        boolean | undefined
      >[],
    );
    if (isDefinitelyTS)
      result.language = 'TypeScript';
    else if (this.options.lang)
      result.language = this.options.lang;
    return result;
  }

  private async _identifyChanges(answers: PromptOptions) {
    const commands: (Command & { phase: 'pre' | 'post' })[] = [];
    const files = new Map<string, string>();
    const fileExtension = languageToFileExtension(answers.language);

    const sections = new Map<string, 'show' | 'hide' | 'comment'>();
    for (const browserName of browserNames)
      sections.set(browserName, this._isBrowserEnabled(browserName) ? 'show' : 'comment');
    const browsersSuffix = this.options.browser ? ' ' + this.options.browser.join(' ') : '';

    if (answers.language === 'TypeScript' && !fs.existsSync(path.join(this.rootDir, 'tsconfig.json'))) {
      files.set('tsconfig.json', executeTemplate(this._readAsset('tsconfig.json'), {
        testDir: escapeJSONString(answers.testDir || '.'),
      }, new Map()));
    }

    files.set(`playwright.config.${fileExtension}`, executeTemplate(this._readAsset(`playwright.config.${fileExtension}`), {
      testDir: escapeJSString(answers.testDir || ''),
    }, sections));

    if (answers.installGitHubActions) {
      const npmrcExists = fs.existsSync(path.join(this.rootDir, '.npmrc'));
      const packageLockDisabled = npmrcExists && ini.parse(fs.readFileSync(path.join(this.rootDir, '.npmrc'), 'utf-8'))['package-lock'] === false;
      // actions/setup-node fails when the lock file for its cache is missing, so only cache npm with a package-lock.json.
      const useNpmCache = this.packageManager.name === 'NPM' && !packageLockDisabled;
      const githubActionsScript = executeTemplate(this._readAsset('github-actions.yml'), {
        installDepsCommand: packageLockDisabled ? this.packageManager.i() : this.packageManager.ci(),
        installPlaywrightCommand: this.packageManager.npx('playwright', 'install --with-deps' + browsersSuffix),
        runTestsCommand: this.packageManager.runPlaywrightTest(),
      }, new Map([['npm-cache', useNpmCache ? 'show' : 'hide']]));
      files.set('.github/workflows/playwright.yml', githubActionsScript);
    }

    if (!this.options.noExamples)
      files.set(path.join(answers.testDir, `example.spec.${fileExtension}`), this._readAsset(`example.spec.${fileExtension}`));

    if (!fs.existsSync(path.join(this.rootDir, 'package.json'))) {
      commands.push({
        name: `Initializing ${this.packageManager.name} project`,
        command: this.packageManager.init(),
        phase: 'pre',
      });
    }

    let packageTag = '';
    if (this.options.beta)
      packageTag = '@beta';
    if (this.options.next)
      packageTag = '@next';

    commands.push({
      name: 'Installing Playwright Test',
      command: this.packageManager.installDevDependency(`@playwright/test${packageTag}`),
      phase: 'pre',
    });

    if (!this._hasDependency('@types/node')) {
      commands.push({
        name: 'Installing Types',
        command: this.packageManager.installDevDependency(`@types/node`),
        phase: 'pre',
      });
    }

    if (answers.installPlaywrightBrowsers) {
      commands.push({
        name: 'Downloading browsers',
        command: this.packageManager.npx('playwright', 'install') + (answers.installPlaywrightDependencies ? ' --with-deps' : '') + browsersSuffix,
        phase: 'post',
      });
    }

    const skillContent = this._readAsset('playwright-skill.md');
    files.set('.claude/skills/playwright/SKILL.md', skillContent);

    return { files, commands };
  }

  private _isBrowserEnabled(browserName: BrowserName) {
    return !this.options.browser || this.options.browser.includes(browserName);
  }

  private _hasDependency(pkg: string) {
    try {
      const packageJSON = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
      return packageJSON.dependencies?.[pkg] || packageJSON.devDependencies?.[pkg] || packageJSON.optionalDependencies?.[pkg];
    } catch (e) {
      return false;
    }
  }

  private _patchGitIgnore() {
    const gitIgnorePath = path.join(this.rootDir, '.gitignore');
    let gitIgnore = '';
    if (fs.existsSync(gitIgnorePath))
      gitIgnore = fs.readFileSync(gitIgnorePath, 'utf-8').trimEnd() + '\n';

    let thisIsTheFirstLineWeAreAdding = true;
    // Match whole lines, with or without the leading and trailing slashes.
    const valuesToAdd = {
      'node_modules/': /^\/?node_modules\/?\s*$/m,
      '/test-results/': /^\/?test-results\/?\s*$/m,
      '/playwright-report/': /^\/?playwright-report\/?\s*$/m,
      '/blob-report/': /^\/?blob-report\/?\s*$/m,
      '/playwright/.auth/': /^\/?playwright\/\.auth\/?\s*$/m,
    };
    Object.entries(valuesToAdd).forEach(([value, regex]) => {
      if (!gitIgnore.match(regex)) {
        if (thisIsTheFirstLineWeAreAdding) {
          gitIgnore += `\n# Playwright\n`;
          thisIsTheFirstLineWeAreAdding = false;
        }

        gitIgnore += `${value}\n`;
      }
    });
    fs.writeFileSync(gitIgnorePath, gitIgnore);
  }

  private _readAsset(asset: string): string {
    return fs.readFileSync(path.isAbsolute(asset) ? asset : path.join(assetsDir, asset), 'utf-8');
  }

  private _patchPackageJSON() {
    const packageJSON = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf-8'));
    if (!packageJSON.scripts)
      packageJSON.scripts = {};
    if (packageJSON.scripts['test']?.includes('no test specified'))
      delete packageJSON.scripts['test'];

    writeFiles(this.rootDir, new Map([['package.json', JSON.stringify(packageJSON, null, 2) + '\n']])); // NPM keeps a trailing new-line
  }

  private _printEpilogue(answers: PromptOptions) {
    console.log(colors.green('✔ Success!') + ' ' + colors.bold(`Created a Playwright Test project at ${this.rootDir}`));
    const pathToNavigate = path.relative(process.cwd(), this.rootDir);
    const prefix = pathToNavigate !== '' ? `  cd ${pathToNavigate}\n` : '';
    const fileExtension = languageToFileExtension(answers.language);
    const project = browserNames.find(b => this._isBrowserEnabled(b)) ?? 'chromium';

    const commands: [string, string][] = [
      [this.packageManager.runPlaywrightTest(), 'Runs the end-to-end tests.'],
      [this.packageManager.runPlaywrightTest('--ui'), 'Starts the interactive UI mode.'],
      [this.packageManager.runPlaywrightTest(`--project=${project}`), `Runs the tests only on ${browserDevices[project]}.`],
    ];
    if (!this.options.noExamples)
      commands.push([this.packageManager.runPlaywrightTest('example'), 'Runs the tests in a specific file.']);
    commands.push(
      [this.packageManager.runPlaywrightTest('--debug'), 'Runs the tests in debug mode.'],
      [this.packageManager.npx('playwright', 'codegen'), 'Auto generate tests with Codegen.'],
    );

    const filesToCheck: [string, string][] = [];
    if (!this.options.noExamples)
      filesToCheck.push([path.join(answers.testDir, `example.spec.${fileExtension}`), 'Example end-to-end test']);
    filesToCheck.push([`playwright.config.${fileExtension}`, 'Playwright Test configuration']);

    console.log(`
Inside that directory, you can run several commands:

${commands.map(([command, description]) => `  ${colors.cyan(command)}\n    ${description}`).join('\n\n')}

We suggest that you begin by typing:

  ${colors.cyan(prefix + '  ' + this.packageManager.runPlaywrightTest())}

And check out the following files:
${filesToCheck.map(([file, description]) => `  - .${path.sep}${pathToNavigate ? path.join(pathToNavigate, file) : file} - ${description}`).join('\n')}

Visit https://playwright.dev/docs/intro for more information. ✨

Happy hacking! 🎭`);
  }
}
