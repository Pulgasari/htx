// @htx/compiler/node
// module hooks for node: an imported .htx is compiled while it loads. register
// them through ./register.js, or by hand for options of your own:
//
//   import { register } from 'node:module';
//   register('@htx/compiler/node', import.meta.url, { data: { adapter: '@htx/js' } });

// :::::: IMPORTS

import { readFile }      from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { compile } from './index.js';

// :::::: HOOKS

let options = {};

/** receives register()'s data, i.e. the options for compile() */
async function initialize (data) {
  options = data ?? {};
}

async function load (url, context, nextLoad) {
  if (!url.startsWith('file:') || !url.endsWith('.htx')) return nextLoad(url, context);

  const filename = fileURLToPath(url);
  const source   = await readFile(filename, 'utf8');

  return { format: 'module', shortCircuit: true, source: compile(source, { ...options, filename }).code };
}

// :::::: EXPORT

export { initialize, load };
