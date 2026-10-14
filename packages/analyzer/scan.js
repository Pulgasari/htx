// @htx/analyzer/scan.js
// a template as written: elements, attributes, text and holes with their offsets
// in the source file, plus the syntax errors. it follows the rules of build() in
// @htx/htx, but keeps positions and keeps going after an error, which the
// runtime parser has no reason to do.
//
// input is the template as a host language sees it: the static parts with the
// offset each starts at, and the range of every hole between two parts.
//
//   scan([{ start: 5, text: '<p class=' }, { start: 19, text: '>hi</p>' }], [{ start: 14, end: 19 }])
//
// regions say what sits where (tag name, attribute name, attribute value, closing
// name, the whole open tag): completion and hover start from them.

const WHITESPACE = new Set([' ', '\t', '\n', '\r']);
const QUOTES     = new Set(['"', "'"]);

// the characters that end a tag or attribute name
const NAME_END = new Set([...WHITESPACE, '=', '>', '/', '"', "'"]);

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

// what a hole in an attribute value is for, by the first name of its group
function roleOf (name) {
  if (name === 'ref')   return 'ref';
  if (name === '!html') return 'raw';
  if (name === 'style' || name.startsWith('style:')) return 'style';
  if (name === 'class' || name === 'className' || name.startsWith('class:')) return 'class';
  if (/^on[^-]/.test(name) && name.length > 2) return 'event';
  return 'prop';
}

