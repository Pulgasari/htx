// @htx/analyzer/context.js
// what a template is checked against: html, the manifests of custom elements and
// the tag registry (html.define). the host builds it once per project state and
// passes it to analyze() and the queries.
//
//   createContext({
//     manifests : [{ manifest: json, source: '/app/node_modules/@aufbau/elements/custom-elements.json' }],
//     tags      : { $icon: { tag: 'aufbau-icon', args: ['icon', 'size'], location } },
//     partial   : false,   // true: some html.define() could not be read, unknown shorthands are no error
//     classes   : ['card', 'active'],   // class names for selectors and class="", see classesOf(css)
//   });

import { ATTRIBUTES, SVG_TAGS, TAGS, VALUES, mdn } from './html.js';
import { readManifest }                            from './manifest.js';

// the registry key htx uses: $icon stays, inputColor becomes input-color
const kebab = name => name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);
const keyOf = name => name[0] === '$' ? name : kebab(name);

// a spec as html.define() takes it, read statically: a tag name, { tag, args, props },
// or { component: 'Name' } for a function the host could not turn into a value
function entryOf (name, spec) {
  const base = { args: [], component: null, key: keyOf(name), location: spec?.location ?? null, name, props: {}, tag: null };
  if (typeof spec === 'string') return { ...base, tag: spec };
  if (!spec || typeof spec !== 'object') return base;
  const args = spec.args ?? [];
  return { ...base, args: typeof args === 'string' ? [args] : args, component: spec.component ?? null, props: spec.props ?? {}, tag: spec.tag ?? null };
}

function htmlAttributes (tag) {
  const out = new Map;
  for (const name of ATTRIBUTES[tag] ?? []) out.set(name, { description: '', name, type: null, values: VALUES[`${tag}.${name}`] ?? VALUES[name] ?? null });
  return out;
}

// what is known about a tag name, without the registry
function infoOf (tag, custom) {
  if (custom.has(tag)) return custom.get(tag);
  if (tag in TAGS)     return { attributes: htmlAttributes(tag), description: TAGS[tag], events: [], kind: 'html', link: mdn(tag), members: new Map, slots: [], tag };
  if (SVG_TAGS.has(tag)) return { attributes: new Map, description: 'an svg element', events: [], kind: 'svg', members: new Map, slots: [], tag };
  return { attributes: new Map, description: '', events: [], kind: tag.includes('-') ? 'custom-unknown' : 'unknown', members: new Map, slots: [], tag };
}

// the class names a stylesheet defines: .name in its selectors, not in urls, strings or numbers
function classesOf (css) {
  const names = new Set;
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)/g, '').replace(/(["'])(?:\\.|(?!\1).)*\1/g, '');
  for (const [, name] of clean.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) names.add(name);
  return names;
}

function createContext ({ classes = [], manifests = [], partial = false, tags = {} } = {}) {
  const custom = new Map;
  for (const entry of manifests) {
    if (entry?.modules) readManifest(entry, null, custom);
    else readManifest(entry?.manifest, entry?.source ?? null, custom);
  }

  const registry = new Map;
  for (const [name, spec] of Object.entries(tags)) {
    const entry = entryOf(name, spec);
    registry.set(entry.key, entry);
  }

  // an element node -> what it renders and what is known about that, plus the
  // registry entry it went through
  function resolve (element) {
    if (element.tagHole !== undefined) return { ...infoOf('', custom), kind: 'dynamic' };
    if (element.fragment) return { ...infoOf('', custom), kind: 'fragment' };

    const entry = registry.get(element.tag[0] === '$' ? element.tag : keyOf(element.tag)) ?? null;
    if (element.tag[0] === '$' && !entry)  return { ...infoOf('', custom), kind: 'unknown-shorthand', via: null };
    if (entry?.component)                  return { ...infoOf('', custom), kind: 'component', via: entry };
    return { ...infoOf(entry?.tag ?? element.tag, custom), via: entry };
  }

  return { classes: new Set(classes), custom, partial, registry, resolve, tag: tag => infoOf(tag, custom) };
}

export { classesOf, createContext, keyOf };
export default createContext;
