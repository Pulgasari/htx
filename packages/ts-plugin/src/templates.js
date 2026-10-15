// @htx/ts-plugin/templates.js
// finds html`…` in a source file and hands its static parts and holes to the
// analyzer, with offsets in the file. scans are cached per source file object:
// typescript makes a new one on every edit.

import { scan } from '@htx/analyzer';

const cache = new WeakMap;   // source file -> templates

// html`…`, htx`…`, $$.html`…`: the tag is a name or ends in one
function tagName (ts, node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  return null;
}

// the raw text of a template piece: after ` or }, before ${ or `
function partOf (ts, sourceFile, node) {
  const start  = node.getStart(sourceFile) + 1;
  const suffix = ts.isTemplateHead(node) || ts.isTemplateMiddle(node) ? 2 : 1;
  return { start, text: node.rawText ?? sourceFile.text.slice(start, node.end - suffix) };
}

function templateOf (ts, sourceFile, node) {
  const literal = node.template;

  if (ts.isNoSubstitutionTemplateLiteral(literal)) {
    const statics = [partOf(ts, sourceFile, literal)];
    return { expressions: [], node, ...scan(statics, []), statics };
  }

  const statics     = [partOf(ts, sourceFile, literal.head)];
  const holes       = [];
  const expressions = [];
  let   previous    = literal.head;

  for (const span of literal.templateSpans) {
    holes.push({ end: span.literal.getStart(sourceFile) + 1, start: previous.end - 2 });
    expressions.push(span.expression);
    statics.push(partOf(ts, sourceFile, span.literal));
    previous = span.literal;
  }

  return { expressions, node, ...scan(statics, holes), statics };
}

function templatesIn (ts, sourceFile, tags) {
  let found = cache.get(sourceFile);
  if (found) return found;

  found = [];
  if (tags.some(tag => sourceFile.text.includes(`${tag}\``))) {
    const visit = node => {
      if (ts.isTaggedTemplateExpression(node) && tags.includes(tagName(ts, node.tag))) found.push(templateOf(ts, sourceFile, node));
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }

  cache.set(sourceFile, found);
  return found;
}

// the template whose static text holds the position; inside a hole typescript answers
function templateAt (ts, sourceFile, position, tags) {
  for (const template of templatesIn(ts, sourceFile, tags)) {
    if (template.statics.some(part => position >= part.start && position <= part.start + part.text.length)) return template;
  }
  return null;
}

export { templateAt, templatesIn };
