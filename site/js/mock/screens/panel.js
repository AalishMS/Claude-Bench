/* A Claude session running subagents in parallel, given two pasted screenshots: the screen behind the "Side panel"
   tab, where the right sidebar shows the runs (click one for its prompt) and the images (click for the lightbox). */
(function (S) {
  'use strict';

  const model = S.model;

  function screen() {
    const c = txt => `<span style="color: var(--text-code);">${txt}</span>`;
    const muted = txt => `<span style="color: var(--text-muted);">${txt}</span>`;
    const img = n => `<span style="color: var(--text-code);">[Image #${n}]</span>`;
    const live = '<span class="inline-block dot-working-pulse">●</span>';
    const agent = (bullet, type, desc, lines) => `
      <div class="mt-1.5">${bullet} <strong>${type}</strong>(${desc})</div>
      ${lines.map((line, i) => `<div class="pl-3.5">${muted(`${i ? '&nbsp;&nbsp;&nbsp;' : '⎿ &nbsp;'}${line}`)}</div>`).join('')}
    `;

    return `
      <main data-autoscroll class="flex-1 min-w-0 flex flex-col justify-between px-4 pt-4 pb-2 mono leading-[1.42] overflow-y-auto" style="background: var(--bg-main); color: var(--text-primary); font-size: var(--stanza-term-size);">
        <div class="pr-2">
          <div class="px-1.5 py-0.5 mb-2.5" style="background: var(--bg-prompt-bar);">
            &gt; ${img(1)} ${img(2)} At 125 % zoom the sidebar runs under the terminal, and updating shows this error. Find both causes, use subagents in parallel. Also the title bar logo looks blurry. Read only.
          </div>

          <div>● Read(${c('assets/icon.png')})</div>
          <div class="pl-3.5 mb-1.5">${muted('⎿ &nbsp;Read image (31.5KB)')}</div>

          <div class="mb-1">● The logo is a 512 px PNG drawn at 20 px, so that part is just scaling. The other two look independent: I'll send a scout at each, a reviewer at the update script, and Explore at the tests.</div>

          ${agent(live, 'code-scout', 'Find the zoom and sidebar CSS', ['Search(pattern: "--zoom", path: "src")', 'Read(src/styles.css)', '+4 more tool uses'])}
          ${agent(live, 'code-scout', 'Trace the update popover error', ['Read(src/main.js)', '+6 more tool uses'])}
          ${agent(live, 'code-reviewer', 'Review the update path', ['Read(scripts/update.ps1)', '+3 more tool uses'])}
          ${agent('<span style="color: var(--dot-green);">●</span>', 'Explore', 'Map the tests that cover zoom', ['Done (6 tool uses · 18.2k tokens · 41s)'])}

          <div class="mt-3">
            <span data-live-spinner="Orchestrating" style="color: var(--text-computing);">${model.spinnerText('Orchestrating')}</span>
            <span data-live-counter="panel" style="color: var(--text-muted);">${model.counterText('panel')}</span>
          </div>
          <div class="pl-3.5">${muted('⎿ &nbsp;Tip: Use /agents to create and manage your own subagents')}</div>
        </div>

        <div class="pt-3">
          <div class="border-t" style="border-color: var(--border-term-rule);"></div>
          <div class="py-1 flex items-center gap-1.5"><span>&gt;</span><span class="inline-block w-2 h-3.5 bg-current term-cursor"></span></div>
          <div class="border-t" style="border-color: var(--border-term-rule);"></div>
          <div class="pt-1.5 pl-3.5 text-[11.5px]">
            <span data-act="cycleAutoMode" class="cursor-pointer hover:underline" style="color: var(--text-auto-mode);">${model.autoModeText()}</span>
            ${muted(' (shift+tab to cycle) · esc to interrupt · ← for agents')}
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens.panel = screen;
})(window.Stanza);
