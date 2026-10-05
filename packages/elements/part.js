// @htx/elements/part.js
// <htx-part src="./media.htx.html" as="section#media"></htx-part>
//
// loads the file (load.js, through @htx/js), renders its component and puts the
// result where the element stands. `as` wraps it first in an element written as a
// selector, tag#id.class. the data-* of the element are the component's props.
// a part inside a part loads the same way, once it is in the page.

import { load } from './load.js';

// one sheet per file, adopted by the document once
const sheets = new Map;

function adopt (url, css) {
  if (!css || sheets.has(url)) return;
  const sheet = new CSSStyleSheet;
  sheet.replaceSync(css);
  sheets.set(url, sheet);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
}

// section#media.wide -> <section id="media" class="wide">
function wrapper (selector) {
  const [, tag = 'div', rest = ''] = /^([a-z][\w-]*)?(.*)$/i.exec(selector.trim());
  const element = document.createElement(tag);
  for (const [, kind, name] of rest.matchAll(/([#.])([\w-]+)/g)) {
    if (kind === '#') element.id = name;
    else element.classList.add(name);
  }
  return element;
}

// a component of @htx/js returns a node, a fragment, a list, text or nothing
const nodesOf = result => [result].flat(Infinity).filter(item => item != null && item !== false && item !== true);

class HtxPart extends HTMLElement {

  connectedCallback () {
    this.ready ??= this.render();
  }

  async render () {
    const src = this.getAttribute('src');

    try {
      if (!src) throw new Error('[htx] <htx-part> without src');
      const url    = new URL(src, this.baseURI).href;
      const module = await load(url);

      adopt(url, module.style);

      const result = module.default({ ...this.dataset });
      const nodes  = nodesOf(result);
      const as     = this.getAttribute('as');

      let out = nodes;
      if (as) {
        const element = wrapper(as);
        element.append(...nodes);
        out = [element];
      }

      const parent = this.parentNode;
      this.replaceWith(...out);
      parent?.dispatchEvent(new CustomEvent('htx-part', { bubbles: true, detail: { nodes: out, src: url } }));
      return out;
    }
    catch (error) {
      this.setAttribute('failed', '');
      this.textContent = '';
      console.error(error);
      throw error;
    }
  }
}

if (!customElements.get('htx-part')) customElements.define('htx-part', HtxPart);

/** resolves once no part is left to load below root, the ones inside parts included */
async function settled (root = document) {
  for (;;) {
    const parts = [...root.querySelectorAll('htx-part:not([failed])')];
    if (!parts.length) return;
    await Promise.allSettled(parts.map(part => part.ready ?? customElements.whenDefined('htx-part')));
  }
}

export { HtxPart, settled };
