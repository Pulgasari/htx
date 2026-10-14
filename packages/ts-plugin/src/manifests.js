// @htx/ts-plugin/manifests.js
// the custom elements manifests of a project, found in three places:
//
//   plugin config      "manifests": ["./custom-elements.json"]
//   project root       custom-elements.json
//   dependencies       the "customElements" field of their package.json (the
//                      standard way a package points at its manifest)
//
// a file is read again when its modification time changed.

const files = new Map;   // path -> { time, manifest }

function join (...parts) {
  return parts.join('/').replace(/\/+/g, '/').replace(/\/\.\//g, '/');
}

function dirname (path) {
  return path.replace(/\/[^/]*$/, '') || '/';
}

function read (ts, path) {
  if (!ts.sys.fileExists(path)) return null;
  const time   = ts.sys.getModifiedTime?.(path)?.getTime() ?? 0;
  const cached = files.get(path);
  if (cached && cached.time === time) return cached.manifest;
  try {
    const manifest = JSON.parse(ts.sys.readFile(path));
    files.set(path, { manifest, time });
    return manifest;
  } catch {
    files.set(path, { manifest: null, time });
    return null;
  }
}

function manifestsOf (ts, root, config) {
  const paths = new Set;
  for (const path of config.manifests ?? []) paths.add(path.startsWith('/') ? path : join(root, path));
  paths.add(join(root, 'custom-elements.json'));

  const pkg = read(ts, join(root, 'package.json'));
  for (const name of Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.peerDependencies })) {
    const dependency = read(ts, join(root, 'node_modules', name, 'package.json'));
    if (dependency?.customElements) paths.add(join(root, 'node_modules', name, dependency.customElements));
  }

  const out = [];
  for (const path of paths) {
    const manifest = read(ts, path);
    if (manifest) out.push({ manifest, source: path });
  }
  return out;
}

export { dirname, join, manifestsOf };
