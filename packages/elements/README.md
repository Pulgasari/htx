# @htx/elements

html and htx files as parts of a page, compiled in the browser by
[`@htx/compiler`](../compiler/README.md). importing the package defines
`<htx-part>`.

```html
<script type="module">
  import { settled } from '@htx/elements';
  await settled();   // every part is in the page now
</script>

<form>
  <htx-part src="./elements.input.htx.html"></htx-part>
  <htx-part src="./elements.media.htx.html" as="section#media"></htx-part>
</form>
```

a part replaces itself with what the file renders. no build step: the file is
fetched, compiled, imported from a blob url and rendered with `@htx/js`, which
builds real dom nodes.

## `<htx-part>`

| attribute | |
|---|---|
| `src` | the file, relative to the page, or to the file it stands in for a part inside a part |
| `as` | a wrapper around the result, written as a selector: `section`, `section#media`, `div.row.wide` |
| `data-*` | the props of the file's component: `data-name="Ada"` is `props.name` |

- `part.ready` is a promise of the nodes the part was replaced with.
- `settled(root = document)` resolves once no part below root is left to load,
  parts inside parts included.
- the event `htx-part` bubbles from the parent of a part once it is replaced,
  `{ nodes, src }`.
- a part that fails keeps its place, empty, with the attribute `failed`, and the
  error goes to the console.

## the file

any `.htx` file, see the compiler. plain html works as it is, since html is htx
without the extras. while there is no syntax highlighting for `.htx`, the
extension `.htx.html` keeps an editor's html support.

```html
<script>
  import Badge from './badge.htx';
  const { name = 'nobody' } = props;
</script>

<h2 class="greet">hello ${name}</h2>
<${Badge} label="new" />
<htx-part src="./more.htx.html"></htx-part>

<style>
  .greet { color: var(--color-ink); }
</style>
```

- relative imports are read against the file, an imported `.htx` file is
  compiled the same way.
- `<style>` is adopted by the document once per file. it is not scoped.
- a bare attribute is an empty one, the way html has it (`<output-value icon>`).

## `load(url, { adapter, base })`

the module of an `.htx` file, for use without the element: its component as
default export, `style` if it has one. `adapter` is `@htx/js` by default, a file
is fetched and compiled once per adapter.

```js
import { load } from '@htx/elements';
const { default: Card } = await load('./card.htx');
document.body.append(Card({ name: 'Ada' }));
```

## what it needs

an importmap with `@htx/compiler`, `@htx/js`, `@htx/htx`, `@domina/methods` and
`acorn` (the compiler's parser, `https://esm.sh/acorn@8`).

## open: kinds of files

a part is one kind of htx file. the idea is a few more, told by the first line
of the file, so the compiler stays as it is:

```html
<!-- htx: part -->                 markup to put somewhere, what <htx-part> does now
<!-- htx: element card-item -->    a custom element <card-item>, defined on load
<!-- htx: view /settings -->       a routed screen, e.g. an <app-view> of @aufbau/elements
```

- **element**: the props from the attributes, re-rendered on a change; light or
  shadow dom, and the `<style>` scoped to it.
- **view**: lazily loaded when its route is shown.
- compiling on the server or in a build step (`@htx/compiler/esbuild`) instead of
  the browser, with the same files: then acorn and the compile step are no longer
  shipped.

---

# more elements ?

```md
<htx-clone>
<htx-copy>
```
