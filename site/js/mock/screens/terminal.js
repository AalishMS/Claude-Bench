/* A PowerShell tab in Hot garbage running the cat site's Vite dev server. The prompt line takes input:
   Vite's own keys (h, u, r, c, o, q) while it runs, a few canned PowerShell commands after "q". */
(function (S) {
  'use strict';

  const state = S.model.state;
  const esc = S.esc;

  const PS = 'PS E:\\pet_project\\Hot garbage&gt; ';
  const dim = txt => `<span style="color: var(--text-muted);">${txt}</span>`;
  const green = txt => `<span style="color: var(--dot-green);">${txt}</span>`;
  const cyan = txt => `<span style="color: var(--text-code);">${txt}</span>`;
  const bold = txt => `<strong style="color: var(--text-primary);">${txt}</strong>`;

  const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

  const viteBanner = ms => [
    '',
    `  ${green(`${bold('VITE')} v6.3.5`)}  ${dim('ready in')} ${bold(ms)} ${dim('ms')}`,
    '',
    `  ${green('➜')}  ${bold('Local')}:   ${cyan(`http://localhost:${bold('5173')}/`)}`,
    `  ${green('➜')}  ${dim(`${bold('Network')}: use ${bold('--host')} to expose`)}`,
    `  ${green('➜')}  ${dim(`press ${bold('h + enter')} to show help`)}`,
  ];

  const viteLog = (time, what) => `${dim(time)} ${cyan('[vite]')} ${dim('(client)')} ${what}`;

  /* What the tab showed before the visitor typed anything. */
  const START = [
    `${PS}npm run dev`,
    '',
    '&gt; cat-site@0.0.0 dev',
    '&gt; vite',
    ...viteBanner('312'),
    viteLog('10:41:52 PM', `${green('hmr update')} ${dim('/src/style.css')}`),
    viteLog('10:42:13 PM', `${green('hmr update')} ${dim('/src/components/CatCard.jsx')}`),
    viteLog('10:42:30 PM', `${green('page reload')} ${dim('index.html')}`),
  ];

  const VITE_HELP = [
    '',
    `  ${bold('Shortcuts')}`,
    dim(`  press ${bold('r + enter')} to restart the server`),
    dim(`  press ${bold('u + enter')} to show server url`),
    dim(`  press ${bold('o + enter')} to open in browser`),
    dim(`  press ${bold('c + enter')} to clear console`),
    dim(`  press ${bold('q + enter')} to quit`),
  ];

  const LS = [
    '',
    '    Directory: E:\\pet_project\\Hot garbage',
    '',
    'Mode                 LastWriteTime         Length Name',
    '----                 -------------         ------ ----',
    'd----          14/10/2026    22:31                node_modules',
    'd----          14/10/2026    22:40                src',
    '-a---          14/10/2026    22:12            412 index.html',
    '-a---          14/10/2026    22:12            547 package.json',
    '-a---          14/10/2026    22:12            198 vite.config.js',
    '',
  ];

  /* Runs one typed line: returns the lines to print and updates state (Vite running, cleared screen). */
  function run(input) {
    const cmd = input.trim();
    const lower = cmd.toLowerCase();
    const clear = () => { state.shellLog = []; state.shellCleared = true; return null; };

    if (state.viteRunning) {
      if (lower === 'h') return VITE_HELP;
      if (lower === 'u') return viteBanner('312').slice(3, 5);
      if (lower === 'r') return [viteLog(clock(), green('server restarted.'))];
      if (lower === 'o') return [dim('  (In Stanza this opens http://localhost:5173/ in your browser.)')];
      if (lower === 'c') return clear();
      if (lower === 'q') { state.viteRunning = false; return []; }
      return []; // Vite ignores other input
    }

    if (lower === 'npm run dev' || lower === 'npx vite' || lower === 'vite') {
      state.viteRunning = true;
      return ['', '&gt; cat-site@0.0.0 dev', '&gt; vite', ...viteBanner('288')];
    }
    if (lower === 'cls' || lower === 'clear') return clear();
    if (lower === 'ls' || lower === 'dir' || lower === 'gci') return LS;
    if (lower.startsWith('git')) return ['fatal: not a git repository (or any of the parent directories): .git'];
    if (lower === 'claude') return [dim('In Stanza, Claude gets its own tab: Ctrl+T, or the + in the sidebar.')];
    if (!cmd) return [];
    return [dim(`This is a demo, so nothing ran. In Stanza, "${esc(cmd)}" runs in a real PowerShell.`)];
  }

  function screen(ctx) {
    const live = ctx.live;
    const running = !live || state.viteRunning;
    const start = live && state.shellCleared ? [] : START;
    const log = live ? state.shellLog.flatMap(entry => [`${entry.prompt}${esc(entry.input)}`, ...entry.out]) : [];
    const lines = [...start, ...log].map(line => `<div class="whitespace-pre min-h-[1.42em]">${line}</div>`).join('');
    const prompt = running ? '' : PS;

    return `
      <main data-autoscroll class="flex-1 min-w-0 px-4 pt-3 pb-3 mono leading-[1.42] overflow-y-auto" style="background: var(--bg-main); color: var(--text-secondary); font-size: var(--stanza-term-size);">
        ${lines}
        <div class="flex items-center whitespace-pre">
          <span>${prompt}</span>
          ${live ? `
            <input
              type="text"
              data-field="shell"
              placeholder="${running ? 'h + Enter shows Vite\'s keys, q + Enter stops it' : 'Try ls, git status or npm run dev'}"
              aria-label="Type into the terminal"
              class="bg-transparent border-none outline-none flex-1 mono placeholder:opacity-40"
              style="color: var(--text-primary); font-size: var(--stanza-term-size);"
            />
          ` : '<span class="inline-block w-2 h-3.5 bg-current term-cursor"></span>'}
        </div>
      </main>
    `;
  }

  S.mock.screens.terminal = screen;
  S.mock.shell = { run, prompt: () => (state.viteRunning ? '' : PS) };
})(window.Stanza);
