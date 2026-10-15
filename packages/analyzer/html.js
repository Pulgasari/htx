// @htx/analyzer/html.js
// what the analyzer knows about html and svg without a manifest: the tags, the
// global attributes, the attributes of common elements, enumerated values and
// the dom events. names only plus a short line where it helps; the hover links
// to mdn for the rest.

const TAGS = {
  a: 'a hyperlink', abbr: 'an abbreviation', address: 'contact information', area: 'an area of an image map', article: 'a self-contained composition', aside: 'content aside from the main content', audio: 'sound content',
  b: 'bring attention to', base: 'the base url of the document', bdi: 'bidirectional isolate', bdo: 'bidirectional override', blockquote: 'a quotation', body: 'the document body', br: 'a line break', button: 'a button',
  canvas: 'a drawing surface', caption: 'a table caption', cite: 'the title of a work', code: 'a fragment of code', col: 'a table column', colgroup: 'a group of table columns',
  data: 'a value with a machine-readable form', datalist: 'options for an input', dd: 'a description', del: 'deleted text', details: 'a disclosure widget', dfn: 'a definition', dialog: 'a dialog box', div: 'a generic container', dl: 'a description list', dt: 'a term',
  em: 'emphasis', embed: 'embedded content', fieldset: 'a group of form controls', figcaption: 'a figure caption', figure: 'a figure', footer: 'a footer', form: 'a form',
  h1: 'a heading, level 1', h2: 'a heading, level 2', h3: 'a heading, level 3', h4: 'a heading, level 4', h5: 'a heading, level 5', h6: 'a heading, level 6', head: 'document metadata', header: 'a header', hgroup: 'a heading group', hr: 'a thematic break', html: 'the root element',
  i: 'idiomatic text', iframe: 'a nested browsing context', img: 'an image', input: 'a form input', ins: 'inserted text', kbd: 'keyboard input',
  label: 'a caption for a form control', legend: 'a caption for a fieldset', li: 'a list item', link: 'a link to an external resource', main: 'the main content', map: 'an image map', mark: 'highlighted text', menu: 'a list of commands', meta: 'metadata', meter: 'a scalar value in a range',
  nav: 'navigation links', noscript: 'content without scripting', object: 'an external resource', ol: 'an ordered list', optgroup: 'a group of options', option: 'an option', output: 'the result of a calculation',
  p: 'a paragraph', picture: 'sources for an image', pre: 'preformatted text', progress: 'a progress bar', q: 'an inline quotation', rp: 'ruby fallback parenthesis', rt: 'ruby text', ruby: 'a ruby annotation',
  s: 'no longer accurate text', samp: 'sample output', script: 'a script', search: 'a search section', section: 'a section', select: 'a select box', slot: 'a slot in a shadow tree', small: 'side comment', source: 'a media source', span: 'a generic inline container', strong: 'strong importance', style: 'style information', sub: 'subscript', summary: 'a summary for details', sup: 'superscript',
  table: 'a table', tbody: 'a table body', td: 'a table cell', template: 'a template', textarea: 'a multi-line text input', tfoot: 'a table footer', th: 'a table header cell', thead: 'a table head', time: 'a date or time', title: 'the document title', tr: 'a table row', track: 'a text track',
  u: 'unarticulated annotation', ul: 'an unordered list', var: 'a variable', video: 'a video', wbr: 'a line break opportunity',
};

const SVG_TAGS = new Set([
  'animate', 'animateMotion', 'animateTransform', 'circle', 'clipPath', 'defs', 'desc', 'ellipse',
  'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite', 'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feDropShadow', 'feFlood', 'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology', 'feOffset', 'feSpecularLighting', 'feTile', 'feTurbulence',
  'filter', 'foreignObject', 'g', 'image', 'line', 'linearGradient', 'marker', 'mask', 'path', 'pattern', 'polygon', 'polyline', 'radialGradient', 'rect', 'stop', 'svg', 'switch', 'symbol', 'text', 'textPath', 'tspan', 'use', 'view',
]);

