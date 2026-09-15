// load.js — <htx-load src="...">: fetches a .htx/.html fragment, compiles
// it through the lib2 engine and mounts the result in its own place.
// Plain HTML fetches through compile() untouched (native tags pass through
// as-is), so the same tag works for either file kind — no `mode` needed.
//
//   <htx-load src="./card.htx"></htx-load>
//
// Requires a real fetch (served over http(s), same as any module import —
// file:// won't work here either, for the same CORS reasons).

import { compile }    from './core.js';
import { bindEvents } from './events.js';

// :::::: ELEMENT

class HtxLoad extends HTMLElement {
  connectedCallback () {
    if (this.__htxDone) return;
    this.__htxDone = true;

    const src = this.getAttribute('src');
    if (!src) return;

    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((source) => {
        this.innerHTML = compile(source);
        bindEvents(this);
      })
      .catch((err) => console.error(`htx-load: failed to load "${src}"`, err));
  }
}

if (typeof customElements !== 'undefined' && !customElements.get('htx-load')) {
  customElements.define('htx-load', HtxLoad);
}

export       { HtxLoad, compile };
export default HtxLoad;
