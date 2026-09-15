# todo

- ich hab repo bzw. projekt soeben in `htx` umbenannt
- `<tmpl>` bleibt das hauseigene tag zur definition.
- aber das hauseigene root-elememt wird zu `<script type='htx'>...</script>` (für browser) und alternativ `<htx>...</htx>` in umgebungen wie node, deno usw.

---

- [ ] methode für alternativen ``htx`<tag>...</tag>`` template syntax
  - kern-problem: `compile()`/`expand()` in `lib/htx.js` läuft komplett auf echten DOM-nodes (`document.createElement`, `querySelectorAll`, `replaceWith`, ...) — ohne DOM (node/deno) geht das unabhängig von der root-syntax gar nicht.
  - zwei optionen:
    1. DOM-shim (linkedom/happy-dom) einbinden — code bleibt fast 1:1, aber neue dependency.
    2. `compile()` von DOM entkoppeln: statt in einen echten `<div>` zu rendern, gegen einen kleinen eigenen tree (`{tag, attrs, children}`) laufen lassen und am ende serialisieren. dann braucht `compile()` gar kein DOM mehr und läuft identisch in browser/node/deno. nur `render()`/`bindEvents()`/`autoInit()` bleiben browser-only (brauchen ohnehin echte events).
  - empfehlung: 2., passt zur "tiny, zero-deps"-linie.
  - `<htx>...</htx>` ist dabei nur eine dateikonvention: ein dünner loader liest die datei als string und schneidet den äußeren `<htx>`/`</htx>`-wrapper per string-trim ab, bevor der rest an `compile()` geht — kein HTML-parser involviert.
  - wichtig: `<htx>...</htx>` funktioniert NICHT als live-DOM-root im browser. ein gewöhnliches tag hat keine "raw-text"-parsing-regel wie `<script>`/`<style>`/`<textarea>` — der browser würde shorthand wie `.class`, `'positional'`, `on:click={}` schon beim parsen verhunzen, bevor htx.js überhaupt etwas sieht. daher ist die trennung im intro-text (`<script type='htx'>` für browser, `<htx>` nur für umgebungen ohne HTML-parser) genau richtig so.
- [ ] klären, wie man es generell mit JS macht. also zwischen den tags. oder htx-code in JS. component-like zeug usw.
  - getestet (playwright): natives `<script>` zwischen htx-tags landet unverändert im output (steht in `STANDARD_TAGS`, wird nicht angefasst) — pass-through funktioniert grundsätzlich.
  - bug/falle gefunden: ein `<script>...</script>` **innerhalb** des `<script type='htx'>`-wrappers bricht den browser-parser — der browser beendet das äußere script-element beim ersten literalen `</script>`, egal was im `type`-attribut steht. alles danach landet als rohes, unverarbeitetes markup direkt im dokument statt in der htx-pipeline (getestet: nachfolgende tags fielen raus, `</#app>` wurde zum kommentar). → inline-`<script>` kann nicht in den `type='htx'`-block geschachtelt werden.
  - workaround/konsequenz: kleine JS-snippets über das schon vorhandene `on:event={...}` lösen; größere scripts als eigene, normale `<script>`-tags außerhalb des htx-blocks halten (stellen globale funktionen bereit, die dann per `on:click={meineFunktion()}` aufgerufen werden).
  - "htx-code in JS" (tagged-template ``htx`<div>...</div>` ``): einfach ein dünner wrapper um `compile()` — kein neuer mechanismus nötig, ergibt sich aus punkt 1 (sobald `compile()` DOM-frei ist, läuft der wrapper überall).
  - "component-like zeug": braucht kein neues konzept — es gibt schon zwei ebenen: (1) `<tmpl tag='...'>` als reines markup-component, aktuell nur inline definierbar, ließe sich leicht per `defineTag(name, def)`-JS-API direkt in die registry schreiben, die `collectDefs()` sonst aus dem markup baut; (2) echte web components (tag mit `-`) für alles mit eigenem zustand/lifecycle — laufen schon heute unangetastet durch (`tag.includes('-')`). sinnvoller nächster schritt wäre nur (1) zu ergänzen, kein komplett neues system.

---

- [x] prüfen ob das zeug in `/lib` jetzt noch irgendwie angepasst werden muss wegen umbenennung
  - `lib/htx.js`: `autoInit()` hat noch nach `script[type="tmpl"]` gesucht statt `type="htx"` — gefixt.
  - fehlermeldungen (`tmpl: ...`) und kommentare in `lib/*.js` liefen noch auf den alten namen — gefixt.
  - `index.html` und `aufbau.html` importierten noch `./lib/tmpl.js` (existiert nicht mehr, nur `htx.js`) und nutzten `type="tmpl"`/`text/tmpl` als root-script-type — war dadurch komplett kaputt (playground lud nicht). gefixt, `tmpl.css` zu `htx.css` umbenannt, branding/links auf `htx` angepasst.
- [x] prüfen ob das ganze syntax-zeug, dass in der `README.md` geteasert wird, bereits eingebaut ist.
  - per playwright/chromium live getestet: native tags, webcomponents-passthrough, undefined-custom-tag-fallback zu div, `#id`/`.class`-shorthand, `<tmpl>`-mapping (inkl. positional-arg via `$attr`), `<tmpl>`-template mit `$name`/`$attr`-substitution und `on:click`-binding funktionieren alle wie beschrieben.
  - bug gefunden: das `pic`-beispiel nutzte `is='image'` — `document.createElement('image')` liefert aber kein echtes `<img>`, sondern ein unknown-element. auf `is='img'` korrigiert.
  - `# ideas`-sektion (conditional classes, key events) ist korrekt als noch nicht gebaut markiert — kein handlungsbedarf.
