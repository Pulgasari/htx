// @htx/ts-plugin/defines.js
// the tag registry, read from the code: html.define('$icon', spec),
// html.define({ … }), htx.define(namespace), createHTX(h, F, { tags }).
// the arguments are evaluated statically through the type checker, which
// follows imports, re-exports and namespace imports:
//
//   import * as elements from '@aufbau/elements/htx';
//   html.define(elements);          // every export of that module is a tag spec
//
// whatever cannot be read (a call, a parameter) makes the registry partial: an
// unknown shorthand is then a warning, not an error.

const LOCATIONS = Symbol('locations');   // name -> where an object's key was written
const UNKNOWN   = Symbol('unknown');

const cache = new WeakMap;   // program -> { tags, partial }

function collectTags (ts, program, tagNames) {
  const known = cache.get(program);
  if (known) return known;

  const checker = program.getTypeChecker();
  const tags    = {};
  let   partial = false;

  const locate = node => {
    const file = node.getSourceFile();
    return { end: node.getEnd(), file: file.fileName, start: node.getStart(file) };
  };

  const resolve = symbol => symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;

  // a symbol -> its value: a variable's initializer, a module's exports, a function as a component
  function valueOfSymbol (symbol, depth) {
    symbol = resolve(symbol);
    if (!symbol) return UNKNOWN;

    if (symbol.flags & ts.SymbolFlags.ValueModule) {
      const out = { [LOCATIONS]: {} };
      for (const exported of checker.getExportsOfModule(symbol)) {
        const value = valueOfSymbol(exported, depth + 1);
        if (value === UNKNOWN) { partial = true; continue; }
        out[exported.name] = value;
        const declaration = resolve(exported)?.valueDeclaration;
        if (declaration) out[LOCATIONS][exported.name] = locate(declaration.name ?? declaration);
      }
      return out;
    }

    const declaration = symbol.valueDeclaration ?? symbol.declarations?.[0];
    if (!declaration) return UNKNOWN;
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) return evaluate(declaration.initializer, depth + 1);
    if (ts.isFunctionDeclaration(declaration) || ts.isClassDeclaration(declaration)) return { component: symbol.name };
    if (ts.isPropertyAssignment(declaration)) return evaluate(declaration.initializer, depth + 1);
    return UNKNOWN;
  }

  function evaluate (node, depth = 0) {
    if (depth > 12) return UNKNOWN;

    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node)) return evaluate(node.expression, depth);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword)  return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return { component: 'function' };

    if (ts.isArrayLiteralExpression(node)) {
      const out = [];
      for (const element of node.elements) {
        const value = evaluate(element, depth + 1);
        if (value === UNKNOWN) return UNKNOWN;
        out.push(value);
      }
      return out;
    }

    if (ts.isObjectLiteralExpression(node)) {
      const out = { [LOCATIONS]: {} };
      for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
          const value = evaluate(property.expression, depth + 1);
          if (value === UNKNOWN || typeof value !== 'object') { partial = true; continue; }
          Object.assign(out, value);
          Object.assign(out[LOCATIONS], value[LOCATIONS] ?? {});
          continue;
        }
        const name = property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : null;
        if (!name) { partial = true; continue; }
        const value = ts.isPropertyAssignment(property)           ? evaluate(property.initializer, depth + 1)
                    : ts.isShorthandPropertyAssignment(property) ? valueOfSymbol(checker.getShorthandAssignmentValueSymbol(property), depth + 1)
                    :                                              UNKNOWN;
        if (value === UNKNOWN) { partial = true; continue; }
        out[name] = value;
        out[LOCATIONS][name] = locate(property.name);
      }
      return out;
    }

    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) return valueOfSymbol(checker.getSymbolAtLocation(node), depth);

    return UNKNOWN;
  }

  // spec values carry the location of the name they were defined under
  const add = (name, spec, location) => { tags[name] = spec && typeof spec === 'object' ? { ...spec, location } : { location, tag: spec }; };

  function define (args) {
    const [first, second] = args;
    if (!first) return;

    if (second) {
      const name = evaluate(first);
      const spec = evaluate(second);
      if (typeof name !== 'string' || spec === UNKNOWN) { partial = true; return; }
      add(name, spec, locate(first));
      return;
    }

    const specs = evaluate(first);
    if (specs === UNKNOWN || typeof specs !== 'object') { partial = true; return; }
    for (const [name, spec] of Object.entries(specs)) add(name, spec, specs[LOCATIONS]?.[name] ?? locate(first));
  }

  const receiver = node => ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text : null;

  function visit (node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;

      // html.define(…)
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'define' && tagNames.includes(receiver(callee.expression))) define(node.arguments);

      // createHTX(h, Fragment, { tags })
      if (ts.isIdentifier(callee) && (callee.text === 'createHTX' || callee.text === 'createHtml')) {
        const options = node.arguments[2];
        if (options && ts.isObjectLiteralExpression(options)) {
          const property = options.properties.find(item => item.name?.text === 'tags');
          if (property && ts.isPropertyAssignment(property)) define([property.initializer]);
          else if (property && ts.isShorthandPropertyAssignment(property)) define([property.name]);
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const text = sourceFile.text;
    if (!text.includes('.define(') && !text.includes('createHTX') && !text.includes('createHtml')) continue;
    visit(sourceFile);
  }

  const result = { partial, tags };
  cache.set(program, result);
  return result;
}

export { collectTags };
