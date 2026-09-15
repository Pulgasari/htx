# todo

- ich hab repo bzw. projekt soeben in `htx` umbenannt
- `<tmpl>` bleibt das hauseigene tag zur definition.
- aber das hauseigene root-elememt wird zu `<script type='htx'>...</script>` (für browser) und alternativ `<htx>...</htx>` in umgebungen wie node, deno usw.

---

- [x] methode für alternativen ``htx`<tag>...</tag>`` template syntax
  - kern-problem war: `compile()`/`expand()` liefen komplett auf echten DOM-nodes (`document.createElement`, `querySelectorAll`, `replaceWith`, ...) — ohne DOM (node/deno, tagged-template) ging das gar nicht.
  - umgesetzt: `compile()` von DOM entkoppelt, dritte variante à la "core + template-tag + pure":
    - `lib/core.js` — der eigentliche DOM-freie pipeline-kern. baut statt eines echten `<div>` einen eigenen kleinen tree (`{tag, attrs, children}`), läuft `collectDefs`/`expand` dagegen und serialisiert am ende zu string. braucht `document` an keiner stelle mehr, läuft 1:1 in browser/node/deno. mit plain `node` durchgetestet (siehe test-batterie unten) — kein DOM-shim nötig, passt zur "tiny, zero-deps"-linie.
    - `lib/tag.js` — die neue tagged-template-variante: `` htx`<div>...</div>` `` als dünner wrapper um `core.compile()`. genau der hier gesuchte alternative syntax, läuft überall wo `core.js` läuft.
    - `lib/htx.js` — die "pure"/browser-variante bleibt öffentlich unverändert (`compile`, `render`, `autoInit`), macht jetzt aber nur noch das browser-only mounten (`render`/`autoInit`) + event-binding; `compile` kommt 1:1 aus `core.js`.
  - dabei einen echten bug gefunden und gefixt: der alte DOM-serializer hat `"` und `&` in attribut-werten nie escaped (browser machen das automatisch bei `innerHTML`) — der neue string-serializer in `core.js` tat das anfangs auch nicht, ist jetzt nachgezogen (`escapeAttr` beim serialisieren), sonst brechen attribute wie `onclick='alert("hi")'`.
  - offen/klein: das `<htx>...</htx>`-datei-wrapper-format aus der intro-notiz (für `.htx`-dateien in node/deno) ist jetzt trivial nachzuziehen — nur noch ein dünner loader, der den äußeren `<htx>`/`</htx>`-string abschneidet und an `core.compile()` gibt. noch nicht gebaut, aber kein architektur-blocker mehr.
- [ ] klären, wie man es generell mit JS macht. also zwischen den tags. oder htx-code in JS. component-like zeug usw.
  - getestet (playwright): natives `<script>` zwischen htx-tags landet unverändert im output (steht in `STANDARD_TAGS`, wird nicht angefasst) — pass-through funktioniert grundsätzlich.
  - bug/falle gefunden: ein `<script>...</script>` **innerhalb** des `<script type='htx'>`-wrappers bricht den browser-parser — der browser beendet das äußere script-element beim ersten literalen `</script>`, egal was im `type`-attribut steht. alles danach landet als rohes, unverarbeitetes markup direkt im dokument statt in der htx-pipeline (getestet: nachfolgende tags fielen raus, `</#app>` wurde zum kommentar). → inline-`<script>` kann nicht in den `type='htx'`-block geschachtelt werden.
  - workaround/konsequenz: kleine JS-snippets über das schon vorhandene `on:event={...}` lösen; größere scripts als eigene, normale `<script>`-tags außerhalb des htx-blocks halten (stellen globale funktionen bereit, die dann per `on:click={meineFunktion()}` aufgerufen werden).
  - "htx-code in JS" (tagged-template ``htx`<div>...</div>` ``): einfach ein dünner wrapper um `compile()` — kein neuer mechanismus nötig, ergibt sich aus punkt 1 (sobald `compile()` DOM-frei ist, läuft der wrapper überall).
  - "component-like zeug": braucht kein neues konzept — es gibt schon zwei ebenen: (1) `<tmpl tag='...'>` als reines markup-component, aktuell nur inline definierbar, ließe sich leicht per `defineTag(name, def)`-JS-API direkt in die registry schreiben, die `collectDefs()` sonst aus dem markup baut; (2) echte web components (tag mit `-`) für alles mit eigenem zustand/lifecycle — laufen schon heute unangetastet durch (`tag.includes('-')`). sinnvoller nächster schritt wäre nur (1) zu ergänzen, kein komplett neues system.

---

