# @htx/js

the vanilla DOM adapter for [`@htx/htx`](https://jsr.io/@htx/htx).

No VDOM and no diffing: a template call builds DOM nodes and hands them over. it
is a **builder**, not a renderer. to update, `replaceChildren()` the subtree or
bring your own diff.

```javascript
import { html } from '@htx/js';

const $panel = html`
  <section class="panel">
    <h2>${title}</h2>
    <button onClick=${save}>save</button>
  </section>
`;
```

props go through `@domina/methods`, so event handlers, `dataset`, `style` objects and the `appendTo` / `prependTo` shortcuts all work. 

SVG-tags are created in the right namespace, which keeps `viewBox` and friends from being lowercased. the tags shared with HTML (`a`, `script`, `style`, `title`) stay HTML on purpose.

it runs with `memo: false`. `evaluate()` otherwise caches a fully static subtree
and returns the identical node on every later call, which is correct for an
immutable vnode and wrong for a DOM node — appending it a second time would move
it out of the first tree instead of building a second one.

## exports

| identifier | |
|---|---|
| `htx` / `html` | the shared tag function (both are identical) |
| `createHTX` | the core factory, re-exported |
| `createVanillaHTX` | a tag function with a registry of its own, `{ tags }` |
| `h` | the hyperscript the adapter hands to the core |
| `Fragment` | the fragment type, built as a `DocumentFragment` |
| `RAW_HTML` | `'!html'`, for the spread form |
