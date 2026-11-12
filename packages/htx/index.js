// @ts-self-types="./index.d.ts"
// HTX = HTM EXTENDED (but we couldn't name it HTMX lol)

/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/*
modified fork of htm (developit/htm). changes vs upstream:
- htm's parser is gone: build() writes its opcodes from the tree of scan.js, the one parser of the syntax
- every prop write goes through setProp/appendProp instead of assigning directly,
  so duplicate class/className/class:* /style survive spreads instead of overwriting
- empty tag (<>...</>) falls back to Fragment
- class accepts string | array | object
- style accepts object
- a prop group — id|title='x' — writes one value to several names
- a tag selector — <div#main.card.big> — sets id and class
- !html names the raw-html escape hatch, which each adapter then writes
*/

// :::::: IMPORT

import { scanner } from './scan.js';

// :::::: HELPERS

const isArray  = Array.isArray;
const isFn     = value => typeof value === 'function';
const isString = value => typeof value === 'string';
const isObject = value => value !== null && typeof value === 'object' && !isArray(value);

// :::::: CONSTANTS

const CHILD_APPEND  = 0;
const CHILD_RECURSE = 2;
const TAG_SET       = 3;
const PROPS_ASSIGN  = 4;
const PROP_SET      = 5;
const PROP_APPEND   = 6;

// :::::: PROP MERGING
// class and style collect every write while a tag is built and become one value in
// finalize. the collection stands under the key itself, so props keeps its shape:
// a delete would turn it into a slow dictionary object, for htx and for h alike

const POSITIONAL = Symbol('positional');
const RAW_HTML   = '!html';

class Parts {
  list = [];   // [key, value], in the order written

  add (key, value) {
    if (value instanceof Parts) this.list.push(...value.list);
    else                        this.list.push([key, value]);
  }
}

const isClassKey = key => key === 'class' || key === 'className' || key.startsWith('class:');

function addClass (list, value) {
       if (!value) return;
  else if (isString(value)) list.push(value);
  else if  (isArray(value)) for (const item of value) addClass(list, item);
  else if (isObject(value)) for (const name in value) if (value[name]) list.push(name);
}

function partsOf (props, name) {
  const parts = props[name];
  return parts instanceof Parts ? parts : (props[name] = new Parts);
}

function setProp (props, key, value) {
       if (key === POSITIONAL) (props[key] ??= []).push(value);
  else if (isClassKey(key))    partsOf(props, 'class').add(key, value);
  else if (key === 'style')    partsOf(props, 'style').add(key, value);
  else                         props[key] = value;
}

function appendProp (props, key, value) {
  const name = isClassKey(key) ? 'class' : key === 'style' ? 'style' : null;

  if (!name) { props[key] += value + ''; return; }

  // the entry this append belongs to is the last one written under the same
  // key, not simply the last one: a prop group interleaves its siblings, so
  // class|className="a${x}" writes both before either appends
  const { list } = props[name];
  let i = list.length - 1;
  while (i > 0 && list[i][0] !== key) i--;

  const entry = list[i];
  entry[1] = (entry[1] == null ? '' : entry[1]) + value;
}

function joinClasses (list) {
  // one plain string, the common case, needs no dedupe
  const [[key, value]] = list;
  if (list.length === 1 && isString(value) && !key.startsWith('class:')) return value || undefined;

  const names = [];
  for (const [key, value] of list) {
    if (key.startsWith('class:')) { if (value) names.push(key.slice(6)); }
    else addClass(names, value);
  }
  return names.length ? [...new Set(names)].join(' ') : undefined;
}

// objects merge left to right. a string value discards everything before it,
// so don't mix the two forms on one element
function mergeStyles (list) {
  if (list.length === 1 && isString(list[0][1])) return list[0][1] || undefined;

  let merged;
  for (const [, value] of list) {
         if (!value)           continue;
    else if (isString(value))  merged = value;
    else if (isObject(merged)) Object.assign(merged, value);
    else                       merged = { ...value };
  }
  return merged || undefined;
}

function finalize (props) {
  if (props?.class instanceof Parts) props.class = joinClasses(props.class.list);
  if (props?.style instanceof Parts) props.style = mergeStyles(props.style.list);
  return props;
}

// :::::: EVALUATE

