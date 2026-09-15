// tag.js — tagged-template entry point: htx`<div>...</div>` -> html string.
// Thin wrapper around the DOM-free core, so it works the same in the
// browser, node and deno — no mounting, no events, just compile().

import { compile } from './core.js';

function htx (strings, ...values) {
  return compile(String.raw({ raw: strings }, ...values));
}

export       { htx };
export default htx;
