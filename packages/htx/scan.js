// @htx/htx :: scan

/*
the one parser of the htx syntax: markup -> a tree with positions. everything
that reads htx goes through it: build() of the runtime (index.js), the
analyzer (@htx/analyzer) and the compiler of rat (@rat/compiler).

  const p     = scanner(source, options);
  const nodes = p.nodes('eof', { depth: 0 });     // then p.errors, p.warnings

  element  { type, name, tag, id, classes, attributes, children, component, fragment, selfClosing, svg,
             tagHole, nameRange, openEnd, close: { name, start, end }, start, end }
  text     { type, text, blank, start, end }
  hole     { type, hole, start, end }
  comment  { type, start, end }

  attribute  { element, name, names, nameEnd, value, start, end }
             { element, positional: true, value, start, end }     <$icon 'bx:search' />, <$icon ${name} />
             { element, spread: true, value, start, end }         ...${object}
  value      { kind: 'true' }
             { kind: 'string', text, quoted, inner, start, end }
             { kind: 'hole', hole, quoted, inner, start, end }
             { kind: 'parts', parts: [string | { hole }], quoted, inner, start, end }

the source is one string. what a hole is, the host says (options.hole): a
template literal joins its statics with a marker, a file delimits {…} itself.
a host adds its own syntax in child position (options.child), its own ends of
a child list (options.ends) and its own tags (options.open); each may call
back into p.nodes().

options
  child (p, end, context)       a node of the host at p.i, or undefined
  component (name)              true: the name is an identifier, not a selector
  emit (node)                   every node before it lands in its parent: the node, another one, or null to drop it
  ends (p, end, context)        true: the child list ends here
  error (message, index)        makes the error object (thrown, or collected when tolerant)
  hole (p, where)               { value, spread } with p.i behind the hole, or undefined. where: child, attribute, value, quoted, tag, closing
  holeStart (source, index)     true where a hole may begin: a name and a text end there
  open (p, name, start, context)   { node } for a tag the host reads itself (node may be null), or undefined
  position: { start, end }      index -> offset in the file: of what begins at an index, of what ended before it
  recover (p, from, failed)     where to go on after an error (tolerant)
  tagStart                      what may follow a < to open an element
  text (p, end, context)        reads a text node its own way
  tolerant                      collect errors and go on, instead of throwing the first
  unfinished (p, end, context)  the file ended inside a child list of the host
*/

// :::::: CONSTANTS

