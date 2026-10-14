/* Theme, accent and terminal text size of the mock. The accent also colors the page; the page itself stays dark. */
(function (S) {
  'use strict';

  const root = document.documentElement;
  const state = S.model.state;

  function setTheme(theme) {
    state.theme = theme;
    S.redraw();
  }

  const toggleTheme = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');

  function setAccent(key) {
    state.accentKey = key;
    root.style.setProperty('--stanza-accent', S.model.ACCENTS[key]);
    S.redraw();
  }

  function changeTermSize(delta) {
    state.fontSizePx = Math.max(11, Math.min(18, state.fontSizePx + delta));
    root.style.setProperty('--stanza-term-size', `${state.fontSizePx - 1.5}px`);
    S.redraw();
  }

  S.look = { setTheme, toggleTheme, setAccent, changeTermSize };
})(window.Stanza);
