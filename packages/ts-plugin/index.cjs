// @htx/ts-plugin
// tsserver loads plugins with require(). the source is esm (src/) and bundled
// with @htx/analyzer into dist/plugin.cjs by `npm run build`.

module.exports = require('./dist/plugin.cjs').default;
