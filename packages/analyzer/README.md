# @htx/analyzer

htx templates as data for editor tooling. No TypeScript, no editor API: a host
finds the templates in its own syntax tree, hands over their static parts with
offsets and gets back positions it can show. Hosts so far:
[`@htx/ts-plugin`](../ts-plugin) (htx in `.js` and `.ts`), and the rat language
server (htx in `.rat` and `.rat.js`).

```javascript
import { analyze, complete, createContext, definition, hover, scan } from '@htx/analyzer';

// html`<p class=${cls}>hi</p>` at offset 100 of a file
const template = scan(
  [{ start: 105, text: '<p class=' }, { start: 120, text: '>hi</p>' }],
  [{ start: 114, end: 120 }],                     // ${cls}
);

const context = createContext({
  manifests : [customElementsJson],               // custom-elements.json
  tags      : { $icon: { tag: 'aufbau-icon', args: ['icon'] } },   // what html.define() was given
});

analyze(template, context);              // [{ start, end, message, severity, code }]
complete(template, 106, context);        // { start, end, items }
hover(template, 106, context);           // { start, end, markdown }
definition(template, 106, context);      // { location } or { module, source }
```

## what `scan` returns

| field | content |
|---|---|
| `nodes` | elements, text, child holes and comments, with offsets |
| `errors` | syntax errors: unclosed tags, quotes and comments, `<input>` without `/>`, a closing tag without an open one, malformed prop groups, a second id in a selector |
| `holes` | the role of every `${…}`: `child`, `tag`, `spread`, `positional`, `event`, `ref`, `raw`, `class`, `style`, `prop`, `part`, `closing`, `comment` |
| `regions` | what sits where: `tagName`, `attrName`, `attrValue`, `closeName`, `tag` (the whole open tag), `text` |

`scan` follows the rules of `build()` in `@htx/htx`, but keeps positions and keeps
going after an error. Changes to the htx syntax have to be made in both.

## what `analyze` checks

| code | severity | |
|---|---|---|
| `htx-shorthand` | error (warning if the registry is partial) | `<$name>` that was never defined |
| `htx-element` | warning | a lowercase tag that is no html or svg element |
| `htx-attribute` | warning | an attribute a custom element does not have (from its manifest) |
| `htx-value` | warning | a static value outside an enumeration (manifest, or html: `type`, `target`, …) |
| `htx-positional` | info | more positional values than the tag declares |
| `htx-raw` | info | `!html=${…}` |
| syntax codes | error / warning | from `scan` |

`createContext({ classes })` takes class names (`classesOf(css)` reads them from a
stylesheet): `complete` then offers them after a `.` in a selector (`<div.card.|`)
and inside `class="…"`.

`expectationOf(hole, context)` says what a hole should hold (`function`, `object`,
`function-or-object`, `tag`, `values`), for a host that has a type checker.
