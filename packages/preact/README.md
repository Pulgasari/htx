# @htx/preact

The [preact](https://preactjs.com) adapter for [`@htx/htx`](https://jsr.io/@htx/htx).

```javascript
import { html, render } from '@htx/preact';

render(html`<div.card>${title}</div>`, document.body);
```

Everything `preact` exports is re-exported, so `h`, `Fragment`, `render` and
the rest come from the same import.

`!html` is translated to `dangerouslySetInnerHTML` on elements only. A component
is not an element, so it receives the prop untouched and may forward it to the
element it renders. Children next to `!html` are dropped by preact, and the
adapter says so in the console.

## Exports

| | |
|---|---|
| `html` / `htx` | the shared tag function |
| `createPreactHtml(options)` | a tag function with a registry of its own, `{ tags }` |
| `RAW_HTML` | `'!html'`, for the spread form |
| `*` | everything from `preact` |
