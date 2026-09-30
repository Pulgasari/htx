// @htx/compiler/register
// the node hooks with the default options (the preact adapter):
//
//   node --import @htx/compiler/register app.js

import { register } from 'node:module';

register('./node.js', import.meta.url);
