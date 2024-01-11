import path from 'path';
import fs from 'fs';

export interface PackageManager {
  cli: string;
  name: string
  init(): string
  npx(command: string, args: string): string
  ci(): string
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

  init(): string {
    return 'yarn init -y'
  }

  npx(command: string, args: string): string {
    return `yarn ${command} ${args}`
  }

  ci(): string {
    return 'npm install -g yarn && yarn'
  }

  installDevDependency(name: string): string {
    return `yarn add --dev ${name}`
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

  constructor(private workspace: boolean) {
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

class Bun implements PackageManager {
  name = 'Bun'
  cli = 'bun'

  init(): string {
    return 'bun init -y'
  }

  npx(command: string, args: string): string {
    return `bun --bun x ${command} ${args}`
  }

  ci(): string {
    return 'bun install'
  }

  installDevDependency(name: string): string {
    return `bun install --dev ${name}`
  }

  runPlaywrightTest(args: string): string {
    return this.npx('playwright', `test${args ? (' ' + args) : ''}`);
  }

  run(script: string): string {
    return `bun run ${script}`;
  }
}

export function determinePackageManager(rootDir: string): PackageManager {
  if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.includes('yarn'))
      return new Yarn();
    if (process.env.npm_config_user_agent.includes('pnpm'))
      return new PNPM(fs.existsSync(path.resolve(rootDir, 'pnpm-workspace.yaml')));
    if (process.env.npm_config_user_agent.includes('bun'))
      return new Bun();
    return new NPM();
  }
  return new NPM();
}
