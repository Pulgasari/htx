// @ts-self-types="./index.d.ts"
// @htx/compiler

/*
turns an .htx file into an es module. the file is markup first, the way a
svelte component is: the markup is the component, <script> and <style> blocks
sit beside it.

  <script module>   module level, runs once. exports go here
  <script>          the component body, runs on every render. props is in scope
  <style>           exported as a string (style), nothing is injected yet
  everything else   the markup, returned as one html`` call

the markup is never parsed here. it is handed to the adapter's tag function as
it is, so every piece of htx syntax works without the compiler knowing about
it. the compiler only has to find three things: the blocks, the ${…} holes and
the characters a template literal would read differently (\ and `).

  <script>
    import Icon from './icon.htx';
    const { name } = props;
  </script>

  <div.card id|title=${name}>
    <$icon 'bx:search' />
  </div.card>

becomes

  import { html as $$htx } from '@htx/preact';
  import Icon from './icon.htx';
  export default function Card (props) {
    const { name } = props;
    return $$htx`<div.card id|title=${name}> … </div.card>`;
  }
*/

// :::::: IMPORTS

import { parse, parseExpressionAt } from 'acorn';

// :::::: CONSTANTS

const ACORN = { ecmaVersion: 'latest', sourceType: 'module' };
const TAG   = '$$htx';
const NEXT  = /\$\{|<!--|<(script|style)(\s[^>]*)?>/g; // what split stops at: a hole, a comment, a block. everything in between is plain markup

// :::::: HELPERS

// the position of a character as an editor shows it, 1-based
function locate (source, index) {
  const lines = source.slice(0, index).split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function fail (message, source, index, filename) {
  const { line, column } = locate(source, index);
  const error = new SyntaxError(`[htx] ${message} (${filename}:${line}:${column})`);
  Object.assign(error, { filename, line, column });
  return error;
}

// card-item.htx -> CardItem. a devtools label only, so anything odd falls back
function nameOf (filename) {
  const base = filename.split(/[\\/]/).pop().replace(/\.htx(\.html)?$/, '');
  const name = base.replace(/(^|[-_.\s]+)(\w)/g, (_, __, char) => char.toUpperCase());
  return /^[A-Za-z_$][\w$]*$/.test(name) ? name : 'Component';
}

// a backslash or backtick in the markup is text. a $ is text as well, unless
// it opens a hole, and holes never reach this function
const escape = (text) => text.replace(/[\\`]/g, '\\$&');

// the end of a ${…} hole: acorn reads the expression, so strings, nested
// templates, regexes and object literals cannot close it early. only
// whitespace and comments may follow before the }
function closeHole (source, start, filename) {
  let node;

  try         { node = parseExpressionAt(source, start, ACORN); }
  catch (err) { throw fail(err.message.replace(/ \(\d+:\d+\)$/, ''), source, err.pos ?? start, filename); }

  const rest = /(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*\}/y;
  rest.lastIndex = node.end;
  if (!rest.test(source)) throw fail('expected } after the expression', source, node.end, filename);

  return rest.lastIndex;
}

// the module specifiers of a program, run through resolve. the replacements go
// from the end, so the earlier positions stay true
const SOURCED = new Set(['ImportDeclaration', 'ExportAllDeclaration', 'ExportNamedDeclaration']);

function rewrite (text, program, resolve, base = 0) {
  if (!resolve) return text;
  const sources = program.body.filter(node => SOURCED.has(node.type) && node.source).map(node => node.source).reverse();
  for (const { start, end, value } of sources) {
    const next = resolve(value);
    if (next != null && next !== value) text = text.slice(0, start - base) + JSON.stringify(next) + text.slice(end - base);
  }
  return text;
}

// :::::: SPLIT

/*
one pass over the file. the markup is escaped for a template literal on the
way, the holes are copied verbatim and the blocks are taken out. a block is
found anywhere outside a hole or a comment; an inline <script> in the markup is
not possible, which is what !html is for.
*/
function split (source, filename) {
  const blocks = { module: [], script: [], style: [] };
  let markup   = '';
  let i        = 0;

  while (i < source.length) {
    NEXT.lastIndex = i;
    const next = NEXT.exec(source);

    markup += escape(source.slice(i, next ? next.index : source.length));
    if (!next) break;

    const [found, kind, attributes = ''] = next;
    i = next.index;

    if (found === '${') {
      const end = closeHole(source, i + 2, filename);
      markup += source.slice(i, end);
      i = end;
    }

    // a comment is markup to htx, which drops it. a <script> inside is not a block
    else if (found === '<!--') {
      const end = source.indexOf('-->', i + 4);
      if (end < 0) throw fail('unclosed <!--', source, i, filename);
      markup += escape(source.slice(i, end + 3));
      i = end + 3;
    }

    else {
      const close = source.indexOf(`</${kind}>`, i + found.length);
      if (close < 0) throw fail(`unclosed <${kind}>`, source, i, filename);

      const content = source.slice(i + found.length, close);
      const target  = kind === 'script' && /\smodule\b/.test(attributes) ? 'module' : kind;

      // the offset keeps acorn's error positions true to the file
      blocks[target].push({ content, offset: i + found.length });
      i = close + kind.length + 3;
    }
  }

  return { blocks, markup: markup.trim() };
}

// :::::: SCRIPTS

/*
the instance script becomes a function body, but an import can only live at
module level. so the script is parsed, its imports lifted out and the rest kept
in order. an export has no meaning inside a function and is refused.
*/
function lift (block, source, filename, resolve) {
  const padded  = ' '.repeat(block.offset) + block.content;
  const imports = [];
  let body      = '';
  let last      = block.offset;
  let program;

  try         { program = parse(padded, ACORN); }
  catch (err) { throw fail(err.message.replace(/ \(\d+:\d+\)$/, ''), source, err.pos ?? block.offset, filename); }

  for (const node of program.body) {
    if (node.type === 'ImportDeclaration') {
      imports.push(rewrite(padded.slice(node.start, node.end), { body: [node] }, resolve, node.start));
      body += padded.slice(last, node.start);
      last  = node.end;
    }
    else if (node.type.startsWith('Export')) {
      throw fail('an export goes in <script module>, the component body has none', source, node.start, filename);
    }
  }

  // blank lines go, the indentation of the first line stays
  body += padded.slice(last);
  return { imports, body: body.replace(/^\s*\n/, '').trimEnd() };
}

// checks the module script and hands it back with its specifiers resolved
function moduleOf (block, source, filename, resolve) {
  const padded = ' '.repeat(block.offset) + block.content;
  let program;

  try         { program = parse(padded, ACORN); }
  catch (err) { throw fail(err.message.replace(/ \(\d+:\d+\)$/, ''), source, err.pos ?? block.offset, filename); }

  const clash = program.body.find(node => node.type === 'ExportDefaultDeclaration');
  if (clash) throw fail('the markup is the default export, <script module> cannot have one', source, clash.start, filename);

  return rewrite(padded, program, resolve).trim();
}

// :::::: COMPILE

/**
 * compiles the source of an .htx file into the source of an es module whose
 * default export is the component. resolve, when given, maps every import
 * specifier of the scripts (a relative path onto a url, say)
 */
function compile (source, { adapter = '@htx/preact', filename = 'component.htx', resolve } = {}) {
  const { blocks, markup } = split(source, filename);

  const modules  = blocks.module.map (block => moduleOf (block, source, filename, resolve));
  const instance = blocks.script.map (block => lift     (block, source, filename, resolve));
  const imports  = instance.flatMap  (script => script.imports);
  const body     = instance.map      (script => script.body).filter(Boolean);
  const style    = blocks.style.map  (block => block.content.trim()).filter(Boolean).join('\n\n');

  const lines = [
    `import { html as ${TAG} } from ${JSON.stringify(adapter)};`,
    ...imports,
    ...modules,
    style && `export const style = ${JSON.stringify(style)};`,
    `export default function ${nameOf(filename)} (props) {`,
    // not indented: a multi-line template literal in the script would change its text
    ...body,
    markup ? `  return ${TAG}\`${markup}\`;` : '  return null;',
    '}',
  ];

  return { code: lines.filter(Boolean).join('\n') + '\n' };
}

// :::::: EXPORT

export { compile };
export default compile;
