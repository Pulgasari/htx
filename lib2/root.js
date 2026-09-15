// root.js — <htx-root>: the web-component variant of the runtime. The
// custom element itself carries the engine (connectedCallback compiles and
// mounts), instead of a page-wide autoInit() scan over <script type="htx">.
//
// A plain custom element can't hold the DSL source as literal light-DOM
// children — the browser's own HTML parser would tokenize shorthand like
// `.class`, `'positional'` or `on:click={}` before any JS ever runs (the
// same problem a <script> nested inside <script type="htx"> hits, just one
// level up). So the source still has to sit in a real raw-text element;
// <htx-root> expects exactly one <script> child for that and doesn't care
// about its `type` — use something inert like `text/plain` so it can't be
// picked up by lib/htx.js's page-wide autoInit() if both run on one page.
//
//   <htx-root>
//     <script type="text/plain">
//       <htx-tag:btn is='button' />
//       <btn.primary 'click me' on:click={alert('moin!')} />
//     </script>
//   </htx-root>

import { compile }    from './core.js';
import { bindEvents } from './events.js';

// :::::: ELEMENT

class HtxRoot extends HTMLElement {
  connectedCallback () {
    if (this.__htxDone) return;
    this.__htxDone = true;

    const script = this.querySelector('script');
    if (!script) return;

    this.innerHTML = compile(script.textContent);
    bindEvents(this);
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('htx-root')) {
  customElements.define('htx-root', HtxRoot);
}

export       { HtxRoot, compile };
export default HtxRoot;
