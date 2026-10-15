// @htx/ts-plugin/styles.js
// the class names the project's stylesheets define, for completion in selectors
// and class="". every .css below the project root except node_modules and build
// output; the file list is read again after a few seconds, a file when it changed.

import { classesOf } from '@htx/analyzer';

const LIST_TTL = 5000;   // ms a directory listing is trusted

const files = new Map;   // path -> { time, names }
let listing = { at: 0, paths: [], root: null };

function stylesheets (ts, root) {
  const now = Date.now();
  if (listing.root !== root || now - listing.at > LIST_TTL) {
    const paths = ts.sys.readDirectory(root, ['.css'], ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'], ['**/*']);
    listing = { at: now, paths: paths.slice(0, 1000), root };
  }
  return listing.paths;
}

function classesIn (ts, root) {
  const out = new Set;
  for (const path of stylesheets(ts, root)) {
    const time   = ts.sys.getModifiedTime?.(path)?.getTime() ?? 0;
    let   cached = files.get(path);
    if (!cached || cached.time !== time) files.set(path, cached = { names: classesOf(ts.sys.readFile(path) ?? ''), time });
    for (const name of cached.names) out.add(name);
  }
  return out;
}

export { classesIn };
