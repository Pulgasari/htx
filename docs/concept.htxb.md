# concept: htxb (htx bundle)

an idea, not a plan. nothing here is built yet.

many htx and html files in one file, the way an epub is html in a zip. a page
that uses 30 parts loads one bundle instead of 30 files.

## prior art

epub, docx, jar and apk are zip files with rules about what goes where. a zip is
less magic than it looks: every file has a small header followed by its bytes,
mostly compressed with deflate. at the end sits a central directory with the
name, offset and size of every file, so a reader can pick a single file without
unpacking the rest.

## two formats

### 1. text container

a plain text file with markers between the files:

```html
<!-- htx-file: elements.input.htx.html -->
<fieldset>…</fieldset>

<!-- htx-file: elements.btn.htx.html -->
<fieldset>…</fieldset>
```

- no compression of its own: http already serves text with gzip or brotli
- readable and diffable, and `cat` can build one
- the marker fits the idea of a first-line comment for the kind of file
  (`<!-- htx: part -->`, `<!-- htx: element card-item -->`,
  `<!-- htx: view /settings -->`, see `packages/elements/README.md`)
- text only, no images or fonts

### 2. zip

- every tool opens it, and binary assets fit in
- the browser needs a small reader: parse the central directory by hand and
  inflate each entry with the built-in `DecompressionStream('deflate-raw')`.
  a few dozen lines, no jszip
- node has zip libraries anyway

**preference**: the text container for htx and html only, zip once assets come
along.

## in the browser

unpacking is cheap. caching is the real question.

**pro**

- one request instead of 30. this matters on http/1.1 and on mobile networks,
  much less on http/2 and http/3, where many small files are cheap

**contra**

- one changed file invalidates the whole bundle

**ways around it**

- a hash in the name (`elements.3f9a.htxb`), served as `immutable`. an index
  file or the importmap points to the current hash
- a service worker unpacks the bundle into the cache api and serves every file
  under its own url. the rest of the code never knows a bundle was involved
  (offline included)

## in `@htx/elements`

`load()` already caches per url. a file in a bundle could get a url of its own:

```html
<htx-part src="./elements.htxb#input"></htx-part>
```

- the first part fetches the bundle once, splits it and fills the existing
  cache. every other part is a cache hit
- dependencies between files of one bundle resolve without a request, which
  makes the dependency pass of `load()` cheaper

## relation to ota (zugriff)

the ota zip of zugriff (`.github/workflows/ota-publish.yml`) is already a bundle
of a whole app, unpacked by `@capgo/capacitor-updater`. htxb is the same
principle for parts instead of apps.

## verdict

- node: trivial
- browser: doable, the effort lies in caching
- worth it for offline use and capacitor apps. for the plain web on http/2, less
  than one would think

## open questions

- the name of a file inside a bundle: `bundle#name`, `bundle#name.htx.html` or a
  path (`bundle/name`)?
- one compile per file, or the whole bundle compiled into one module?
- how does a bundle get built: a cli in `@htx/compiler`, a deno task, or by hand?
- does a bundle need a manifest (version, list of files, kinds), or is the
  marker comment enough?
