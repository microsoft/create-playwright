interface PackageManager {
  cli: string;
  name: string
  init(): string
  npx(command: string, args: string): string
  ci(): string
  installDevDependency(name: string): string
  runPlaywrightTest(args?: string): string
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
    return 'yarn'
  }

  installDevDependency(name: string): string {
    return `yarn add --dev ${name}`
  }

  runPlaywrightTest(args: string): string {
    return this.npx('playwright', `test${args ? (' ' + args) : ''}`);
  }
}

class PNPM implements PackageManager {
  name = 'pnpm'
  cli = 'pnpm'

  init(): string {
    return 'pnpm init'
  }

  npx(command: string, args: string): string {
    return `pnpm exec ${command} ${args}`
  }

  ci(): string {
    return 'pnpm install'
  }

  installDevDependency(name: string): string {
    return `pnpm add --save-dev ${name}`
  }

  runPlaywrightTest(args: string): string {
    return this.npx('playwright', `test${args ? (' ' + args) : ''}`);
  }
}

function determinePackageManager(): PackageManager {
  if (process.env.npm_config_user_agent) {
    if (process.env.npm_config_user_agent.includes('yarn'))
      return new Yarn()
    if (process.env.npm_config_user_agent.includes('pnpm'))
      return new PNPM()
    return new NPM()
  }
  return new NPM()
}

export const packageManager = determinePackageManager();
