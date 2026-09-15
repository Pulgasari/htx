// core.js — DOM-free compile pipeline: htx source string -> html string.
//
// Builds its own tiny tree instead of touching a real document, so this
// runs identically in the browser, node and deno. Mounting into a real DOM
// and wiring up on:event bindings is a browser-only concern and lives in
// htx.js (the "pure" runtime) — this module never touches `document`.
//
// Pipeline:
//   1. preParse()    string shorthand -> parseable html
//   2. parse()       html string -> tree of { tag, attrs, children }
//   3. collectDefs() pull out <tmpl> definitions into a registry
//   4. expand()      resolve custom tags (mappings, templates, div-fallback)
//   5. serialize()   tree -> html string

import { preParse } from './preparser2.js';
import { VOID_TAGS, STANDARD_TAGS, RAW_TEXT_TAGS } from './meta.js';

// :::::: PUBLIC API

function compile (source) {
  const root = parse(preParse(source ?? ''));
  const defs = collectDefs(root);
  expand(root, defs);

  return serialize(root);
}

export       { compile };
export default compile;

// :::::: TREE PARSER

function parse (html) {
  const root  = { tag: null, attrs: [], children: [] };
  const stack = [root];
  const len   = html.length;

  let pos = 0;

  while (pos < len) {
    const lt = html.indexOf('<', pos);

    if (lt === -1) {
      pushText(stack, html.slice(pos));
      break;
    }

    if (lt > pos) pushText(stack, html.slice(pos, lt));

    if (html.startsWith('<!--', lt)) {
      const end  = html.indexOf('-->', lt + 4);
      const stop = end === -1 ? len : end + 3;
      pushText(stack, html.slice(lt, stop));
      pos = stop;
      continue;
    }

    if (html[lt + 1] === '/') {
      const gt = html.indexOf('>', lt);
      if (gt === -1) { pushText(stack, html.slice(lt)); break; }

      const name = html.slice(lt + 2, gt).trim().toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === name) { stack.length = i; break; }
      }

      pos = gt + 1;
      continue;
    }

    const tagMatch = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt));

    if (!tagMatch) {
      pushText(stack, '<');
      pos = lt + 1;
      continue;
    }

    const tag    = tagMatch[1].toLowerCase();
    const parsed = parseAttrs(html, lt + 1 + tag.length);
    const node   = { tag, attrs: parsed.attrs, children: [] };

    stack[stack.length - 1].children.push(node);
    pos = parsed.end;

    if (parsed.selfClose || VOID_TAGS.has(tag)) continue;

    if (RAW_TEXT_TAGS.has(tag)) {
      const closeRe = new RegExp(`</${tag}\\s*>`, 'i');
      const rest    = html.slice(pos);
      const match   = closeRe.exec(rest);
      const rawEnd  = match ? match.index : rest.length;

      if (rawEnd > 0) node.children.push({ text: rest.slice(0, rawEnd) });
      pos += rawEnd + (match ? match[0].length : 0);
      continue;
    }

    stack.push(node);
  }

  return root;
}

function pushText (stack, text) {
  if (text) stack[stack.length - 1].children.push({ text });
}

function parseAttrs (html, start) {
  const len = html.length;

  let pos       = start;
  let selfClose = false;

  const attrs = [];

  while (pos < len) {
    while (pos < len && isSpace(html[pos])) pos++;

    if (html[pos] === '>') { pos++; break; }
    if (html[pos] === '/' && html[pos + 1] === '>') { selfClose = true; pos += 2; break; }
    if (pos >= len) break;

    const nameStart = pos;
    while (
      pos < len &&
      !isSpace(html[pos]) &&
      html[pos] !== '=' &&
      html[pos] !== '>' &&
      !(html[pos] === '/' && html[pos + 1] === '>')
    ) pos++;

    const name = html.slice(nameStart, pos);
    if (!name) { pos++; continue; }

    while (pos < len && isSpace(html[pos])) pos++;

    let value = '';

    if (html[pos] === '=') {
      pos++;
      while (pos < len && isSpace(html[pos])) pos++;

      const quote = html[pos];

      if (quote === '"' || quote === "'") {
        pos++;
        const valueStart = pos;
        while (pos < len && html[pos] !== quote) pos++;
        value = html.slice(valueStart, pos);
        pos++;
      } else {
        const valueStart = pos;
        while (pos < len && !isSpace(html[pos]) && html[pos] !== '>') pos++;
        value = html.slice(valueStart, pos);
      }
    }

    attrs.push({ name, value });
  }

  return { attrs, selfClose, end: pos };
}

