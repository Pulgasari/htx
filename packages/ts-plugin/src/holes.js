// @htx/ts-plugin/holes.js
// the type of each ${…} against what its place in the template expects (see
// expectationOf in @htx/analyzer). any and unknown pass: without types there is
// nothing to say.

import { expectationOf } from '@htx/analyzer';

function holeDiagnostics (ts, checker, template, context) {
  const out = [];

  const loose    = type => type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown);
  const callable = type => type.getCallSignatures().length > 0;
  const object   = type => !!(type.flags & ts.TypeFlags.Object) || type.isIntersection();
  const text     = type => checker.typeToString(type);

  for (const hole of template.holes) {
    const expected   = expectationOf(hole, context);
    const expression = template.expressions[hole?.hole];
    if (!expected || !expression) continue;

    const type = checker.getNonNullableType(checker.getTypeAtLocation(expression));
    if (loose(type) || type.flags & ts.TypeFlags.Never) continue;

    const report = message => out.push({ code: 'htx-hole', end: hole.end, message, severity: 'warning', start: hole.start });
    const name   = hole.names?.[0];

    switch (expected.kind) {
      case 'function':
        if (!callable(type)) report(`${name} expects a function, got ${text(type)}`);
        break;
      case 'function-or-object':
        if (!callable(type) && !object(type)) report(`ref expects a function or an object with current, got ${text(type)}`);
        break;
      case 'object':
        if (!object(type)) report(`a spread expects an object, got ${text(type)}`);
        break;
      case 'tag':
        if (!callable(type) && !(type.flags & ts.TypeFlags.StringLike)) report(`a tag is a name or a component, got ${text(type)}`);
        break;
      case 'values': {
        const members = type.isUnion() ? type.types : [type];
        const wrong   = members.filter(member => member.isStringLiteral() && !expected.values.includes(member.value));
        if (wrong.length) report(`${wrong.map(member => `'${member.value}'`).join(', ')} is no value of ${name}: ${expected.values.map(value => `'${value}'`).join(' | ')}`);
        break;
      }
    }
  }

  return out;
}

export { holeDiagnostics };