const GLOBAL_ATTRIBUTES = [
  'accesskey', 'autocapitalize', 'autofocus', 'class', 'contenteditable', 'dir', 'draggable', 'enterkeyhint', 'hidden', 'id', 'inert', 'inputmode', 'is', 'lang', 'nonce', 'part', 'popover', 'role', 'slot', 'spellcheck', 'style', 'tabindex', 'title', 'translate',
];

const ATTRIBUTES = {
  a        : ['download', 'href', 'hreflang', 'ping', 'referrerpolicy', 'rel', 'target', 'type'],
  area     : ['alt', 'coords', 'download', 'href', 'rel', 'shape', 'target'],
  audio    : ['autoplay', 'controls', 'crossorigin', 'loop', 'muted', 'preload', 'src'],
  base     : ['href', 'target'],
  blockquote: ['cite'],
  button   : ['command', 'commandfor', 'disabled', 'form', 'formaction', 'formmethod', 'formnovalidate', 'formtarget', 'name', 'popovertarget', 'popovertargetaction', 'type', 'value'],
  canvas   : ['height', 'width'],
  col      : ['span'],
  colgroup : ['span'],
  data     : ['value'],
  del      : ['cite', 'datetime'],
  details  : ['name', 'open'],
  dialog   : ['closedby', 'open'],
  embed    : ['height', 'src', 'type', 'width'],
  fieldset : ['disabled', 'form', 'name'],
  form     : ['accept-charset', 'action', 'autocomplete', 'enctype', 'method', 'name', 'novalidate', 'rel', 'target'],
  iframe   : ['allow', 'allowfullscreen', 'height', 'loading', 'name', 'referrerpolicy', 'sandbox', 'src', 'srcdoc', 'width'],
  img      : ['alt', 'crossorigin', 'decoding', 'fetchpriority', 'height', 'ismap', 'loading', 'referrerpolicy', 'sizes', 'src', 'srcset', 'usemap', 'width'],
  input    : ['accept', 'alt', 'autocomplete', 'capture', 'checked', 'dirname', 'disabled', 'form', 'formaction', 'formmethod', 'height', 'list', 'max', 'maxlength', 'min', 'minlength', 'multiple', 'name', 'pattern', 'placeholder', 'popovertarget', 'readonly', 'required', 'size', 'src', 'step', 'type', 'value', 'width'],
  ins      : ['cite', 'datetime'],
  label    : ['for'],
  li       : ['value'],
  link     : ['as', 'crossorigin', 'href', 'hreflang', 'integrity', 'media', 'rel', 'sizes', 'type'],
  meta     : ['charset', 'content', 'http-equiv', 'name'],
  meter    : ['high', 'low', 'max', 'min', 'optimum', 'value'],
  object   : ['data', 'form', 'height', 'name', 'type', 'width'],
  ol       : ['reversed', 'start', 'type'],
  optgroup : ['disabled', 'label'],
  option   : ['disabled', 'label', 'selected', 'value'],
  output   : ['for', 'form', 'name'],
  progress : ['max', 'value'],
  q        : ['cite'],
  script   : ['async', 'crossorigin', 'defer', 'integrity', 'nomodule', 'src', 'type'],
  select   : ['autocomplete', 'disabled', 'form', 'multiple', 'name', 'required', 'size'],
  slot     : ['name'],
  source   : ['height', 'media', 'sizes', 'src', 'srcset', 'type', 'width'],
  style    : ['media'],
  td       : ['colspan', 'headers', 'rowspan'],
  template : ['shadowrootclonable', 'shadowrootdelegatesfocus', 'shadowrootmode'],
  textarea : ['autocomplete', 'cols', 'dirname', 'disabled', 'form', 'maxlength', 'minlength', 'name', 'placeholder', 'readonly', 'required', 'rows', 'value', 'wrap'],
  th       : ['abbr', 'colspan', 'headers', 'rowspan', 'scope'],
  time     : ['datetime'],
  track    : ['default', 'kind', 'label', 'src', 'srclang'],
  video    : ['autoplay', 'controls', 'crossorigin', 'height', 'loop', 'muted', 'playsinline', 'poster', 'preload', 'src', 'width'],
};