function evaluate (h, built, fields, args, memo = true) {
  let tmp;
  built[0] = 0;

  for (let i = 1; i < built.length; i++) {
    const type  = built[i++];
    const value = built[i] ? ((built[0] |= type ? 1 : 2), fields[built[i++]]) : built[++i];
    /*
    switch (type) {
      case TAG_SET      : args[0] = value;; break;
      case PROPS_ASSIGN : const props = args[1] || (args[1] = {}); for (const key of Object.keys(value)) setProp(props, key, value[key]); break;      
      case PROP_SET     : setProp(args[1] || (args[1] = {}), built[++i], value); break;
      case PROP_APPEND  : appendProp(args[1], built[++i], value); break;
    }
    */
    if (type === TAG_SET) {
      args[0] = value;
    }
    else if (type === PROPS_ASSIGN) {
      // a nullish spread adds nothing, as Object.assign in htm has it
      const props = args[1] || (args[1] = {});
      for (const key of Object.keys(value ?? {})) setProp(props, key, value[key]);
    }
    else if (type === PROP_SET) {
      setProp(args[1] || (args[1] = {}), built[++i], value);
    }
    else if (type === PROP_APPEND) {
      appendProp(args[1], built[++i], value);
    }
    else if (type) {
      tmp = h.call(value, evaluate(h, value, fields, ['', null], memo));
      args.push(tmp);

      if (value[0] || !memo) {
        built[0] |= 2;
      }
      else {
        built[i-2] = CHILD_APPEND;
        built[i]   = tmp;
      }
    }
    else args.push(value); // // type === CHILD_APPEND
    
  }

  return args;
}

// :::::: BUILD

/*
a template literal as the opcodes evaluate() runs: the statics are joined with a
marker where a hole stands, scanned (scan.js) and written out per element as

  TAG_SET, PROP_SET / PROP_APPEND / PROPS_ASSIGN in the order written, then the children

a field of 0 or undefined means a static value, any other one the n-th hole.
what the scanner reports goes to the console once per template, a malformed
prop group is thrown: it is a typo rather than a name.
*/

const MARK = '￿';

function build (statics) {
  let field = 0;

  const p = scanner(statics.join(MARK), {
    hole      : p => p.source[p.i] === MARK ? (p.i++, { value: ++field }) : undefined,
    holeStart : (source, index) => source[index] === MARK,
    tolerant  : true,
  });
  const nodes = p.nodes('eof', { depth: 0 });

  for (const error of [...p.errors, ...p.warnings]) {
    if (error.code === 'htx-group') throw new Error(`[htx] ${error.text}`);
    console.warn(`[htx] ${error.text}`);
  }

  return childrenInto([0], nodes);
}

// a newline with the whitespace around it at the edge of a text is indentation, not content
const trimText = text => text.replace(/^\s*\n\s*|\s*\n\s*$/g, '');

function childrenInto (list, nodes) {
  for (const node of nodes) {
    if (node.type === 'hole') list.push(CHILD_APPEND, node.hole, '');
    else if (node.type === 'element') list.push(CHILD_RECURSE, 0, elementInto([0], node));
    else if (node.type === 'text') {
      const text = trimText(node.text);
      if (text) list.push(CHILD_APPEND, undefined, text);
    }
  }
  return list;
}

function elementInto (list, node) {
  if (node.tagHole !== undefined) list.push(TAG_SET, node.tagHole, '');
  else if (!node.fragment) {
    list.push(TAG_SET, undefined, node.tag);
    if (node.id)             list.push(PROP_SET, 0, node.id.name, 'id');
    if (node.classes.length) list.push(PROP_SET, 0, node.classes.map(item => item.name), 'class');
  }

  for (const { names, positional, spread, value } of node.attributes) {
    if (spread) { list.push(PROPS_ASSIGN, value.hole, 0); continue; }

    if (positional) {
      if (value.kind === 'hole' && !value.quoted) list.push(PROP_SET, value.hole, 0, POSITIONAL);
      else if (value.kind === 'string' && value.text) list.push(PROP_SET, 0, value.text, POSITIONAL);
      continue;
    }

    if (value.kind === 'true') { for (const name of names) list.push(PROP_SET, 0, true, name); continue; }

    // one op per name and piece, so every name of a group gets the same value and then the same appends
    const pieces = value.kind === 'parts' ? value.parts : value.kind === 'hole' ? [{ hole: value.hole }] : [value.text];
    let mode = PROP_SET;
    for (const piece of pieces) {
      for (const name of names) typeof piece === 'string' ? list.push(mode, 0, piece, name) : list.push(mode, piece.hole, 0, name);
      mode = PROP_APPEND;
    }
  }

  return childrenInto(list, node.children);
}

// :::::: SHORTHAND TAGS ::::::::::::::::::::::::::::::::::::::::

