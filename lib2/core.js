// core.js — second engine: same DOM-free tree/expand/serialize machinery as
// lib/core.js, but with its own def-tag vocabulary and one extra shorthand:
//
//   <htx-tag:btn  is='aufbau-button' attr='label' />   (was <tmpl tag='btn' is=... />)
//   <htx-template:track> ... </htx-template>           (was <tmpl tag='track'> ... </tmpl>)
//
// `tag:value` / `tag:'value'` fused onto ANY tag name is a second form of
// the existing one-positional-arg sugar (`<tag 'value'>` -> $attr="value"),
// just spelled on the tag itself instead of after it. It has to run before
// preParse(), since preParse's tag-name scanner doesn't treat ':' as a name
// character and would otherwise leave it dangling in the attribute soup.

import { preParse } from '../lib/preparser2.js';
import { parse, serialize, expand, getAttr } from '../lib/core.js';

// :::::: PUBLIC API

function compile (source) {
  const root = parse(preParse(colonSugar(source ?? '')));
  const defs = collectDefs(root);
  expand(root, defs);

  return serialize(root);
}

export       { compile };
export default compile;

// :::::: COLON-SUGAR PREPROCESSOR

const RGX_COLON_SUGAR = /<([a-zA-Z][a-zA-Z0-9-]*):(?:'([^']*)'|"([^"]*)"|([a-zA-Z0-9_-]+))/g;

function colonSugar (code) {
  return code.replace(RGX_COLON_SUGAR, (_, tag, single, double, bare) => {
    const value = single ?? double ?? bare;
    return `<${tag} $attr="${escapeAttr(value)}"`;
  });
}

const escapeAttr = (str) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// :::::: DEFINITIONS
//
// <htx-tag> is always a shorthand mapping, <htx-template> is always a full
// template body — the tag itself says which, instead of lib/core.js's
// single <tmpl> deciding by whether `is` is present. The name comes from
// the positional $attr (the `:btn` sugar) or a plain `tag='btn'` attribute.

function collectDefs (root) {
  const defs = new Map;

  (function walk (node) {
    node.children = node.children.filter((child) => {
      if (!child.tag) return true;

      walk(child);

      if (child.tag === 'htx-tag') {
        const name = defName(child);
        if (name) defs.set(name, { kind: 'map', is: getAttr(child, 'is'), attr: getAttr(child, 'attr') });
        return false;
      }

      if (child.tag === 'htx-template') {
        const name = defName(child);
        if (name) defs.set(name, { kind: 'template', html: serialize({ tag: null, children: child.children }) });
        return false;
      }

      return true;
    });
  })(root);

  return defs;
}

function defName (el) {
  return (getAttr(el, '$attr') || getAttr(el, 'tag') || '').toLowerCase();
}
