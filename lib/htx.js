// htx.js — browser runtime ("pure" variant): mounts compiled markup into a
// real DOM and wires up on:event bindings. The actual compile pipeline is
// DOM-free and lives in core.js, so it also runs in node/deno — this file
// is only the browser-specific mounting/event layer on top of it.
//
//   compile(src)         -> html string          (re-exported from core.js)
//   render(src, target)  -> mounts into target and binds events
//   autoInit()           -> processes all <script type="htx"> tags in-place

import { compile } from './core.js';

// :::::: HELPERS

const dom = {};

dom.attrOf = (spec)          => Array.from(spec.attributes),
dom.get    = (spec)          => (typeof spec === 'string') ? document.querySelector(spec) : spec;
dom.each   = (spec, fn)      => document.querySelectorAll(spec).forEach(fn);
dom.create = (tag, props)    => Object.assign(document.createElement(tag ?? 'div'), props);
dom.on     = (el, event, fn) => (el ?? document).addEventListener(event, fn);

// :::::: PUBLIC API

function render (source, target) {
  const el = dom.get(target); if (!el) throw new Error(`htx: mount target not found: ${target}`);
  el.innerHTML = compile(source);
  bindEvents(el);
  return el;
}

// :::::: AUTO-INIT & IN-PLACE REPLACEMENT

function processScriptNode (script) {
  const host = dom.create('div', { innerHTML: compile(script.textContent) });
  bindEvents(host);

  const fragment = document.createDocumentFragment();
  while (host.firstChild) fragment.appendChild(host.firstChild);

  script.replaceWith(fragment);
}

function autoInit () {
  if (typeof document === 'undefined') return;

  const selector = 'script[type="htx"], script[type="text/htx"]';
  dom.each(selector, processScriptNode);
}

// Auto-run on load or immediately if DOM is already ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    dom.on('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }
}

export         { compile, render, autoInit };
export default { compile, render, autoInit };

// :::::: EVENTS

function bindEvents (scope) {
  scope.querySelectorAll('*').forEach((el) => {
    for (const attr of dom.attrOf(el)) {
      if (!attr.name.startsWith('data-on-')) continue;

      const type = attr.name.slice('data-on-'.length);
      const body = attr.value;
      el.removeAttribute(attr.name);

      dom.on(el, type, function (event) {
        // eslint-disable-next-line no-new-func — author-controlled template code
        try         { new Function('event', 'el', body).call(el, event, el); }
        catch (err) { console.error(`htx: error in on:${type} handler`, err); }
      });
    }
  });
}