const isSpace = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';

const escapeAttr = (str) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// :::::: SERIALIZER

function serialize (node) {
  if (node.text !== undefined) return node.text;
  if (!node.tag) return node.children.map(serialize).join('');

  let out = `<${node.tag}`;
  for (const { name, value } of node.attrs) out += ` ${name}="${escapeAttr(value)}"`;

  if (VOID_TAGS.has(node.tag)) return `${out}>`;

  out += '>';
  out += node.children.map(serialize).join('');
  out += `</${node.tag}>`;

  return out;
}

// :::::: DEFINITIONS

function collectDefs (root) {
  const defs = new Map;

  (function walk (node) {
    node.children = node.children.filter((child) => {
      if (!child.tag) return true;

      walk(child);
      if (child.tag !== 'tmpl') return true;

      const tag = (getAttr(child, 'tag') || '').toLowerCase();
      if (tag) {
        const is = getAttr(child, 'is');
        if (is) defs.set(tag, { kind: 'map', is, attr: getAttr(child, 'attr') });
        else    defs.set(tag, { kind: 'template', html: serialize({ tag: null, children: child.children }) });
      }

      return false;
    });
  })(root);

  return defs;
}

// :::::: EXPANSION

function expand (root, defs) {
  let guard = 0;

  for (let changed = true; changed && guard < 100; guard++) {
    changed = false;

    for (const { node, parent } of collectElements(root)) {
      const tag = node.tag;

      if (tag === 'tmpl') {
        removeChild(parent, node);
        changed = true;
      } else if (defs.has(tag)) {
        const def = defs.get(tag);
        if (def.kind === 'map') expandMapping  (node, def);
        else                    expandTemplate (node, def, parent);
        changed = true;
      } else if (STANDARD_TAGS.has(tag) || tag.includes('-')) {
        continue;
      } else {
        expandToDiv(node, tag);
        changed = true;
      }
    }
  }
}

function collectElements (root) {
  const out = [];

  (function walk (node) {
    for (const child of node.children) {
      if (!child.tag) continue;
      out.push({ node: child, parent: node });
      walk(child);
    }
  })(root);

  return out;
}

function removeChild (parent, node) {
  const i = parent.children.indexOf(node);
  if (i !== -1) parent.children.splice(i, 1);
}

function expandMapping (el, def) {
  const attrs = [];
  let attrText = null;

  for (const { name, value } of el.attrs) {
    if (name === '$attr') {
      if (def.attr) attrs.push({ name: def.attr, value });
      else          attrText = value;
    } else {
      attrs.push({ name, value });
    }
  }

  el.tag   = def.is;
  el.attrs = attrs;

  if (VOID_TAGS.has(def.is.toLowerCase())) {
    el.children = [];
  } else if (attrText !== null) {
    el.children = [{ text: attrText }, ...el.children];
  }
}

function expandTemplate (el, def, parent) {
  const fragment = parse(substitute(def.html, el)).children;
  const i         = parent.children.indexOf(el);
  if (i !== -1) parent.children.splice(i, 1, ...fragment);
}

function expandToDiv (el, tag) {
  const attrs = [];
  let attrText      = null;
  let existingClass = null;

  for (const { name, value } of el.attrs) {
    if      (name === 'class') existingClass = value;
    else if (name === '$attr') attrText       = value;
    else                        attrs.push({ name, value });
  }

  attrs.unshift({ name: 'class', value: existingClass ? `${tag} ${existingClass}` : tag });

  el.tag   = 'div';
  el.attrs = attrs;

  if (attrText !== null) el.children = [{ text: attrText }, ...el.children];
}

function substitute (html, el) {
  return html.replace(/\$([a-zA-Z_][\w-]*)/g, (_, name) => {
    const value = name === 'attr' ? getAttr(el, '$attr') : getAttr(el, name);
    return value == null ? '' : value;
  });
}

function getAttr (el, name) {
  const attr = el.attrs.find((a) => a.name === name);
  return attr ? attr.value : null;
}
