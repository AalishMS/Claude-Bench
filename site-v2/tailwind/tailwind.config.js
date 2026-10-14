'use strict';

// Only used to regenerate ../css/tailwind.css (see ../README.md). Not a dependency of the app.
module.exports = {
  content: ['../js/mock/**/*.js'],
  important: '.stanza-root', // utilities only apply inside the mock, so they can't touch the page around it
  corePlugins: { preflight: false }, // css/mock.css has a scoped reset instead
  theme: { extend: {} },
};