/*
the registry knows two kinds of tags, told apart by the name they are defined under.

a shorthand is defined with a leading $ and written the same way. it stands for
another tag:

  html.define('$icon', { tag: 'aufbau-icon', args: ['icon', 'size'], props: { mode: 'mask' } });

  <$icon 'bx:search' />          ->  <aufbau-icon icon="bx:search" mode="mask">
  <$icon 'bx:search' '2em' />    ->  <aufbau-icon icon="bx:search" size="2em" mode="mask">
  <$icon 'x' mode="image" />     ->  <aufbau-icon icon="x" mode="image">

a name without $ is a real tag, camelCase for its kebab-case: htx only learns
what the positional values fill and which defaults it has. `tag` is optional,
it renders the written tag as another one, e.g. a renamed custom element:

  html.define('inputColor', { args: 'value' });

  <input-color 'red' />          ->  <input-color value="red">
*/

// inputColor -> input-color. a real tag name has no capitals, so nothing is lost
const kebab = name => name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`);

/** the registry key of a defined name: $icon stays, inputColor becomes input-color */
const keyOf = name => name[0] === '$' ? name : kebab(name);

// 'aufbau-icon' | Component | { tag?, args?, props? }. a shorthand needs its tag
function normalizeTag (spec) {
  if (isString(spec) || isFn(spec)) return { tag: spec, args: [], props: null };
  if (!isObject(spec)) throw new Error('[htx] a tag spec is a tag name, a component, or { tag, args, props }');

  // a single positional needs no array around it
  const args = spec.args ?? [];

  return { tag: spec.tag, args: isString(args) ? [args] : args, props: spec.props ?? null };
}

function resolveTag (props, entry) {
  const out = {};

  // defaults first, so a class or style written on the tag appends to them
  // instead of replacing them
  if (entry?.props) for (const key in entry.props) setProp(out, key, entry.props[key]);

  if (props) for (const key in props) setProp(out, key, props[key]);

  const positional = props?.[POSITIONAL];
  if (!positional) return [out, []];

  const args  = entry?.args ?? [];
  const extra = [];

  for (let i = 0; i < positional.length; i++) {
    const name = args[i];

    if (!name) extra.push(positional[i]);
    else if (!props || !(name in props)) out[name] = positional[i];
  }

  return [out, extra];
}

// :::::: TAG FUNCTION

function createHTX (h, Fragment, { memo = true, tags } = {}) {
  const cache      = new Map;
  const normalized = new Map;
  const registry   = Object.create(null);
  let   hasTags    = false;   // any real tag defined, so plain tags skip the lookup until then

  // keyed on the spec object, so reassigning a tag re-normalises it. the key is
  // '$icon' for a shorthand and 'input-color' for a real tag
  const entryFor = (key) => {
    const spec = registry[key];
    if (!spec) return null;

    let entry = normalized.get(spec);
    if (!entry) normalized.set(spec, entry = normalizeTag(spec));

    return entry;
  };

  // args is [type, props, ...children] as evaluate built it, and it is handed on as it is
  const hx = function (args) {
    let [type, props] = args;
    let entry = null;

    if (isString(type) && type[0] === '$') {
      entry = entryFor(type);
      // silently rendering a <$foo> element would be a typo nobody finds: as a
      // tag name it is invalid for createElement and merely unknown to a vdom
      if (!entry?.tag) throw new Error(`[htx] unknown shorthand tag <${type}>`);
      type = entry.tag;
    }

    // a real tag defined without $: its args and defaults, maybe another name to render under
    else if (hasTags && isString(type)) {
      entry = entryFor(type);
      if (entry?.tag) type = entry.tag;
    }

    // a positional on a plain tag has nowhere to go but the children, which
    // makes <div 'text' /> read as <div>text</div>
    if (entry || props?.[POSITIONAL]) {
      const [resolved, extra] = resolveTag(props, entry);
      props = resolved;
      if (extra.length) args.splice(2, 0, ...extra);
    }

    args[0] = type || Fragment;
    args[1] = finalize(props);
    return h.apply(this, args);
  };

  function html (statics) {
    let built = cache.get(statics);
    if (!built) cache.set(statics, built = build(statics));

    const result = evaluate(hx, built, arguments, [], memo);
    return result.length > 1 ? result : result[0];
  }

  /** define('$icon', spec), define('inputColor', spec) or define({ $icon: spec, inputColor: spec }) */
  html.define = (name, spec) => {
    const specs = isString(name) ? { [name]: spec } : name;
    for (const [key, value] of Object.entries(specs)) {
      registry[keyOf(key)] = value;
      if (key[0] !== '$') hasTags = true;
    }
    return html;
  };

  html.tags = registry;

  // use('md', fn) or use({ md: fn, … })
  html.use = (name, fn) => {
    const helpers = isString(name) ? { [name]: fn } : name;

    // a helper named after the api would replace it, and the failure would
    // show up far from the call that caused it
    for (const key of Object.keys(helpers)) {
      if (key === 'define' || key === 'tags' || key === 'use') throw new Error(`[htx] '${key}' is part of the html api and cannot be a helper`);
    }

    Object.assign(html, helpers);
    return html;
  };

  if (tags) html.define(tags);

  return html;
}

// :::::: PROGRAM

/*
the parsed template as a tree with numbered holes, for a renderer that has to
know what is static and what comes from an interpolation (@domina/render). an
h-adapter never needs it: it gets finished values through createHTX(h).

  html`<section.card id=${id}><h2>${title}</h2>${body}</section>`

  { nodes: [{ tag: 'section', props: [['class', ['card']], ['id', { hole: 0 }]], children: [
      { tag: 'h2', props: [], children: [{ hole: 1 }] },
      { hole: 2 },
  ] }] }

a node is a string (text), { hole } (a child value) or { tag, props, children }.
a tag is a string, a component, or { hole } for an interpolated one. props is a
list in the order written, so class and style keep every write: [name, value],
value a static, { hole } or { parts } (text and holes, title="a ${b}"), and
{ spread } for ...${object}. tag selectors, prop groups, shorthand tags with a
static name and positional values are resolved here, a renderer only sees plain
elements. `tags` is the registry of a tag function (html.tags).
*/

const programs = new Map;   // statics -> Map(registry -> program)
const NO_TAGS  = {};

function program (statics, tags = null) {
  let byTags = programs.get(statics);
  if (!byTags) programs.set(statics, byTags = new Map);

  const key = tags ?? NO_TAGS;
  let result = byTags.get(key);
  if (!result) byTags.set(key, result = { nodes: nodesOf(build(statics), tags) });
  return result;
}

const holeOf = field => ({ hole: field - 1 });

// the children of a built level: text, holes and elements, fragments flattened
function nodesOf (built, tags) {
  const nodes = [];
  for (let i = 1; i < built.length; i += built[i] === PROP_SET || built[i] === PROP_APPEND ? 4 : 3) {
    const type  = built[i];
    const field = built[i + 1];
    const value = built[i + 2];
    if (type === CHILD_APPEND)  nodes.push(field ? holeOf(field) : value);
    if (type === CHILD_RECURSE) nodes.push(...elementOf(value, tags));
  }
  return nodes;
}

function elementOf (built, tags) {
  let tag = '';
  let props = [];

  for (let i = 1; i < built.length; i += built[i] === PROP_SET || built[i] === PROP_APPEND ? 4 : 3) {
    const type  = built[i];
    const field = built[i + 1];
    const value = field ? holeOf(field) : built[i + 2];

    if (type === TAG_SET)      tag = value;
    if (type === PROPS_ASSIGN) props.push({ spread: field - 1 });
    if (type === PROP_SET)     props.push([built[i + 3], value]);
    if (type === PROP_APPEND) {
      const name  = built[i + 3];
      const entry = props.findLast(item => Array.isArray(item) && item[0] === name);
      const head  = entry[1]?.parts ?? [entry[1] ?? ''];
      entry[1] = { parts: [...head, value] };
    }
  }

  let children = nodesOf(built, tags);

  // an empty tag is a fragment: its children stand in its place
  if (tag === '') return children;

  // a shorthand or a defined real tag: defaults first, then what is written, the
  // positional values fill the declared args and the rest become children
  let entry = null;
  if (isString(tag) && tag[0] === '$') {
    const spec = tags?.[tag];
    if (!spec) throw new Error(`[htx] unknown shorthand tag <${tag}>`);
    entry = normalizeTag(spec);
    if (!entry.tag) throw new Error(`[htx] unknown shorthand tag <${tag}>`);
  }
  else if (isString(tag) && tags?.[tag]) entry = normalizeTag(tags[tag]);

  const positional = props.filter(item => Array.isArray(item) && item[0] === POSITIONAL).map(item => item[1]);
  if (entry || positional.length) {
    props = props.filter(item => !Array.isArray(item) || item[0] !== POSITIONAL);
    const written = new Set(props.filter(Array.isArray).map(([name]) => name));
    const args    = entry?.args ?? [];
    const extra   = [];
    positional.forEach((value, index) => {
      const name = args[index];
      if (!name) extra.push(value);
      else if (!written.has(name)) props.push([name, value]);
    });
    props    = [...Object.entries(entry?.props ?? {}), ...props];
    children = [...extra, ...children];
    if (entry?.tag) tag = entry.tag;
  }

  return [{ tag, props, children }];
}

// :::::: ALIASES

const createHtml = createHTX;

// :::::: EXPORT

export { createHTX, createHtml, build, evaluate, program, POSITIONAL, RAW_HTML };
export { VOID, elementsOf, scanner, splitProp, splitSelector } from './scan.js';
export default createHTX;
