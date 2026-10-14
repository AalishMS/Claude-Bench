/* Theme, accent color and terminal text size. The page and every mock window share all three. */
(function (S) {
  'use strict';

  const root = document.documentElement;
  const state = S.model.state;
  const THEME_KEY = 'stanza-theme';

  const themeButton = S.$('#theme-btn');
  const themeLabel = S.$('#theme-label');
  const themeColor = S.$('meta[name="theme-color"]');
  const accentPills = S.$$('[data-accent]');
  const systemLight = window.matchMedia('(prefers-color-scheme: light)');

  let chosen = null; // only an explicit choice is saved, so the page follows the system until then

  const currentTheme = () => root.dataset.theme;

  function paintTheme(theme) {
    root.dataset.theme = theme;
    themeColor.content = theme === 'light' ? '#ffffff' : '#09090b';
    themeLabel.textContent = theme === 'light' ? 'Light' : 'Dark';
    themeButton.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`);
  }

  function setTheme(theme) {
    chosen = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* storage blocked */ }
    paintTheme(theme);
    S.redraw();
  }

  const toggleTheme = () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark');

  function setAccent(key) {
    state.accentKey = key;
    root.style.setProperty('--stanza-accent', S.model.ACCENTS[key]);
    accentPills.forEach(pill => pill.setAttribute('aria-pressed', String(pill.dataset.accent === key)));
    S.redraw();
  }

  function changeTermSize(delta) {
    state.fontSizePx = Math.max(11, Math.min(18, state.fontSizePx + delta));
    root.style.setProperty('--stanza-term-size', `${state.fontSizePx - 1.5}px`);
    S.redraw();
  }

  function init() {
    try { chosen = localStorage.getItem(THEME_KEY); } catch (e) { /* storage blocked */ }
    paintTheme(currentTheme());

    themeButton.addEventListener('click', toggleTheme);
    systemLight.addEventListener('change', () => {
      if (chosen) return;
      paintTheme(systemLight.matches ? 'light' : 'dark');
      S.redraw();
    });

    accentPills.forEach(pill => {
      pill.style.setProperty('--swatch', S.model.ACCENTS[pill.dataset.accent]);
      pill.addEventListener('click', () => setAccent(pill.dataset.accent));
      pill.setAttribute('aria-pressed', String(pill.dataset.accent === state.accentKey));
    });
  }

  S.appearance = { init, currentTheme, setTheme, toggleTheme, setAccent, changeTermSize };
})(window.Stanza);
