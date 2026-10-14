// @htx/analyzer/query.js
// completion, hover and definition at an offset of a scanned template. results
// carry offsets in the source file and plain data; the host turns them into its
// own format (typescript, lsp).
//
//   item       { label, kind, detail, documentation, insertText, sort }
//   completion { start, end, items }   start..end is the text the item replaces
//   hover      { start, end, markdown }
//   definition { location: { file, start, end } } or { module, source }

import { EVENTS, GLOBAL_ATTRIBUTES, HTX_ATTRIBUTES, TAGS } from './html.js';
import { valuesFor }                                       from './analyze.js';
import { elementsOf, regionAt }                            from './scan.js';

// the innermost element whose children hold the offset
function openElementAt (template, offset) {
  let found = null;
  for (const element of elementsOf(template.nodes)) {
    if (element.openEnd !== undefined && element.openEnd <= offset && (element.close?.start ?? element.end) >= offset) found = element;
  }
  return found;
}

// :::::: COMPLETION

function tagItems (context) {
  const items = [];
  for (const [tag, description] of Object.entries(TAGS)) items.push({ detail: description, kind: 'element', label: tag, sort: '2' });
  for (const [tag, info] of context.custom) items.push({ detail: info.description || 'custom element', documentation: elementDoc(info), kind: 'custom', label: tag, sort: '1' });
  for (const entry of context.registry.values()) {
    if (entry.key[0] !== '$') continue;
    items.push({ detail: entry.tag ? `<${entry.tag}>` : 'component', documentation: shorthandDoc(entry), kind: 'shorthand', label: entry.key, sort: '0' });
  }
  return items;
}

function attributeItems (element, context) {
  const info  = context.resolve(element);
  const items = [];
  const seen  = new Set;
  const add   = item => { if (!seen.has(item.label)) { seen.add(item.label); items.push(item); } };

  for (const attribute of info.attributes.values()) add({ detail: attribute.type ?? '', documentation: attribute.description, kind: 'attribute', label: attribute.name, sort: '0' });
  for (const member of info.members.values()) add({ detail: member.type ?? 'property', documentation: member.description, kind: 'property', label: member.name, sort: '1' });
  for (const event of info.events) add({ detail: 'event', documentation: event.description, kind: 'event', label: `on${event.name}`, sort: '1' });
  for (const name of GLOBAL_ATTRIBUTES) add({ detail: 'global attribute', kind: 'attribute', label: name, sort: '2' });
  for (const name of EVENTS) add({ detail: 'event', kind: 'event', label: `on${name}`, sort: '3' });
  for (const [name, description] of Object.entries(HTX_ATTRIBUTES)) add({ detail: 'htx', documentation: description, kind: 'keyword', label: name, sort: '4' });

  return items;
}

function complete (template, offset, context) {
  const region = regionAt(template, offset);
  if (!region) return null;

  if (region.kind === 'tagName') return { end: region.end, items: tagItems(context), start: region.start };

  if (region.kind === 'closeName') {
    const element = openElementAt(template, region.start - 2);
    return element?.name ? { end: region.end, items: [{ detail: 'close', kind: 'element', label: element.name, sort: '0' }], start: region.start } : null;
  }

  if (region.kind === 'attrName') return { end: region.end, items: attributeItems(region.element, context), start: region.start };

  // inside the open tag, between attributes
  if (region.kind === 'tag' && region.element && offset > region.element.nameRange.end) return { end: offset, items: attributeItems(region.element, context), start: offset };

  if (region.kind === 'attrValue') {
    const info   = context.resolve(region.element);
    const values = region.attribute.names.map(name => valuesFor(info, name)).find(Boolean);
    return values ? { end: region.end, items: values.map(value => ({ detail: region.attribute.name, kind: 'value', label: value, sort: '0' })), start: region.start } : null;
  }

  return null;
}

// :::::: HOVER

function list (title, entries, line) {
  return entries.length ? `\n\n**${title}**\n\n${entries.map(line).join('\n')}` : '';
}

function elementDoc (info) {
  return [
    info.description,
    list('attributes', [...info.attributes.values()], attribute => `- \`${attribute.name}\`${attribute.type ? `: \`${attribute.type}\`` : ''}${attribute.description ? ` ${attribute.description}` : ''}`),
    list('events', info.events, event => `- \`${event.name}\`${event.description ? ` ${event.description}` : ''}`),
    list('slots', info.slots, slot => `- \`${slot.name || '(default)'}\`${slot.description ? ` ${slot.description}` : ''}`),
    info.link ? `\n\n[mdn](${info.link})` : '',
  ].join('').trim();
}

function shorthandDoc (entry) {
  const target = entry.tag ? `\`<${entry.tag}>\`` : entry.component ? `the component \`${entry.component}\`` : entry.key[0] === '$' ? 'nothing (no tag)' : `\`<${entry.key}>\``;
  const args   = entry.args.length ? `\n\npositional: ${entry.args.map(arg => `\`${arg}\``).join(', ')}` : '';
  const props  = Object.keys(entry.props).length ? `\n\ndefaults: ${Object.entries(entry.props).map(([key, value]) => `\`${key}="${value}"\``).join(' ')}` : '';
  return `renders ${target}${args}${props}`;
}

function hover (template, offset, context) {
  const region = regionAt(template, offset);
  if (!region?.element || region.start === region.end) return null;
  const info = context.resolve(region.element);

  if (region.kind === 'tagName') {
    const head = `\`<${region.element.name}>\``;
    const via  = info.via ? `\n\n${shorthandDoc(info.via)}` : '';
    const body = info.kind === 'unknown-shorthand' ? 'unknown shorthand tag' : elementDoc(info);
    return { end: region.end, markdown: `${head}${via}${body ? `\n\n${body}` : ''}`, start: region.start };
  }

  if (region.kind === 'attrName') {
    const name      = region.attribute.names.find(part => offset <= region.start + region.attribute.name.indexOf(part) + part.length) ?? region.attribute.names[0];
    const attribute = info.attributes.get(name);
    const member    = info.members.get(name);
    const event     = /^on./.test(name) && info.events.find(item => item.name === name.slice(2));
    const special   = HTX_ATTRIBUTES[name] ?? HTX_ATTRIBUTES[name.replace(/:.*/, ':')];

    const markdown =
        attribute ? `\`${name}\`${attribute.type ? `: \`${attribute.type}\`` : ''}${attribute.description ? `\n\n${attribute.description}` : ''}`
      : member    ? `\`${name}\` (property)${member.type ? `: \`${member.type}\`` : ''}${member.description ? `\n\n${member.description}` : ''}`
      : event     ? `\`${name}\`: the \`${event.name}\` event${event.description ? `\n\n${event.description}` : ''}`
      : special   ? `\`${name}\` (htx)\n\n${special}`
      : GLOBAL_ATTRIBUTES.includes(name) ? `\`${name}\`: global attribute\n\n[mdn](https://developer.mozilla.org/docs/Web/HTML/Global_attributes/${name})`
      : null;

    return markdown ? { end: region.end, markdown, start: region.start } : null;
  }

  return null;
}

// :::::: DEFINITION

function definition (template, offset, context) {
  const region = regionAt(template, offset);
  if (region?.kind !== 'tagName' || !region.element) return null;
  const info = context.resolve(region.element);

  // a shorthand leads to its define, a custom element to its module, anything else defined to its define
  if (region.element.tag[0] !== '$' && info.kind === 'custom') return { end: region.end, module: info.module, source: info.source, start: region.start };
  if (info.via?.location) return { end: region.end, location: info.via.location, start: region.start };
  return null;
}

export { complete, definition, hover, openElementAt };
