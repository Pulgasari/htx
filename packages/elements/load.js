// @htx/elements/load.js
// an .htx file as a module, compiled in the browser: fetched, run through
// @htx/compiler and imported from a blob url. a blob module has no path of its
// own, so every relative specifier is resolved against the file first, and an
// imported .htx file is loaded the same way and handed over as its blob url.

import { compile } from '@htx/compiler';

const HTX = /\.htx(\.html)?$/;

// adapter + url -> promise of the module. a file is fetched and compiled once
const modules = new Map;

const isRelative = specifier => /^\.{1,2}\//.test(specifier);

async function source (url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`[htx] ${url}: HTTP ${response.status}`);
  return response.text();
}

async function build (url, adapter) {
  const text = await source(url);

  // first pass: the specifiers, absolute, and which of them are .htx files
  const absolute = specifier => isRelative(specifier) ? new URL(specifier, url).href : specifier;
  const files    = new Set;
  compile(text, { adapter, filename: url, resolve: specifier => {
    const next = absolute(specifier);
    if (HTX.test(next)) files.add(next);
    return next;
  } });

  // the .htx imports as blob urls, the rest as absolute urls or as they are
  const blobs = new Map(await Promise.all([...files].map(async file => [file, (await entry(file, adapter)).blob])));
  const { code } = compile(text, { adapter, filename: url, resolve: specifier => blobs.get(absolute(specifier)) ?? absolute(specifier) });

  const blob = URL.createObjectURL(new Blob([code + `\n//# sourceURL=${url}.js\n`], { type: 'text/javascript' }));
  return { blob, module: await import(blob) };
}

function entry (url, adapter) {
  const key = `${adapter} ${url}`;
  if (!modules.has(key)) {
    const job = build(url, adapter);
    job.catch(() => modules.delete(key));   // a failed load is tried again next time
    modules.set(key, job);
  }
  return modules.get(key);
}

/** the module of an .htx file: its component as default export, `style` if it has one */
async function load (url, { adapter = '@htx/js', base = document.baseURI } = {}) {
  return (await entry(new URL(url, base).href, adapter)).module;
}

export { load };
export default load;