// enumerated values, by 'tag.attribute' or by attribute alone
const VALUES = {
  'autocapitalize'      : ['characters', 'none', 'off', 'on', 'sentences', 'words'],
  'button.type'         : ['button', 'reset', 'submit'],
  'contenteditable'     : ['false', 'plaintext-only', 'true'],
  'crossorigin'         : ['anonymous', 'use-credentials'],
  'decoding'            : ['async', 'auto', 'sync'],
  'dir'                 : ['auto', 'ltr', 'rtl'],
  'enterkeyhint'        : ['done', 'enter', 'go', 'next', 'previous', 'search', 'send'],
  'fetchpriority'       : ['auto', 'high', 'low'],
  'form.method'         : ['dialog', 'get', 'post'],
  'input.type'          : ['button', 'checkbox', 'color', 'date', 'datetime-local', 'email', 'file', 'hidden', 'image', 'month', 'number', 'password', 'radio', 'range', 'reset', 'search', 'submit', 'tel', 'text', 'time', 'url', 'week'],
  'inputmode'           : ['decimal', 'email', 'none', 'numeric', 'search', 'tel', 'text', 'url'],
  'loading'             : ['eager', 'lazy'],
  'popover'             : ['auto', 'hint', 'manual'],
  'popovertargetaction' : ['hide', 'show', 'toggle'],
  'preload'             : ['auto', 'metadata', 'none'],
  'target'              : ['_blank', '_parent', '_self', '_top'],
  'textarea.wrap'       : ['hard', 'off', 'soft'],
  'th.scope'            : ['col', 'colgroup', 'row', 'rowgroup'],
  'track.kind'          : ['captions', 'chapters', 'descriptions', 'metadata', 'subtitles'],
};

const EVENTS = [
  'abort', 'animationend', 'animationiteration', 'animationstart', 'auxclick', 'beforeinput', 'beforetoggle', 'blur', 'cancel', 'change', 'click', 'close', 'contextmenu', 'copy', 'cut',
  'dblclick', 'drag', 'dragend', 'dragenter', 'dragleave', 'dragover', 'dragstart', 'drop', 'ended', 'error', 'focus', 'focusin', 'focusout', 'input', 'invalid',
  'keydown', 'keyup', 'load', 'loadeddata', 'loadedmetadata', 'paste', 'pause', 'play', 'playing',
  'pointercancel', 'pointerdown', 'pointerenter', 'pointerleave', 'pointermove', 'pointerout', 'pointerover', 'pointerup',
  'reset', 'resize', 'scroll', 'scrollend', 'select', 'submit', 'timeupdate', 'toggle', 'touchcancel', 'touchend', 'touchmove', 'touchstart', 'transitionend', 'volumechange', 'wheel',
];

// what htx itself understands on every element
const HTX_ATTRIBUTES = {
  '!html' : 'markup written as it is (innerHTML). sanitize anything that is not yours',
  'class:': 'class:name=${bool} adds the class while the value is true',
  'key'   : 'identity of a row, read by keyed renderers, never written to the element',
  'ref'   : 'a function called with the element, or an object whose current is set',
  'style:': 'style:property=${value} sets one css property',
};

const mdn = tag => `https://developer.mozilla.org/docs/Web/HTML/Element/${tag}`;

export { ATTRIBUTES, EVENTS, GLOBAL_ATTRIBUTES, HTX_ATTRIBUTES, SVG_TAGS, TAGS, VALUES, mdn };
