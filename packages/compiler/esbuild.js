// @htx/compiler/esbuild
// an esbuild plugin: every .htx the bundle reaches is compiled on load.
//
//   import { htx } from '@htx/compiler/esbuild';
//   await esbuild.build({ entryPoints: ['app.js'], bundle: true, plugins: [htx()] });

// :::::: IMPORTS

import { readFile } from 'node:fs/promises';
import { dirname }  from 'node:path';

import { compile } from './index.js';

// :::::: PLUGIN

/** options go to compile(), e.g. { adapter: '@htx/js' } */
function htx (options = {}) {
  return {
    name  : 'htx',
    setup (build) {
      build.onLoad({ filter: /\.htx$/ }, async ({ path }) => {
        const source = await readFile(path, 'utf8');

        try {
          const { code } = compile(source, { ...options, filename: path });
          return { contents: code, loader: 'js', resolveDir: dirname(path) };
        }
        catch (err) {
          const location = err.line ? { file: path, line: err.line, column: err.column - 1 } : null;
          return { errors: [{ text: err.message, location }] };
        }
      });
    },
  };
}

// :::::: EXPORT

export { htx };
export default htx;
