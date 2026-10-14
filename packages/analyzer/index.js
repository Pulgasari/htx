// @ts-self-types="./index.d.ts"
// @htx/analyzer

/*
htx templates as data for editor tooling. no typescript, no editor api: a host
(the typescript plugin @htx/ts-plugin, the rat language server) finds the
templates in its own syntax tree, hands over their static parts with offsets and
gets back positions it can show.

  const template = scan(statics, holes);              // tree, regions, syntax errors, hole roles
  const context  = createContext({ manifests, tags }); // html, custom-elements.json, html.define()

  analyze(template, context);                // diagnostics
  complete(template, offset, context);       // completion items
  hover(template, offset, context);          // markdown
  definition(template, offset, context);     // where a tag comes from
  expectationOf(template.holes[n], context); // what a hole should hold, for a type checker
*/

export { analyze, expectationOf, valuesFor }       from './analyze.js';
export { classesOf, createContext, keyOf }         from './context.js';
export { readManifest, valuesOf }                  from './manifest.js';
export { complete, definition, hover }             from './query.js';
export { VOID, elementsOf, regionAt, scan }        from './scan.js';