const TAG_NAME   = /[A-Za-z0-9\-_.#:$]*/y;
const TAG_START  = /[A-Za-z.#$>]/;
const VOID       = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const WHITESPACE = /\s*/y;

const isSpace = char => char === ' ' || char === '\t' || char === '\n' || char === '\r';
const isQuote = char => char === '"' || char === "'";

// :::::: NAMES

// a | inside [ … ] belongs to the name (on:keydown[ctrl+c|space+a]), every other one separates a group
const splitProp = name => name.includes('|') ? name.split(/\|(?![^[]*\])/) : [name];

// div#main.card.big -> { tag, id, classes }, id and classes with their place in the name.
// extra: every id after the first
function splitSelector (name) {
  const out = { classes: [], extra: [], id: null, tag: name };
  if (!/[.#]/.test(name)) return out;

  let at  = 0;
  let tag = '';
  for (const token of name.split(/(?=[.#])/)) {
    const sigil = token[0];
    const part  = { end: at + token.length, name: token.slice(1), start: at + 1 };
    if (sigil !== '.' && sigil !== '#') tag = token;
    else if (!part.name) {}   // a dangling . or # names nothing
    else if (sigil === '.') out.classes.push(part);
    else if (!out.id) out.id = part;
    else out.extra.push(part);
    at += token.length;
  }
  out.tag = tag || 'div';
  return out;
}

// :::::: SCANNER

function scanner (source, options = {}) {
  const {
    child, component, emit, ends, hole, holeStart, open, recover, text: readText, unfinished,
    position = null,
    tagStart = TAG_START,
    tolerant = false,
  } = options;

  const errors   = [];
  const slips    = [];   // closing tags that closed another element than they name
  const warnings = [];

  const startAt = position ? position.start : index => index;
  const endAt   = position ? position.end   : index => index;

  // ::: errors

  function fail (message, index = p.i, { code = 'htx-syntax', end = index + 1, severity = 'error' } = {}) {
    const error = options.error ? options.error(message, index) : new Error(`[htx] ${message}`);
    return Object.assign(error, { at: index, code, end: Math.max(endAt(end), startAt(index)), severity, start: startAt(index), text: message });
  }

  // an error the scanner steps over: thrown, or collected when tolerant
  function report (message, index, extra) {
    const error = fail(message, index, extra);
    if (!tolerant) throw error;
    errors.push(error);
  }

  const warn = (message, index, extra) => { warnings.push(fail(message, index, { ...extra, severity: 'warning' })); };

  // on to the next tag or line, at least one character further
  function skipAfter (from, failed) {
    p.i = Math.max(p.i, failed ?? 0, from + 1);
    const tag  = source.indexOf('<', p.i);
    const line = source.indexOf('\n', p.i);
    const next = Math.min(tag < 0 ? source.length : tag, line < 0 ? source.length : line);
    p.i = Math.min(next, source.length);
  }

  // ::: cursor

  const peek = string => source.startsWith(string, p.i);

  function sticky (regex) {
    regex.lastIndex = p.i;
    const match = regex.exec(source);
    if (match) p.i = regex.lastIndex;
    return match;
  }

  const skipWhitespace = () => sticky(WHITESPACE);

  const holeAt  = where => hole ? hole(p, where) : undefined;
  const mayHole = index => holeStart ? holeStart(source, index) : false;
  const put    = node  => emit ? emit(node) : node;

  // ::: nodes

  // end says what closes the list: eof (the file), tag (a closing tag), or an end of the host
  function nodes (end, context) {
    const children = [];
    const add      = node => { const out = put(node); if (out) children.push(out); };

    while (p.i < source.length) {
      const at = p.i;
      try {
        if (ends?.(p, end, context)) return children;

        if (peek('<!--')) { add(comment()); continue; }

        if (peek('</')) {
          if (end !== 'tag') { closing(); report('unexpected closing tag', at, { code: 'htx-closing', end: p.i }); continue; }
          context.close = closing();
          return children;
        }

        if (source[p.i] === '<') {
          const found = element(context);
          if (found !== undefined) { if (found) add(found); continue; }
        }

        const start = p.i;
        const found = holeAt('child');
        if (found) { add({ end: endAt(p.i), hole: found.value, start: startAt(start), type: 'hole' }); continue; }

        const own = child?.(p, end, context);
        if (own) { children.push(own); continue; }

        add(readText ? readText(p, end, context) : text());
      }
      catch (error) {
        if (!tolerant || error.text === undefined) throw error;
        errors.push(error);
        if (recover) recover(p, at, error.at);
        else skipAfter(at, error.at);
      }
    }

    if (end === 'tag') report(`<${context.tag}> is never closed`, context.open, { code: 'htx-unclosed', end: context.open + 1 + context.tag.length });
    else unfinished?.(p, end, context);
    return children;
  }

  // up to the next tag or the next place a hole may begin, at least one character
  function text () {
    const start = p.i;
    p.i++;
    while (p.i < source.length && source[p.i] !== '<' && !mayHole(p.i)) p.i++;
    const value = source.slice(start, p.i);
    return { blank: !value.trim(), end: endAt(p.i), start: startAt(start), text: value, type: 'text' };
  }

  function comment () {
    const start = p.i;
    const close = source.indexOf('-->', start + 4);
    if (close < 0) { p.i = source.length; report('unclosed <!--', start, { code: 'htx-comment', end: start + 4 }); }
    else p.i = close + 3;
    return { end: endAt(p.i), start: startAt(start), type: 'comment' };
  }

  // </name>, </${Tag}>, <//>: name and nameRange say what was written, index where it starts in the source.
  // null when the file ends inside it
  function closing () {
    const start = p.i;
    p.i += 2;
    const at    = p.i;
    const found = holeAt('closing');
    let name    = '';
    if (found) name = { hole: found.value };
    else if (source[p.i] === '/') { name = '/'; p.i++; }
    else name = sticky(TAG_NAME)[0];
    const nameRange = { end: endAt(p.i), start: startAt(at) };

    const close = source.indexOf('>', p.i);
    if (close < 0) { p.i = source.length; report('unclosed closing tag', start, { code: 'htx-closing' }); return null; }
    if (source.slice(p.i, close).trim()) report('expected ">" to end the closing tag', p.i);
    p.i = close + 1;
    return { end: endAt(p.i), index: start, name, nameRange, start: startAt(start) };
  }

  // ::: elements

  // an element, null for a tag the host took and dropped, undefined when the < opens nothing
  function element (context) {
    const start = p.i;
    p.i++;

    const tagHole = holeAt('tag');
    if (!tagHole && !tagStart.test(source[p.i] ?? '')) { p.i = start; return undefined; }

    const at   = p.i;
    const name = tagHole ? '' : sticky(TAG_NAME)[0];

    const own = !tagHole && open?.(p, name, start, context);
    if (own) return own.node;

    const node = {
      attributes : [],
      children   : [],
      classes    : [],
      close      : null,
      component  : false,
      fragment   : !tagHole && !name,
      id         : null,
      name,
      nameRange  : { end: endAt(p.i), start: startAt(at) },
      start      : startAt(start),
      tag        : name,
      type       : 'element',
    };

    if (tagHole) { node.tagHole = tagHole.value; node.tag = ''; }
    else if (component?.(name)) node.component = true;
    else selector(node, name, at);

    node.svg = Boolean(context.svg) || node.tag === 'svg';

    const closed = attributes(node, start);
    node.openEnd = endAt(p.i);

    if (closed) node.selfClosing = true;
    else if (closed === false && VOID.has(node.tag)) {
      // <br></br>: the closing tag of a void element is its own
      if (source.startsWith(`</${name}>`, p.i)) node.close = closing();
    }
    else if (closed === false) {
      const inner   = { depth: (context.depth ?? 0) + 1, open: start, svg: node.svg, tag: name };
      node.children = nodes('tag', inner);
      node.close    = inner.close ?? null;
      mismatch(node, start);
    }

    node.end = endAt(p.i);
    return node;
  }

  function selector (node, name, at) {
    const { classes, extra, id, tag } = splitSelector(name);
    const place = part => ({ end: endAt(at + part.end), name: part.name, start: startAt(at + part.start) });
    node.tag     = tag;
    node.classes = classes.map(place);
    node.id      = id && place(id);
    for (const part of extra) report(`an element has one id, "#${part.name}" is a second one`, at + part.start - 1, { code: 'htx-selector-id', end: at + part.end });
  }

  // a closing tag closes the innermost element whatever it says; a different name is a slip
  function mismatch (node, start) {
    const written = node.close?.name;
    if (!written || written === '/' || typeof written !== 'string' || node.tagHole !== undefined || node.fragment) return;
    if (written === node.name) return;
    slips.push({ name: node.name, open: start, written });
    if (written.split(/[.#]/)[0] !== node.tag) warn(`</${written}> closes <${node.name}>`, node.close.index + 2, { code: 'htx-closing-name', end: node.close.index + 2 + written.length });
  }

  // true if the tag closed itself, false if it opened, null at the end of the file
  function attributes (node, open) {
    while (true) {
      skipWhitespace();
      if (p.i >= source.length) { report(`unclosed tag <${node.name}`, open, { code: 'htx-unclosed', end: open + 1 + node.name.length }); return null; }
      if (peek('/>')) { p.i += 2; return true; }
      if (peek('>'))  { p.i += 1; return false; }

      const at = p.i;

      // a bare hole is a positional value, <$icon ${name} />, or what the host makes of it
      const found = holeAt('attribute');
      if (found) {
        const value = { end: endAt(p.i), hole: found.value, kind: 'hole', quoted: false, start: startAt(at) };
        node.attributes.push({ element: node, end: endAt(p.i), [found.spread ? 'spread' : 'positional']: true, start: startAt(at), value });
        continue;
      }

      if (peek('...')) {
        p.i += 3;
        const spread = holeAt('attribute');
        if (!spread) { report('"..." needs a value: ...${object}', at, { code: 'htx-spread', end: at + 3 }); continue; }
        const value = { end: endAt(p.i), hole: spread.value, kind: 'hole', quoted: false, start: startAt(at + 3) };
        node.attributes.push({ element: node, end: endAt(p.i), spread: true, start: startAt(at), value });
        continue;
      }

      // a quoted string without a name is a positional value: <$icon 'bx:search' />
      if (isQuote(source[p.i])) {
        const value = quoted();
        node.attributes.push({ element: node, end: endAt(p.i), positional: true, start: startAt(at), value });
        continue;
      }

      const name = attributeName();
      if (!name) { report(`unexpected "${source[p.i]}" in tag`, at); p.i++; continue; }
      const nameEnd = p.i;

      const attribute = { element: node, end: endAt(nameEnd), name, nameEnd: endAt(nameEnd), names: splitProp(name), start: startAt(at), value: { kind: 'true' } };

      skipWhitespace();
      if (peek('=')) {
        p.i++;
        skipWhitespace();
        attribute.value = attributeValue(name) ?? attribute.value;
        attribute.end   = endAt(p.i);
      }

      if (attribute.names.some(part => !part)) report(`malformed prop group '${name}'`, at, { code: 'htx-group', end: nameEnd });
      node.attributes.push(attribute);
    }
  }

  function attributeName () {
    const start = p.i;
    while (p.i < source.length) {
      const char = source[p.i];
      if (isSpace(char) || isQuote(char) || char === '=' || char === '/' || char === '>' || mayHole(p.i)) break;
      p.i++;
    }
    return source.slice(start, p.i);
  }

  function attributeValue (name) {
    if (isQuote(source[p.i])) return quoted();

    // unquoted: text and holes up to whitespace or the end of the tag
    const at    = p.i;
    const parts = [];
    let text    = '';
    while (p.i < source.length) {
      const char = source[p.i];
      if (isSpace(char) || char === '>' || (char === '/' && source[p.i + 1] === '>')) break;
      const found = mayHole(p.i) ? holeAt('value') : undefined;
      if (found) { if (text) parts.push(text); parts.push({ hole: found.value }); text = ''; }
      else { text += char; p.i++; }
    }
    if (text) parts.push(text);
    if (!parts.length) { report(`expected a value for "${name}"`, at); return null; }
    return valueOf(parts, false, at, at, p.i);
  }

  // a quoted value, text and holes up to the same quote. inner: the range inside the quotes
  function quoted () {
    const at    = p.i;
    const quote = source[p.i++];
    const start = p.i;
    const parts = [];
    let text    = '';

    while (p.i < source.length && source[p.i] !== quote) {
      const found = mayHole(p.i) ? holeAt('quoted') : undefined;
      if (found) { if (text) parts.push(text); parts.push({ hole: found.value }); text = ''; }
      else text += source[p.i++];
    }

    const end = p.i;
    if (p.i >= source.length) report('unclosed quote', at, { code: 'htx-quote' });
    else p.i++;
    if (text || !parts.length) parts.push(text);
    return valueOf(parts, true, at, start, end);
  }

  // one text is a string, one hole the value itself, anything else parts
  function valueOf (parts, quoted, at, innerStart, innerEnd) {
    const range = { end: endAt(p.i), inner: { end: endAt(innerEnd), start: startAt(innerStart) }, quoted, start: startAt(at) };
    if (parts.length === 1 && typeof parts[0] === 'string') return { ...range, kind: 'string', text: parts[0] };
    if (parts.length === 1) return { ...range, hole: parts[0].hole, kind: 'hole' };
    return { ...range, kind: 'parts', parts };
  }

  // ::: api

  const p = { errors, fail, i: 0, nodes, peek, report, skipWhitespace, slips, source, sticky, warn, warnings };

  return p;
}

// :::::: WALK

// every element, depth first
function* elementsOf (nodes) {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    yield node;
    yield* elementsOf(node.children);
  }
}

// :::::: EXPORT

export { VOID, elementsOf, scanner, splitProp, splitSelector };
export default scanner;
