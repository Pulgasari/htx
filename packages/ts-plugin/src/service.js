// @htx/ts-plugin/service.js
// wraps typescript's language service: inside the static text of a template the
// analyzer answers, everywhere else typescript does. diagnostics are both.

import { analyze, complete, createContext, definition, hover } from '@htx/analyzer';

import { collectTags }               from './defines.js';
import { holeDiagnostics }           from './holes.js';
import { dirname, join, manifestsOf } from './manifests.js';
import { templateAt, templatesIn }   from './templates.js';

const CODES = {
  'htx-attribute'    : 61001,
  'htx-closing'      : 61002,
  'htx-closing-name' : 61003,
  'htx-comment'      : 61004,
  'htx-element'      : 61005,
  'htx-group'        : 61006,
  'htx-hole'         : 61007,
  'htx-positional'   : 61008,
  'htx-quote'        : 61009,
  'htx-raw'          : 61010,
  'htx-selector-id'  : 61011,
  'htx-shorthand'    : 61012,
  'htx-spread'       : 61013,
  'htx-syntax'       : 61014,
  'htx-unclosed'     : 61015,
  'htx-value'        : 61016,
  'htx-void'         : 61017,
};

function createService (ts, info, config) {
  const service = info.languageService;
  const root    = info.project.getCurrentDirectory();
  const log     = message => info.project.projectService.logger.info(`[htx] ${message}`);

  const KINDS = {
    attribute : ts.ScriptElementKind.memberVariableElement,
    custom    : ts.ScriptElementKind.classElement,
    element   : ts.ScriptElementKind.classElement,
    event     : ts.ScriptElementKind.functionElement,
    keyword   : ts.ScriptElementKind.keyword,
    property  : ts.ScriptElementKind.memberVariableElement,
    shorthand : ts.ScriptElementKind.alias,
    value     : ts.ScriptElementKind.string,
  };

  const CATEGORIES = { error: ts.DiagnosticCategory.Error, info: ts.DiagnosticCategory.Suggestion, warning: ts.DiagnosticCategory.Warning };

  // one context per program: the registry follows the code, manifests their files
  const contexts = new WeakMap;
  function contextOf (program) {
    let context = contexts.get(program);
    if (!context) {
      const { partial, tags } = collectTags(ts, program, config().tags);
      context = createContext({ manifests: manifestsOf(ts, root, config()), partial, tags });
      contexts.set(program, context);
    }
    return context;
  }

  // the source file, its program and context, and the template at a position (or null)
  function locate (file, position) {
    const program    = service.getProgram();
    const sourceFile = program?.getSourceFile(file);
    if (!sourceFile) return null;
    const template = position === undefined ? null : templateAt(ts, sourceFile, position, config().tags);
    return { context: contextOf(program), program, sourceFile, template };
  }

  // a call into the analyzer must never take typescript down with it
  const guard = (fn, fallback) => { try { return fn() ?? fallback(); } catch (error) { log(error.stack); return fallback(); } };

  const lastItems = new Map;   // file -> { position, items by name }

  return {
    getSemanticDiagnostics (file) {
      const base = service.getSemanticDiagnostics(file);
      return guard(() => {
        const state = locate(file);
        if (!state) return base;
        const checker = state.program.getTypeChecker();
        const found   = [];
        for (const template of templatesIn(ts, state.sourceFile, config().tags)) {
          found.push(...analyze(template, state.context));
          if (config().checkHoles !== false) found.push(...holeDiagnostics(ts, checker, template, state.context));
        }
        return [...base, ...found.map(item => ({
          category    : CATEGORIES[item.severity],
          code        : CODES[item.code] ?? 61000,
          file        : state.sourceFile,
          length      : Math.max(item.end - item.start, 1),
          messageText : item.message,
          source      : 'htx',
          start       : item.start,
        }))];
      }, () => base);
    },

    getCompletionsAtPosition (file, position, options, settings) {
      const fallback = () => service.getCompletionsAtPosition(file, position, options, settings);
      return guard(() => {
        const state = locate(file, position);
        if (!state?.template) return null;
        const result = complete(state.template, position, state.context);
        if (!result) return { entries: [], isGlobalCompletion: false, isMemberCompletion: false, isNewIdentifierLocation: false };

        lastItems.set(file, { items: new Map(result.items.map(item => [item.label, item])), position });
        return {
          entries: result.items.map(item => ({
            insertText      : item.insertText,
            kind            : KINDS[item.kind] ?? ts.ScriptElementKind.unknown,
            kindModifiers   : '',
            labelDetails    : item.detail ? { description: item.detail } : undefined,
            name            : item.label,
            replacementSpan : { length: result.end - result.start, start: result.start },
            sortText        : item.sort ?? '5',
          })),
          isGlobalCompletion      : false,
          isMemberCompletion      : false,
          isNewIdentifierLocation : false,
        };
      }, fallback);
    },

    getCompletionEntryDetails (file, position, name, ...rest) {
      const fallback = () => service.getCompletionEntryDetails(file, position, name, ...rest);
      const item     = lastItems.get(file)?.items.get(name);
      if (!item || !locate(file, position)?.template) return fallback();
      return {
        displayParts  : item.detail ? [{ kind: 'text', text: item.detail }] : [],
        documentation : item.documentation ? [{ kind: 'markdown', text: item.documentation }] : [],
        kind          : KINDS[item.kind] ?? ts.ScriptElementKind.unknown,
        kindModifiers : '',
        name,
      };
    },

    getQuickInfoAtPosition (file, position, ...rest) {
      const fallback = () => service.getQuickInfoAtPosition(file, position, ...rest);
      return guard(() => {
        const state  = locate(file, position);
        const result = state?.template && hover(state.template, position, state.context);
        if (!result) return null;
        return {
          displayParts  : [],
          documentation : [{ kind: 'markdown', text: result.markdown }],
          kind          : ts.ScriptElementKind.unknown,
          kindModifiers : '',
          textSpan      : { length: result.end - result.start, start: result.start },
        };
      }, fallback);
    },

    getDefinitionAndBoundSpan (file, position) {
      const fallback = () => service.getDefinitionAndBoundSpan(file, position);
      return guard(() => {
        const state  = locate(file, position);
        const result = state?.template && definition(state.template, position, state.context);
        if (!result) return null;

        const target = result.location
          ? { fileName: result.location.file, textSpan: { length: result.location.end - result.location.start, start: result.location.start } }
          : { fileName: join(dirname(result.source), result.module), textSpan: { length: 0, start: 0 } };

        return {
          definitions : [{ ...target, containerKind: '', containerName: '', kind: ts.ScriptElementKind.alias, name: '' }],
          textSpan    : { length: result.end - result.start, start: result.start },
        };
      }, fallback);
    },
  };
}

export { createService };
