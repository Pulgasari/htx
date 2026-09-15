// tag.js — tagged-template entry point for the lib2 engine (htx-tag /
// htx-template / colon-sugar vocabulary): htx`<div>...</div>` -> html
// string. Same idea as lib/tag.js, just wrapping lib2/core.js's compile().

import { compile } from './core.js';

function htx (strings, ...values) {
  return compile(String.raw({ raw: strings }, ...values));
}

export       { htx };
export default htx;
