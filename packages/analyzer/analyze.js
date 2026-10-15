// @htx/analyzer/analyze.js
// diagnostics for a scanned template: the syntax errors of scan(), plus what the
// context knows. each one is { start, end, message, severity, code } with
// offsets in the source file; severity is error, warning or info.

import { GLOBAL_ATTRIBUTES, HTX_ATTRIBUTES, TAGS, VALUES } from './html.js';
import { elementsOf }                                      from './scan.js';

const GLOBALS = new Set(GLOBAL_ATTRIBUTES);

const camel = name => name.replace(/-(\w)/g, (_, char) => char.toUpperCase());

// names every element takes, whatever it is
const isUniversal = name =>
  GLOBALS.has(name) || name in HTX_ATTRIBUTES || name === 'className' ||
  /^(data|aria)-/.test(name) || /^on./.test(name) || /^(class|style):/.test(name);

// the attributes of a custom element: its own, its properties, the global ones
function knows (info, name) {
  return isUniversal(name) || info.attributes.has(name) || info.members.has(name) || info.members.has(camel(name));
}

function valuesFor (info, name) {
  return info.attributes.get(name)?.values ?? (info.kind === 'html' ? VALUES[`${info.tag}.${name}`] ?? VALUES[name] : null) ?? null;
}

function analyze (template, context) {
  const out  = [...template.errors];
  const push = (severity, code, start, end, message) => out.push({ code, end, message, severity, start });

  for (const element of elementsOf(template.nodes)) {
    const info  = context.resolve(element);
    const range = element.nameRange;

    if (info.kind === 'unknown-shorthand') {
      push(context.partial ? 'warning' : 'error', 'htx-shorthand', range.start, range.end, `unknown shorthand tag <${element.tag}>: no html.define('${element.tag}', …) found`);
    }

    if (info.kind === 'unknown' && /^[a-z]+$/.test(element.tag) && !(element.tag in TAGS)) {
      push('warning', 'htx-element', range.start, range.end, `<${element.tag}> is no html element`);
    }

    // positional values beyond the declared args become children
    const positional = element.attributes.filter(attribute => attribute.positional);
    const args       = info.via?.args ?? [];
    if (info.via && positional.length > args.length) {
      const extra = positional.slice(args.length);
      push('info', 'htx-positional', extra[0].start, extra.at(-1).end, `<${element.name}> takes ${args.length ? `${args.length} positional value${args.length > 1 ? 's' : ''} (${args.join(', ')})` : 'no positional values'}, the rest ${extra.length > 1 ? 'become children' : 'becomes a child'}`);
    }

    for (const attribute of element.attributes) {
      if (attribute.positional || attribute.spread) continue;

      for (const name of attribute.names) {
        if (!name) continue;

        if (info.kind === 'custom' && !knows(info, name)) {
          push('warning', 'htx-attribute', attribute.start, attribute.nameEnd, `<${info.tag}> has no attribute or property '${name}'`);
          continue;
        }

        const values = valuesFor(info, name);
        if (values && attribute.value.kind === 'string' && !values.includes(attribute.value.text)) {
          push('warning', 'htx-value', attribute.value.start, attribute.value.end, `'${attribute.value.text}' is no value of ${name}: ${values.map(value => `'${value}'`).join(' | ')}`);
        }
      }
    }
  }

  for (const hole of template.holes) {
    if (hole?.role === 'raw') push('info', 'htx-raw', hole.start, hole.end, '!html writes markup as it is: sanitize anything that does not come from you');
  }

  return out.sort((a, b) => a.start - b.start);
}

// what a hole should hold, for a host with a type checker:
//   function, object, function-or-object, tag, values (+ values), or null for anything
function expectationOf (hole, context) {
  switch (hole?.role) {
    case 'event'  : return { kind: 'function' };
    case 'ref'    : return { kind: 'function-or-object' };
    case 'spread' : return { kind: 'object' };
    case 'tag'    : return { kind: 'tag' };
    case 'prop'   : {
      if (!hole.element) return null;
      const info   = context.resolve(hole.element);
      const values = hole.names.map(name => valuesFor(info, name)).find(Boolean);
      return values ? { kind: 'values', values } : null;
    }
  }
  return null;
}

export { analyze, expectationOf, valuesFor };
export default analyze;
