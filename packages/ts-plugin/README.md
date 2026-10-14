# @htx/ts-plugin

A TypeScript server plugin for htx templates. It runs inside `tsserver`, so it
works in every editor that uses TypeScript for JavaScript and TypeScript files:
VS Code, Zed, Neovim, Helix, Sublime, Emacs.

Inside `` html`…` `` it adds:

- **diagnostics:** template syntax, unknown shorthand tags, unknown attributes and
  wrong values on custom elements, `<input>` without `/>`, and the types of the
  holes: `onclick=${…}` needs a function, `...${…}` an object, `ref=${…}` a
  function or an object, a hole on an enumerated attribute one of its values
- **completion:** tags (html, custom elements, shorthand tags), attributes,
  events and enumerated values
- **hover:** what a tag renders, its attributes, events and slots
- **definition:** a shorthand tag jumps to its `html.define`, a custom element to
  its module

Everything outside the static text of a template stays with TypeScript.

## setup

```sh
npm install -D @htx/ts-plugin
```

```jsonc
// jsconfig.json or tsconfig.json
{
  "compilerOptions": {
    "plugins": [{ "name": "@htx/ts-plugin" }]
  }
}
```

VS Code loads plugins from `tsconfig.json` / `jsconfig.json` only with the
workspace version of TypeScript ("TypeScript: Select TypeScript Version" → "Use
Workspace Version"). Other editors load them through `typescript-language-server`
or `vtsls`.

| option | default | |
|---|---|---|
| `tags` | `["html", "htx"]` | names of the template tags; `$$.html` and `htx.html` count as `html` |
| `manifests` | `[]` | extra `custom-elements.json` files, relative to the project |
| `checkHoles` | `true` | compare the types in `${…}` with what their place expects |

## where it gets its knowledge

| what | from |
|---|---|
| html, svg, global attributes, events | built into `@htx/analyzer` |
| custom elements | `custom-elements.json` in the project root, the `customElements` field of every dependency's `package.json`, and `manifests` |
| shorthand and defined tags | every `html.define(…)`, `htx.define(…)` and `createHTX(h, F, { tags })` in the program, read statically through the type checker. `import * as elements from '@aufbau/elements/htx'; html.define(elements)` works, a value computed at runtime does not; the registry is then partial and unknown shorthands are warnings |

## development

The plugin is written as ES modules in `src/` and bundled with `@htx/analyzer`
into `dist/plugin.cjs`, since `tsserver` loads plugins with `require()`.

```sh
npm run build
```
