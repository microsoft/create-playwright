import path from 'path';
import fs from 'fs';

export interface PackageManager {
  cli: string;
  name: string
  init(): string
  npx(command: string, args: string): string
  ci(): string
  i(): string
  installDevDependency(name: string): string
  runPlaywrightTest(args?: string): string
  run(script: string): string
}

class NPM implements PackageManager {
  name = 'NPM'
  cli = 'npm'

  init(): string {
    return 'npm init -y'
  }

  npx(command: string, args: string): string {
    return `npx ${command} ${args}`
  }

  ci(): string {
    return 'npm ci'
  }

  i(): string {
    return 'npm i'
  }

  installDevDependency(name: string): string {
    return `npm install --save-dev ${name}`
  }

  runPlaywrightTest(args: string): string {
    return this.npx('playwright', `test${args ? (' ' + args) : ''}`);
  }

  run(script: string): string {
    return `npm run ${script}`;
  }
}

class Yarn implements PackageManager {
  name = 'Yarn'
  cli = 'yarn'
  private workspace: boolean
  private classic = false;

  constructor(rootDir: string, version?: string) {
    this.workspace = this.isWorkspace(rootDir);
    if (version)
      this.classic = version.startsWith('0') || version.startsWith('1');
  }

  private isWorkspace(rootDir: string) {
    try {
      const packageJSON = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
      return !!packageJSON.workspaces;
    } catch (e) {
      return false;
    }
  }

  init(): string {
    return 'yarn init -y'
  }

  npx(command: string, args: string): string {
    return `yarn ${command} ${args}`
  }

  ci(): string {
    return 'npm install -g yarn && yarn'
  }

  i(): string {
    return this.ci()
  }

  installDevDependency(name: string): string {
    return `yarn add --dev ${(this.workspace && this.classic) ? '-W ' : ''}${name}`
  }

  runPlaywrightTest(args: string): string {
    return this.npx('playwright', `test${args ? (' ' + args) : ''}`);
  }

  run(script: string): string {
    return `yarn ${script}`;
  }
}

class PNPM implements PackageManager {
  name = 'pnpm'
  cli = 'pnpm'
  private workspace: boolean;

  constructor(rootDir: string) {
    this.workspace = fs.existsSync(path.resolve(rootDir, 'pnpm-workspace.yaml'));
  }

  init(): string {
    return 'pnpm init'
  }

  npx(command: string, args: string): string {
    return `pnpm exec ${command} ${args}`
  }

  ci(): string {
    return 'npm install -g pnpm && pnpm install'
  }

  i(): string {
    return this.ci()
  }

  installDevDependency(name: string): string {
    return `pnpm add --save-dev ${this.workspace ? '-w ' : ''}${name}`
  }

  runPlaywrightTest(args: string): string {
    return this.npx('playwright', `test${args ? (' ' + args) : ''}`);
  }

  run(script: string): string {
    return `pnpm run ${script}`;
  }
}

export function determinePackageManager(rootDir: string): PackageManager {
  const user_agent = process.env.npm_config_user_agent;
  if (user_agent) {
    if (user_agent.includes('yarn')) {
      const yarnVersion = user_agent.match(/yarn\/(\d+\.\d+\.\d+)/)?.[1];
      return new Yarn(rootDir, yarnVersion);
    }
    if (user_agent.includes('pnpm'))
      return new PNPM(rootDir);
  }
  return new NPM();
}
