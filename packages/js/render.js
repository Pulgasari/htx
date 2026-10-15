// @htx/js/render

/*
htx syntax rendered by @domina/render: the statics of a template are parsed and
cloned once, later renders write only the holes that changed. the builder in
@htx/js builds new nodes on every call instead; both share the tag registry, so
html.define() on either one is seen by both.

  import { html, render } from '@htx/js/render';

  render(container, html`<p.note>${text}</p>`);
*/

// :::::: IMPORT

import { configure, each, isResult, match, raw, render, tag, unrender, when } from '@domina/render';
import { program }                                                            from '@htx/htx';
import { htx }                                                                from './index.js';

// :::::: TAG

const html = tag(strings => program(strings, htx.tags));

html.define = (...args) => { htx.define(...args); return html; };
html.tags   = htx.tags;

// :::::: EXPORT

export { configure, each, html, isResult, match, raw, render, unrender, when };
export default html;