- [x] `/lib2` — zweiter ansatz: htx via webcomponents als rahmen/engine
  - vokabular: `<htx-root>` (engine-host statt `<script type='htx'>` + `autoInit()`), `<htx-tag>` (ex-`<tmpl is=...>`-mapping), `<htx-template>` (ex-`<tmpl>`-vollform), `<htx-use>`/`<htx-pkg>` bewusst noch nicht gebaut (laut notiz "später", für import/export).
  - neues syntax-sugar: `tag:value` / `tag:'value'` direkt am tagnamen ist eine zweite form des schon vorhandenen 1-positional-arg-sugars (`<tag 'value'>` -> `$attr="value"`) — `<htx-tag:btn ...>` und `<htx-tag:'btn' ...>` sind exakt gleichwertig (verifiziert: identischer compile-output). läuft als eigener pre-pass vor `preParse()`, weil dessen tag-scanner `:` nicht als namenszeichen kennt.
  - architektur-erkenntnis (direkt aus dem `<script>`-nesting-fund von letztem mal übertragen): `<htx-root>` kann sein DSL nicht als literale light-dom-children halten — der browser-HTML-parser würde `.class`/`'positional'`/`on:click={}` zerlegen, bevor JS drankommt. lösung: `<htx-root>` erwartet genau ein verschachteltes `<script>` (typ egal, empfohlen `text/plain` — kollidiert dann nicht mit lib's `autoInit()`-scan) als roh-text-träger, liest dessen `textContent` in `connectedCallback()` und ersetzt sich selbst mit dem compilierten ergebnis.
  - implementiert: `lib2/core.js` (colon-sugar-preprocessor + `htx-tag`/`htx-template`-collectDefs, sonst identischer tree/expand/serialize-kern — dafür `parse`/`serialize`/`expand`/`getAttr` aus `lib/core.js` zusätzlich exportiert, keine duplizierte tree-logik), `lib2/root.js` (die `<htx-root>`-webcomponent), `lib2/tag.js` (tagged-template-variante für dieses vokabular, wie erwartet ein simpler wrapper um `lib2/core.js`).
  - getestet: `lib2/core.js` direkt unter plain node (mapping/template/colon-sugar/fallback-`tag=`-attribut/normale shorthand — alles korrekt), `<htx-root>` per playwright im echten browser (zwei unabhängige instanzen auf einer seite, event-binding via synthetischem klick verifiziert, `data-on-*` wird nach dem binden entfernt wie bei `lib/htx.js`).
  - `<htx-load src>` ergänzt: fetcht eine `.htx`- oder `.html`-datei, compiliert sie durch den gleichen `lib2/core.js`-kern und ersetzt sich selbst mit dem ergebnis — kein `mode`-attribut nötig, plain html läuft unverändert durch `compile()`. event-binding (`bindEvents`) aus `root.js` in ein gemeinsames `lib2/events.js` gezogen, damit's nicht doppelt existiert.
  - getestet (playwright, echter fetch über lokalen server): `.htx`-fragment inkl. eigenem `<htx-tag>` und colon-sugar lädt korrekt, verschachteltes `<htx-load>` drin lädt rekursiv ein plain-`.html`-fragment nach (composition funktioniert einfach so, weil neu eingefügte `<htx-load>`-tags automatisch hochgestuft werden), event-binding im geladenen fragment funktioniert; fehlende datei wird über `console.error` gemeldet statt eines uncaught errors.

---

- [x] prüfen ob das zeug in `/lib` jetzt noch irgendwie angepasst werden muss wegen umbenennung
  - `lib/htx.js`: `autoInit()` hat noch nach `script[type="tmpl"]` gesucht statt `type="htx"` — gefixt.
  - fehlermeldungen (`tmpl: ...`) und kommentare in `lib/*.js` liefen noch auf den alten namen — gefixt.
  - `index.html` und `aufbau.html` importierten noch `./lib/tmpl.js` (existiert nicht mehr, nur `htx.js`) und nutzten `type="tmpl"`/`text/tmpl` als root-script-type — war dadurch komplett kaputt (playground lud nicht). gefixt, `tmpl.css` zu `htx.css` umbenannt, branding/links auf `htx` angepasst.
- [x] prüfen ob das ganze syntax-zeug, dass in der `README.md` geteasert wird, bereits eingebaut ist.
  - per playwright/chromium live getestet: native tags, webcomponents-passthrough, undefined-custom-tag-fallback zu div, `#id`/`.class`-shorthand, `<tmpl>`-mapping (inkl. positional-arg via `$attr`), `<tmpl>`-template mit `$name`/`$attr`-substitution und `on:click`-binding funktionieren alle wie beschrieben.
  - bug gefunden: das `pic`-beispiel nutzte `is='image'` — `document.createElement('image')` liefert aber kein echtes `<img>`, sondern ein unknown-element. auf `is='img'` korrigiert.
  - `# ideas`-sektion (conditional classes, key events) ist korrekt als noch nicht gebaut markiert — kein handlungsbedarf.
