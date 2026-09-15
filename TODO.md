# todo

- ich hab repo bzw. projekt soeben in `htx` umbenannt
- `<tmpl>` bleibt das hauseigene tag zur definition.
- aber das hauseigene root-elememt wird zu `<script type='htx'>...</script>` (für browser) und alternativ `<htx>...</htx>` in umgebungen wie node, deno usw.

---

- [x] prüfen ob das zeug in `/lib` jetzt noch irgendwie angepasst werden muss wegen umbenennung
  - `lib/htx.js`: `autoInit()` hat noch nach `script[type="tmpl"]` gesucht statt `type="htx"` — gefixt.
  - fehlermeldungen (`tmpl: ...`) und kommentare in `lib/*.js` liefen noch auf den alten namen — gefixt.
  - `index.html` und `aufbau.html` importierten noch `./lib/tmpl.js` (existiert nicht mehr, nur `htx.js`) und nutzten `type="tmpl"`/`text/tmpl` als root-script-type — war dadurch komplett kaputt (playground lud nicht). gefixt, `tmpl.css` zu `htx.css` umbenannt, branding/links auf `htx` angepasst.
- [x] prüfen ob das ganze syntax-zeug, dass in der `README.md` geteasert wird, bereits eingebaut ist.
  - per playwright/chromium live getestet: native tags, webcomponents-passthrough, undefined-custom-tag-fallback zu div, `#id`/`.class`-shorthand, `<tmpl>`-mapping (inkl. positional-arg via `$attr`), `<tmpl>`-template mit `$name`/`$attr`-substitution und `on:click`-binding funktionieren alle wie beschrieben.
  - bug gefunden: das `pic`-beispiel nutzte `is='image'` — `document.createElement('image')` liefert aber kein echtes `<img>`, sondern ein unknown-element. auf `is='img'` korrigiert.
  - `# ideas`-sektion (conditional classes, key events) ist korrekt als noch nicht gebaut markiert — kein handlungsbedarf.
