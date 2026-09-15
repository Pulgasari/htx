// events.js — shared on:event binding for lib2's web-component runtimes
// (htx-root, htx-load, ...): wires up data-on-* attributes left by
// preParse(), then strips them.

function bindEvents (scope) {
  scope.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (!attr.name.startsWith('data-on-')) continue;

      const type = attr.name.slice('data-on-'.length);
      const body = attr.value;
      el.removeAttribute(attr.name);

      el.addEventListener(type, function (event) {
        // eslint-disable-next-line no-new-func — author-controlled template code
        try         { new Function('event', 'el', body).call(el, event, el); }
        catch (err) { console.error(`htx: error in on:${type} handler`, err); }
      });
    }
  });
}

export       { bindEvents };
export default bindEvents;
