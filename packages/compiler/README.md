# @htx/compiler

htx without the `` html`...` ``.

an `.htx` file is markup first, and compiles into an ES-module whose default export is the component.

```html
<script module>
  export const sizes = ['s', 'm', 'l'];
</script>

<script>
  import Badge from './badge.htx';
  const { name, size = 'm' } = props;
</script>

<div.card id|title=${name}>
  <$icon 'bx:search' />
  <${Badge} label=${size} />
</div.card>

<style>
  .card { display: flex; }
</style>
```

## The file

| part | where it ends up |
|---|---|
| `<script module>` | module level, runs once. exports go here |
| `<script>` | the body of the component function, runs on every render. `props` is in scope, imports are lifted to module level |
| `<style>` | `export const style`, a string. nothing is injected (yet) |
| everything else | the markup, returned as one `` html`…` `` call |

The markup is **not parsed by the compiler**. It goes to the adapter's `html` as
it is, so the whole htx syntax works — selectors, prop groups, positional
values, shorthand tags, `!html` — and keeps working as htx grows. Holes are
written as in a template: `${…}`. The compiler only finds the blocks, the holes
and the two characters a template literal would read differently (`\` and `` ` ``),
which are text in an `.htx` file.

The component is named after the file: `card-item.htx` → `CardItem`.

Refused, with file, line and column:
- an `export` in `<script>` (the component body has none)
- an `export default` in `<script module>` (the markup is the default export)
- a broken expression in a `${…}` hole, an unclosed block or comment

A `<script>` or `<style>` is taken out wherever it stands, except inside a hole
or a comment. An inline script in the markup is not possible, that is what
`!html` is for.

## Using it

```javascript
import { compile } from '@htx/compiler';

compile(source, { adapter: '@htx/preact', filename: 'card.htx' }).code;
```

`adapter` is the module the compiled file imports `html` from, `@htx/preact` by
default. Shorthand tags defined on that shared instance (`html.define(…)`) are
there in every `.htx` file.

**esbuild**

```javascript
import { htx } from '@htx/compiler/esbuild';

await esbuild.build({ entryPoints: ['app.js'], bundle: true, plugins: [htx({ adapter: '@htx/js' })] });
```

**node**

```sh
node --import @htx/compiler/register app.js
```

or with options of your own:

```javascript
import { register } from 'node:module';
register('@htx/compiler/node', import.meta.url, { data: { adapter: '@htx/js' } });
```

**deno** has no load hooks, so `.htx` goes through a build step there (esbuild
with this plugin, or `compile()` in a script of your own).

## Open

- `<style>`: scoped or not, injected or only exported
- source maps, so a runtime error points into the `.htx` file
- editor support: associating `*.htx` with html gives script and style
  highlighting, the markup has none of its own yet
- whether the component may be `async`, or `await` stays module level
