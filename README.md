# htx :: spec

A tiny preprocessor that turns terse, custom-tag markup into real HTML. No
build step — the compile core is DOM-free, so it runs the same in the
browser, node and deno.

- live-preview: http://code.pulgasari.dev/htx/
- with aufbau/elements: http://code.pulgasari.dev/htx/aufbau.html

## use it in the browser

```html
<script type="module" src="./lib/htx.js"></script>

<script type='htx'>
  <tmpl tag='btn' is='button' />

  <#app>
    <grid>
      <card>hello</card>
      <btn.primary 'click me' on:click={alert('moin!')} />
    </grid>
  </#app>
</script>
```

`index.html` is a full self-contained showcase (hero, components and a live
playground) — open it directly in a browser.

## use it in js (node, deno, browser)

```js
import { compile } from './lib/core.js';
import htx         from './lib/tag.js';

compile("<card.hero>hello</card.hero>");
htx`<card.hero>hello ${name}</card.hero>`;
```

`lib/core.js` is the DOM-free engine (`compile(source) -> html string`) that
`lib/htx.js` and `lib/tag.js` both build on:

- `lib/htx.js` — the browser "pure" variant: mounts into a real DOM element
  and wires up `on:event` bindings (`render`, `autoInit`).
- `lib/tag.js` — the tagged-template variant: just `compile()` wrapped as
  `` htx`<tag>...</tag>` ``, no mounting, no events.

## spec

- native html-tags work normally
- webcomponents as well
- one could use custom-tags with or without explicitly defining them
- if they weren't specified they simply become a div with a className of the custom-tag-name
- shorthand `#id`
- shorthand `.class1.class2`

## undefined custom-tags

```xml
<box>
  <card>...</card>
  <card>...</card>
</box>
```

an undefined custom tag evaluates to a `<div>` with a className of that tagName.

```xml
<div class='box'>
  <div class='card'>...</div>
  <div class='card'>...</div>
</div>
```

## define custom-tags by shorthand mapping

```html
<tmpl tag='btn'  is='button' />
<tmpl tag='href' is='a'      attr='href' />
<tmpl tag='pic'  is='img'    attr='src'  />
```

```xml
<href 'https://example.com' />
<btn.primary 'click me!' on:click={alert('moin!')} />
<pic 'https://example.tld/sky.jpg' />
```

## define custom-tags by template

refer to an custom-tag-attribute with `$name`.

```html
<tmpl tag='track'>
  <div class='track'>
    <img src='./$title.jpg' />
    <audio src='./$title.mp3' />
  </div>
</tmpl>
```

```html
<track title='example1' />
<track title='example2' />
```

or use even `$attr`:

```html
<tmpl tag='track'>
  <div class='track'>
    <img src='./$attr.jpg' />
    <audio src='./$attr.mp3' />
  </div>
</tmpl>
```

```html
<track 'example1' />
<track 'example2' />
```

---

# ideas

## conditional classes

got applied if condition meets `true`.

```html
<sth class:active={condition} />
```

got applied if condition meets `false`.

```html
<sth class:!inactive={condition} />
```

if `true` the first got applied. if `false` the second.

```html
<sth class:active!inactive={condition} />
```

## key events

```html
<sth onKey:enter={doSomething} />
```

```html
<sth onKey:ctrl+f={doSomething} />
```




