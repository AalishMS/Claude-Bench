/* A single Claude Code session: the finished answer. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const model = S.model;
  const state = model.state;
  const esc = S.esc;

  function screen(ctx, theme) {
    const autoModeText = model.autoModeText();
    const c = (txt) => `<span style="color: var(--text-code);">${txt}</span>`;
    const extraRepliesHtml = state.customPromptHistory.map(entry => `
      <div class="mt-3 px-1.5 py-0.5" style="background: var(--bg-prompt-bar);">&gt; ${esc(entry.prompt)}</div>
      <div class="mt-1.5">● ${esc(entry.reply)}</div>
    `).join('');

    return `
      <main class="flex-1 flex flex-col justify-between px-4 pt-4 pb-2 mono leading-[1.46] overflow-y-auto" style="background: var(--bg-main); color: var(--text-primary); font-size: var(--stanza-term-size);">
        <div class="pr-2">
          <div class="flex items-center gap-3.5 mb-4 pl-2">
            ${ICONS.claudeCrab}
            <div class="leading-[1.38]">
              <div><span class="font-bold">Claude Code</span> <span style="color: var(--text-muted);">v2.1.296</span></div>
              <div style="color: var(--text-muted);">Haiku 5.5 with high effort · Claude Team</div>
              <div style="color: var(--text-muted);">E:\\pet_project\\Claude Terminal</div>
            </div>
          </div>

          <div class="px-1.5 py-0.5 mb-2.5" style="background: var(--bg-prompt-bar);">
            &gt; Give me a quick overview of this project in 6 bullets with file:line references. Read only, no edits.
          </div>

          <div class="pl-3.5 mb-2.5" style="color: var(--text-muted);">
            Searched for <strong style="color: var(--text-primary);">7</strong> patterns, ran <strong style="color: var(--text-primary);">1</strong> shell command
          </div>

          <div class="space-y-1">
            <div>
              ● - <strong>What it is:</strong> Stanza is an Electron desktop wrapper around the real ${c('claude')} CLI. Each tab is a genuine Claude Code session, and the app adds only a project sidebar, tabs, live git status and a running-servers panel. Windows first, macOS best effort (${c('package.json:3')}, ${c('CLAUDE.md')} Architecture section).
            </div>
            <div class="pl-2">
              - <strong>Main process:</strong> ${c('src/main.js')} (1,524 lines) owns the window, ptys, git and port polling, persistence and IPC. ${c('createWindow')} is at ${c('main.js:1165')}, and the window uses ${c('contextIsolation: true')} and ${c('sandbox: true')} (${c('main.js:1183-1185')}).
            </div>
            <div class="pl-2">
              - <strong>Renderer and bridge:</strong> ${c('src/renderer.js')} (3,169 lines) is all the UI as a plain browser script. The ${c('window.api')} bridge is exposed in ${c('src/preload.js:7')}. Key entry points are ${c('renderSidebar')} (${c('renderer.js:1611')}), ${c('pollGit')} (${c(':2911')}), ${c('pollSessions')} (${c(':2938')}), and the ${c('SHORTCUTS')} table (${c(':114')}).
            </div>
            <div class="pl-2">
              - <strong>Sessions:</strong> ${c('createSession')} (${c('main.js:287')}) spawns the pty at ${c(':325')}, after stripping Claude session env vars via ${c('STRIP_ENV')} (${c(':244')}) so a nested ${c('claude')} launch doesn't misbehave.
            </div>
            <div class="pl-2">
              - <strong>Data and polling:</strong> State lives in ${c('%APPDATA%\\stanza\\state.json')} (${c('loadState')} ${c('main.js:96')}, ${c('saveState')} ${c(':115')}). Git status uses ${c('git status --porcelain=v2 --branch')} (${c('main.js:368')}).
            </div>
            <div class="pl-2">
              - <strong>Pure logic, tests, CI:</strong> Parsers with no Electron or fs dependency live in ${c('src/lib/parse.js')} (${c('parseGitStatus')} ${c(':11')}, ${c('parseNetstat')} ${c(':59')}, ${c('parseLsof')} ${c(':76')}), plus ${c('src/lib/ui.js')} and ${c('src/lib/images.js')}. Tests are in ${c('test/*.test.js')} (node:test).
            </div>
          </div>

          <div class="mt-3">I only read files and ran no tests or builds.</div>
          <div class="mt-2.5" style="color: var(--text-muted);">✻ Worked for 22s · done 10:28 PM</div>
          ${extraRepliesHtml}
        </div>

        <div class="pt-3">
          <div class="border-t" style="border-color: var(--border-term-rule);"></div>
          <div class="py-1 flex items-center gap-1.5">
            <span>&gt;</span>
            ${ctx.live ? `
              <input
                type="text"
                placeholder="Type a prompt for Claude Code and press Enter..."
                data-field="prompt"
                class="bg-transparent border-none outline-none flex-1 mono text-[12px] placeholder:opacity-50"
                style="color: var(--text-primary);"
              />
            ` : `<span class="inline-block w-2 h-3.5 bg-current term-cursor"></span>`}
          </div>
          <div class="border-t" style="border-color: var(--border-term-rule);"></div>
          <div class="pt-1.5 pl-3.5 text-[11.5px] flex items-center justify-between">
            <div>
              <span data-act="cycleAutoMode" class="cursor-pointer hover:underline" style="color: var(--text-auto-mode);" title="Click to cycle mode">${autoModeText}</span>
              <span style="color: var(--text-muted);"> (shift+tab to cycle) · ← for agents</span>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens['main'] = screen;
})(window.Stanza);