// <div#main.card.big> -> { tag, id, classes } with an offset for each piece
function selectorOf (name, start, warn) {
  const out = { classes: [], id: null, tag: name };
  if (!/[.#]/.test(name)) return out;

  let at  = start;
  let tag = null;
  for (const token of name.split(/(?=[.#])/)) {
    const sigil = token[0];
    const value = token.slice(1);
    if (sigil !== '.' && sigil !== '#') tag = token;
    else if (!value) {}
    else if (sigil === '.') out.classes.push({ end: at + token.length, name: value, start: at + 1 });
    else if (!out.id) out.id = { end: at + token.length, name: value, start: at + 1 };
    else warn(`more than one id in <${name}>: '#${value}' is ignored`, at, at + token.length, 'htx-selector-id');
    at += token.length;
  }
  out.tag = tag || 'div';
  return out;
}

function scan (statics, holes = []) {
  // one stream of characters and hole markers, each with its place in the file
  const stream  = [];
  const markers = [];
  statics.forEach((part, index) => {
    for (let offset = 0; offset < part.text.length; offset++) stream.push({ at: part.start + offset, char: part.text[offset] });
    if (index === statics.length - 1) return;
    const range = holes[index] ?? { end: part.start + part.text.length, start: part.start + part.text.length };
    stream.push(markers[index] = { at: range.start, end: range.end, hole: index });
  });

  const last   = statics.at(-1);
  const finish = last ? last.start + last.text.length : 0;

  const errors  = [];
  const regions = [];
  const roles   = [];
  const root    = { children: [], type: 'root' };
  const stack   = [root];

  let i = 0;

  const error = (message, start, end, code, severity = 'error') => errors.push({ code, end: Math.max(end, start), message, severity, start });
  const warn  = (message, start, end, code) => error(message, start, end, code, 'warning');

  const item    = (offset = 0) => stream[i + offset];
  const charAt  = (offset = 0) => stream[i + offset]?.char;
  const isHole  = (offset = 0) => stream[i + offset]?.hole !== undefined;
  const startOf = () => stream[i]?.at ?? finish;
  const endOf   = entry => entry.hole !== undefined ? entry.end : entry.at + 1;
  const before  = () => i > 0 ? endOf(stream[i - 1]) : (statics[0]?.start ?? 0);
  const parent  = () => stack.at(-1);

  const role = (hole, data) => { roles[hole] = { ...data, end: markers[hole].end, hole, start: markers[hole].at }; };

  const skipWhitespace = () => { while (WHITESPACE.has(charAt())) i++; };

  function readName () {
    const start = startOf();
    let name = '';
    while (i < stream.length && !isHole() && !NAME_END.has(charAt())) name += stream[i++].char;
    return { end: start + name.length, name, start };
  }

  // :::::: TEXT

  function text () {
    const start = startOf();
    let value = '';
    while (i < stream.length && !isHole() && charAt() !== '<') value += stream[i++].char;
    const end = start + value.length;
    parent().children.push({ blank: !value.trim(), end, start, text: value, type: 'text' });
    regions.push({ end, kind: 'text', start });
  }

  // :::::: COMMENT

  function comment (open) {
    i += 4;
    while (i < stream.length && !(charAt() === '-' && charAt(1) === '-' && charAt(2) === '>')) {
      if (isHole()) role(item().hole, { role: 'comment' });
      i++;
    }
    if (i >= stream.length) { error('unclosed comment', open, open + 4, 'htx-comment'); return; }
    i += 3;
    parent().children.push({ end: before(), start: open, type: 'comment' });
  }

  // :::::: CLOSING TAG

  function closing (open) {
    i += 2;
    let name = null;
    let range = { end: startOf(), start: startOf() };

    if (isHole()) { name = { hole: item().hole }; range = { end: item().end, start: item().at }; role(item().hole, { role: 'closing' }); i++; }
    else if (charAt() === '/') { name = '/'; i++; }
    else { const read = readName(); name = read.name; range = read; }

    regions.push({ end: range.end, kind: 'closeName', start: range.start });

    skipWhitespace();
    if (charAt() !== '>') {
      error('expected ">" to end the closing tag', startOf(), startOf() + 1, 'htx-syntax');
      while (i < stream.length && charAt() !== '>') i++;
    }
    i++;

    const end = before();
    if (stack.length === 1) { error('a closing tag without an open tag', open, end, 'htx-closing'); return; }

    const element = stack.pop();
    element.close = { end, start: open };
    element.end   = end;

    // htx closes the innermost element whatever the name says; a different name is a slip
    if (typeof name === 'string' && name && name !== '/' && element.tagHole === undefined && !element.fragment) {
      const base = selectorOf(name, range.start, () => {}).tag;
      if (name !== element.name && base !== element.tag) warn(`</${name}> closes <${element.name}>`, range.start, range.end, 'htx-closing-name');
    }
  }

  // :::::: OPEN TAG

  function attributeValue (attribute) {
    const parts = [];
    const start = startOf();

    // "…", '…': text and holes up to the same quote
    if (QUOTES.has(charAt())) {
      const quote = charAt();
      i++;
      const inner = startOf();
      let text = '';
      while (i < stream.length && charAt() !== quote) {
        if (isHole()) { if (text) parts.push(text); text = ''; parts.push({ hole: item().hole }); role(item().hole, { element: attribute.element, names: attribute.names, role: 'part' }); i++; continue; }
        text += stream[i++].char;
      }
      if (text || !parts.length) parts.push(text);
      const close = startOf();
      if (i >= stream.length) error('unclosed quote', start, start + 1, 'htx-quote');
      else i++;
      regions.push({ attribute, element: attribute.element, end: close, kind: 'attrValue', start: inner });

      // "${x}" alone is the value itself, as unquoted
      if (parts.length === 1 && typeof parts[0] !== 'string') {
        const hole = parts[0].hole;
        role(hole, { element: attribute.element, names: attribute.names, role: attribute.names.length ? roleOf(attribute.names[0]) : 'positional' });
        return { end: before(), hole, kind: 'hole', start };
      }
      return parts.length === 1 && typeof parts[0] === 'string'
        ? { end: before(), kind: 'string', quoted: true, start, text: parts[0] }
        : { end: before(), kind: 'parts', parts, start };
    }

    // unquoted: text and holes up to whitespace or the end of the tag
    let text = '';
    while (i < stream.length && !WHITESPACE.has(charAt()) && charAt() !== '>' && !(charAt() === '/' && charAt(1) === '>')) {
      if (isHole()) { if (text) parts.push(text); text = ''; parts.push({ hole: item().hole }); i++; continue; }
      text += stream[i++].char;
    }
    if (text || !parts.length) parts.push(text);

    if (parts.length === 1 && typeof parts[0] !== 'string') {
      const hole = parts[0].hole;
      role(hole, { element: attribute.element, names: attribute.names, role: roleOf(attribute.names[0]) });
      return { end: before(), hole, kind: 'hole', start };
    }
    for (const part of parts) if (typeof part !== 'string') role(part.hole, { element: attribute.element, names: attribute.names, role: 'part' });
    regions.push({ attribute, element: attribute.element, end: before(), kind: 'attrValue', start });
    return parts.length === 1 ? { end: before(), kind: 'string', quoted: false, start, text: parts[0] } : { end: before(), kind: 'parts', parts, start };
  }

  function attributes (element) {
    for (;;) {
      skipWhitespace();
      const start = startOf();

      if (i >= stream.length) return 'eof';

      // a bare hole is a positional value: <$icon ${name} />
      if (isHole()) {
        const hole = item().hole;
        element.attributes.push({ end: item().end, positional: true, start, value: { hole, kind: 'hole' } });
        role(hole, { element, role: 'positional' });
        i++;
        continue;
      }

      const char = charAt();

      if (char === '>') { i++; return 'open'; }
      if (char === '/' && charAt(1) === '>') { i += 2; return 'closed'; }
      if (char === '/') { error('unexpected "/" in a tag', start, start + 1, 'htx-syntax'); i++; continue; }

      if (char === '.' && charAt(1) === '.' && charAt(2) === '.') {
        if (isHole(3)) {
          const hole = item(3).hole;
          element.attributes.push({ end: item(3).end, spread: true, start, value: { hole, kind: 'hole' } });
          role(hole, { element, role: 'spread' });
          i += 4;
        } else {
          error('"..." needs a value: ...${object}', start, start + 3, 'htx-spread');
          i += 3;
        }
        continue;
      }

      // a quoted string without a name is a positional value: <$icon 'bx:search' />
      if (QUOTES.has(char)) {
        const value = attributeValue({ element, names: [] });
        element.attributes.push({ end: value.end, positional: true, start, value });
        continue;
      }

      const read      = readName();
      const names     = read.name.split('|');
      const attribute = { element, end: read.end, name: read.name, nameEnd: read.end, names, start, value: { kind: 'true' } };
      regions.push({ attribute, element, end: read.end, kind: 'attrName', start });

      if (!read.name) { error(`unexpected "${char}" in a tag`, start, start + 1, 'htx-syntax'); i++; continue; }
      if (names.some(name => !name)) error(`malformed prop group '${read.name}'`, read.start, read.end, 'htx-group');

      if (charAt() === '=') {
        i++;
        attribute.value = attributeValue(attribute);
        attribute.end   = attribute.value.end;
      }
      element.attributes.push(attribute);
    }
  }

  function opening (open) {
    i++;
    const element = { attributes: [], children: [], start: open, type: 'element' };

    if (isHole()) {
      element.tagHole = item().hole;
      element.name    = '';
      element.tag     = '';
      element.nameRange = { end: item().end, start: item().at };
      role(item().hole, { element, role: 'tag' });
      i++;
    } else {
      const read = readName();
      if (!read.name && charAt() !== '>') {
        // a "<" that starts nothing: report it, read it as text so the rest still parses
        error('expected a tag name after "<"', open, open + 1, 'htx-syntax');
        regions.push({ end: read.start, kind: 'tagName', start: read.start });
        parent().children.push({ end: open + 1, start: open, text: '<', type: 'text' });
        return;
      }
      element.name      = read.name;
      element.nameRange = { end: read.end, start: read.start };
      element.fragment  = !read.name;
      Object.assign(element, selectorOf(read.name, read.start, warn));
      regions.push({ element, end: read.end, kind: 'tagName', start: read.start });
    }

    parent().children.push(element);

    const how = attributes(element);
    element.openEnd = before();
    regions.push({ element, end: how === 'eof' ? finish : element.openEnd, kind: 'tag', start: open });

    if (how === 'eof') {
      error(`unclosed tag <${element.name}`, open, element.nameRange.end, 'htx-unclosed');
      element.end = finish;
      return;
    }

    if (how === 'closed') { element.end = element.openEnd; element.selfClosing = true; return; }

    // htx knows no void elements: <input> without "/>" swallows what follows
    if (VOID.has(element.tag)) {
      error(`<${element.name}> must close itself: <${element.name} />`, open, element.openEnd, 'htx-void');
      element.end = element.openEnd;
      return;
    }

    stack.push(element);
  }

  // :::::: RUN

  while (i < stream.length) {
    if (isHole()) {
      const hole = item().hole;
      parent().children.push({ end: item().end, hole, start: item().at, type: 'hole' });
      role(hole, { element: stack.length > 1 ? parent() : null, role: 'child' });
      i++;
      continue;
    }
    if (charAt() !== '<') { text(); continue; }

    const open = startOf();
    if (charAt(1) === '!' && charAt(2) === '-' && charAt(3) === '-') comment(open);
    else if (charAt(1) === '/') closing(open);
    else opening(open);
  }

  for (const element of stack.slice(1)) {
    error(`<${element.name || '…'}> is never closed`, element.start, element.nameRange.end, 'htx-unclosed');
    element.end = finish;
  }

  return { end: finish, errors, holes: roles, nodes: root.children, regions, start: statics[0]?.start ?? 0 };
}

// the innermost region at an offset; a region holds the offset at its end too,
// so a name being typed is found while the cursor sits right after it
function regionAt (template, offset) {
  let found = null;
  for (const region of template.regions) {
    if (offset < region.start || offset > region.end) continue;
    if (!found || region.kind !== 'tag' && (found.kind === 'tag' || region.start >= found.start)) found = region;
  }
  return found;
}

// every element, depth first
function* elementsOf (nodes) {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    yield node;
    yield* elementsOf(node.children);
  }
}

export { VOID, elementsOf, regionAt, scan };
export default scan;
