// @htx/analyzer/manifest.js
// custom-elements.json (schema 2.x) -> what the analyzer needs per tag. several
// manifests merge into one map; a later one wins for the same tag.

// '"primary" | "ghost"' -> ['primary', 'ghost'], anything else -> null
function valuesOf (type) {
  const text = typeof type === 'string' ? type : type?.text;
  if (!text) return null;
  const parts = text.split('|').map(part => part.trim());
  if (!parts.every(part => /^(["']).*\1$/.test(part))) return null;
  return parts.map(part => part.slice(1, -1));
}

const typeText = type => typeof type === 'string' ? type : type?.text ?? null;

function elementOf (declaration, module, source) {
  const attributes = new Map;
  for (const attribute of declaration.attributes ?? []) {
    attributes.set(attribute.name, {
      default     : attribute.default,
      description : attribute.description ?? attribute.summary ?? '',
      field       : attribute.fieldName ?? null,
      name        : attribute.name,
      type        : typeText(attribute.type),
      values      : valuesOf(attribute.type),
    });
  }

  const members = new Map;
  for (const member of declaration.members ?? []) {
    if (member.kind === 'field' && !member.static && member.privacy !== 'private') members.set(member.name, { description: member.description ?? '', name: member.name, type: typeText(member.type) });
  }

  return {
    attributes,
    className   : declaration.name,
    description : declaration.description ?? declaration.summary ?? '',
    events      : (declaration.events ?? []).filter(event => event.name).map(event => ({ description: event.description ?? '', name: event.name })),
    kind        : 'custom',
    members,
    module      : module.path,
    slots       : (declaration.slots ?? []).map(slot => ({ description: slot.description ?? '', name: slot.name })),
    source,
    tag         : declaration.tagName,
  };
}

// manifest: the parsed json. source: where it came from, so a definition can point at the module
function readManifest (manifest, source = null, into = new Map) {
  for (const module of manifest?.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (declaration.customElement && declaration.tagName) into.set(declaration.tagName, elementOf(declaration, module, source));
    }
    // a tag defined in one module for a class declared in another
    for (const entry of module.exports ?? []) {
      if (entry.kind !== 'custom-element-definition' || into.has(entry.name)) continue;
      const declaration = manifest.modules.find(other => other.path === entry.declaration?.module)?.declarations?.find(item => item.name === entry.declaration.name);
      if (declaration) into.set(entry.name, elementOf({ ...declaration, tagName: entry.name }, module, source));
    }
  }
  return into;
}

export { readManifest, valuesOf };
export default readManifest;
