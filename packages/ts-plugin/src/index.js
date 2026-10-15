// @htx/ts-plugin
// a typescript server plugin for htx templates in javascript and typescript:
// diagnostics, completion, hover and definition inside html`…`, with the
// syntax, the html.define() registry and custom-elements.json manifests.
// it runs wherever tsserver runs, so in every editor that uses typescript.
//
//   // jsconfig.json or tsconfig.json
//   { "compilerOptions": { "plugins": [{ "name": "@htx/ts-plugin" }] } }
//
// options, all optional:
//   tags        names of the template tags, default ['html', 'htx']
//   manifests   extra custom-elements.json paths, relative to the project
//   checkHoles  compare the types in ${…} with what their place expects, default true

import { createService } from './service.js';

const DEFAULTS = { checkHoles: true, manifests: [], tags: ['html', 'htx'] };

function init ({ typescript: ts }) {
  let config = { ...DEFAULTS };

  return {
    create (info) {
      config = { ...DEFAULTS, ...info.config };
      const wrapped = createService(ts, info, () => config);

      // every method of the service passes through, the wrapped ones answer first
      const proxy = Object.create(null);
      for (const key of Object.keys(info.languageService)) proxy[key] = (...args) => info.languageService[key](...args);
      Object.assign(proxy, wrapped);

      info.project.projectService.logger.info('[htx] plugin loaded');
      return proxy;
    },

    onConfigurationChanged (next) {
      config = { ...DEFAULTS, ...next };
    },
  };
}

export default init;
