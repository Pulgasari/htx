# HTX

HTX = HTM EXTENDED (but we couldn't name it HTMX lol)

a fork of [htm](https://github.com/developit/htm) with some syntax sugar added to it.

- merged props
- prop groups
- tag selectors
- shorthand tags
- vanilla DOM adapter
- markdown adapter

## packages

| package | path | |
|---|---|---|
| [`@htx/htx`](https://jsr.io/@htx/htx) | [`packages/htx`](packages/htx) | the core, plus `@htx/htx/markdown` |
| [`@htx/js`](https://jsr.io/@htx/js) | [`packages/js`](packages/js) | the vanilla DOM adapter |
| [`@htx/preact`](https://jsr.io/@htx/preact) | [`packages/preact`](packages/preact) | the preact adapter |

```javascript
import { html } from '@htx/js';
import { html } from '@htx/preact';
```

The core is documented in [`packages/htx/README.md`](packages/htx/README.md).

## development

The repo is a deno workspace, so the adapters resolve `@htx/htx` to the local
package. On publish, deno rewrites that import to `jsr:@htx/htx@^<version>`.

```sh
deno task publish:dry     # dry run of the whole workspace
```

## publishing

`.github/workflows/publish-to-jsr.yml` publishes one package per run: 
1. go to `Actions`
2. click *publish to jsr*
3. click *run workflow*
4. pick the package.

auth runs over OIDC, so the package has to be linked to this repository in its settings on jsr.io first.

bump `version` in the package's `deno.json` before running it. `@htx/htx` goes
first whenever an adapter depends on a change in it.
