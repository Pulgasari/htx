# @htx/js

the vanilla DOM adapter for [`@htx/htx`](https://jsr.io/@htx/htx).

No VDOM and no diffing: a template call builds DOM nodes and hands them over. it
is a **builder**, not a renderer. to update, `replaceChildren()` the subtree or
bring your own diff.

```javascript
import htx from '@htx/js';

const $panel = htx`
  <section class="panel">
    <h2>${title}</h2>
    <button onClick=${save}>save</button>
  </section>
`;
```

props go through `@domina/methods`, so event handlers, `dataset`, `style` objects and the `appendTo` / `prependTo` shortcuts all work. 

`ref` gets the node once its children are in, a function is called with it,
an object gets it as `.current` (as in preact):

```html
<script>
  let output;
  const step = by => () => output.value = Number(output.value) + by;
</script>

<output ref=${node => output = node}>0</output>
<button onClick=${step(1)}>+</button>
```

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

## renderer

`@htx/js/render` renders htx with [`@domina/render`](https://jsr.io/@domina/render):
the template is parsed and cloned once, every later render writes only the holes
that changed. nodes, focus and input values inside survive.

```javascript
import { html, render, each, when } from '@htx/js/render';

const view = ({ title, items }) => html`
  <section.card>
    <h2>${title}</h2>
    ${when(items.length, () => html`<ul>${each(items, item => item.id, item => html`<li>${item.name}</li>`)}</ul>`)}
  </section>
`;

render(container, view(state));   // first call clones, later calls patch
```

`configure({ effect })` makes a function in a value hole live (`${() => $count}`),
for a signal library such as `@rat/runtime`. the tag registry is shared with the
builder: `html.define()` on either is seen by both.
