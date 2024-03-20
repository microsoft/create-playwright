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
import { allOptions, Generator, Option, OptionName } from './generator';

const booleanOptionPairs: [OptionName, OptionName][] = [];

for (const [option] of allOptions) {
  if (option.startsWith('--no-')) {
    const positiveOption = option.replace('--no-', '--') as Option;
    if (allOptions.map(([option]) => option).includes(positiveOption)) {
      booleanOptionPairs.push([
        option.replace('--', '') as OptionName,
        positiveOption.replace('--', '') as OptionName,
      ]);
    }
  }
}

(async () => {
  const argv = process.argv.slice(2);
  const args = argv.filter(a => !a.startsWith('--'));
  const options: { [key: string]: string[] } = {};
  for (const token of argv.filter(a => a.startsWith('--'))) {
    const match = token.match(/--([^=]+)(?:=(.*))?/);
    if (!match)
      continue;
    const [, name, value] = match;
    const oldValue = options[name];
    if (oldValue)
      oldValue.push(value);
    else if (value)
      options[name] = [value];
    else
      options[name] = [];
  }
  if (options.help) {
    _printHelp();
    process.exit(0);
  }

  const bothBooleanOptionsSpecified = booleanOptionPairs.filter(
    ([positive, negative]) => options[positive] && options[negative],
  );
  if (bothBooleanOptionsSpecified.length > 0) {
    console.error(
      `Cannot specify both of:
  ${bothBooleanOptionsSpecified
    .map(([positive, negative]) => `- ${positive} and ${negative}`)
    .join('\n')}`,
    );
    process.exit(1);
  }

  const rootDir = path.resolve(process.cwd(), args[0] || '');
  const generator = new Generator(rootDir, options);
  await generator.run();
})().catch(error => {
  console.error(error);
  process.exit(1);
});

function _printHelp() {
  console.log(`Usage: npx create-playwright@latest [options] [rootDir]
    Available options are:
${allOptions.map(([option, description]) => `      ${option}: ${description}`).join('\n')}
    `);
}
