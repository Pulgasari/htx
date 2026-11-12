// @htx/analyzer/scan.js
// a template as written, for tooling: the tree of the one parser (scanner of
// @htx/htx) with offsets in the source file, plus what an editor asks for: the
// role of every hole and the regions a cursor can sit in.
//
// input is the template as a host language sees it: the static parts with the
// offset each starts at, and the range of every hole between two parts.
//
//   scan([{ start: 5, text: '<p class=' }, { start: 19, text: '>hi</p>' }], [{ start: 14, end: 19 }])
//
// regions say what sits where (tag name, attribute name, attribute value, closing
// name, the whole open tag, text): completion and hover start from them.

import { VOID, elementsOf, scanner } from '@htx/htx/scan';

const MARK = '￿';

// what a hole in an attribute value is for, by the first name of its group
function roleOf (name) {
  if (name === 'ref')   return 'ref';
  if (name === '!html') return 'raw';
  if (name === 'style' || name.startsWith('style:')) return 'style';
  if (name === 'class' || name === 'className' || name.startsWith('class:')) return 'class';
  if (/^on[^-]/.test(name) && name.length > 2) return 'event';
  return 'prop';
}

// the statics as one string with a mark per hole, and where every index of it is in the file:
// starts[i] is where what begins at i stands, ends[i] where what stood before i ended
function joined (statics, holes) {
  const starts = [];
  const ends   = [];
  let source   = '';
  let before   = statics[0]?.start ?? 0;

  const put = (start, end) => { ends.push(before); starts.push(start); before = end; };

  statics.forEach((part, index) => {
    for (let offset = 0; offset < part.text.length; offset++) put(part.start + offset, part.start + offset + 1);
    source += part.text;
    if (index === statics.length - 1) return;
    const at    = part.start + part.text.length;
    const range = holes[index] ?? { end: at, start: at };
    put(range.start, range.end);
    source += MARK;
  });

  const last   = statics.at(-1);
  const finish = last ? last.start + last.text.length : 0;
  put(finish, finish);

  return { ends, finish, source, starts };
}

function scan (statics, holes = []) {
  const { ends, finish, source, starts } = joined(statics, holes);
  const rangeOf = index => holes[index] ?? { end: finish, start: finish };

  let count = 0;
  const p = scanner(source, {
    hole     : p => p.source[p.i] === MARK ? (p.i++, { value: count++ }) : undefined,
    position : { end: index => ends[index] ?? finish, start: index => starts[index] ?? finish },
    stops    : MARK,
    tolerant : true,
  });
  const nodes = p.nodes('eof', { depth: 0 });

  const errors = [...p.errors, ...p.warnings]
    .map(({ code, end, severity, start, text }) => ({ code, end: Math.max(end, start), message: text, severity, start }))
    .sort((a, b) => a.start - b.start);

  // ::: roles + regions

  const regions = [];
  const roles   = [];
  const role    = (hole, data) => { const range = rangeOf(hole); roles[hole] = { ...data, end: range.end, hole, start: range.start }; };

  function value (attribute, element) {
    const { value } = attribute;
    const names     = attribute.names;
    if (value.kind === 'true') return;

    if (value.kind === 'hole') role(value.hole, { element, names, role: attribute.spread ? 'spread' : names ? roleOf(names[0]) : 'positional' });
    if (value.kind === 'parts') for (const part of value.parts) if (typeof part !== 'string') role(part.hole, { element, names, role: 'part' });

    if (attribute.spread || (value.kind === 'hole' && !value.quoted)) return;
    regions.push({ attribute, element, end: value.inner.end, kind: 'attrValue', start: value.inner.start });
  }

  function walk (list, parent) {
    for (const node of list) {
      if (node.type === 'text') regions.push({ end: node.end, kind: 'text', start: node.start });
      if (node.type === 'hole') role(node.hole, { element: parent, role: 'child' });
      if (node.type === 'comment') holes.forEach((range, index) => { if (range.start >= node.start && range.end <= node.end) role(index, { role: 'comment' }); });
      if (node.type !== 'element') continue;

      if (node.tagHole !== undefined) role(node.tagHole, { element: node, role: 'tag' });
      else regions.push({ element: node, end: node.nameRange.end, kind: 'tagName', start: node.nameRange.start });

      for (const attribute of node.attributes) {
        if (attribute.names) regions.push({ attribute, element: node, end: attribute.nameEnd, kind: 'attrName', start: attribute.start });
        value(attribute, node);
      }

      regions.push({ element: node, end: node.openEnd ?? finish, kind: 'tag', start: node.start });
      walk(node.children, node);

      if (node.close) {
        regions.push({ end: node.close.nameRange.end, kind: 'closeName', start: node.close.nameRange.start });
        if (node.close.name?.hole !== undefined) role(node.close.name.hole, { role: 'closing' });
      }
    }
  }

  walk(nodes, null);

  return { end: finish, errors, holes: roles, nodes, regions, start: statics[0]?.start ?? 0, statics };
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

export { VOID, elementsOf, regionAt, scan };
export default scan;
