/* The split stage: up to four panes, laid out like the app's split (2 = A|B, 3 = A|(B over C), 4 = 2x2). All four
   are drawn once; the window's data-panes (set by page/quad.js from the scroll position) decides how many show, so
   scrolling never redraws the mock. Pane A has an idle body (alone) and a working one (in a split). */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const model = S.model;

  const muted = txt => `<span style="color: var(--text-muted);">${txt}</span>`;
  const code = txt => `<span style="color: var(--text-code);">${txt}</span>`;
  const green = txt => `<span style="color: var(--dot-green);">${txt}</span>`;
  const spinner = (label, counter) => `
    <div>
      <span data-live-spinner="${label}" style="color: var(--text-computing);">${model.spinnerText(label)}</span>
      <span data-live-counter="${counter}" style="color: var(--text-muted);">${model.counterText(counter)}</span>
    </div>
  `;

  function pane(i, { title, project, working, body }) {
    return `
      <section class="qp-pane" data-q="${i}">
        <div class="qp-head h-[26px] px-2.5 flex items-center border-b shrink-0" style="border-color: var(--border-color);">
          <span class="flex items-center gap-1.5 text-[11px] min-w-0" style="color: var(--text-primary);">
            <span class="w-1.5 h-1.5 rounded-full shrink-0 ${working ? 'dot-working-pulse' : ''}" style="background: ${working ? 'var(--dot-amber)' : 'var(--dot-green)'};"></span>
            <span class="truncate">${title}</span>
            <span class="shrink-0" style="color: var(--text-muted);">· ${project}</span>
          </span>
        </div>
        <div class="qp-body flex-1 flex flex-col justify-between p-3 mono text-[11px] leading-[1.42] overflow-hidden">${body}</div>
      </section>
    `;
  }

  function screen() {
    const a = `
      <div class="qp-idle">
        <div class="flex items-center gap-3 pl-1">
          ${ICONS.claudeCrab}
          <div class="leading-[1.38]">
            <div><span class="font-bold">Claude Code</span> ${muted('v2.1.296')}</div>
            <div>${muted('Haiku 5.5 with high effort · Claude Team')}</div>
            <div>${muted('E:\\pet_project\\Claude Terminal')}</div>
          </div>
        </div>
      </div>
      <div class="qp-work space-y-2">
        <div class="px-1.5 py-0.5" style="background: var(--bg-prompt-bar);">&gt; Read every file under src/ and test/, then a one-paragraph summary per folder. Read only.</div>
        <div class="pl-1">● Reading <strong>src\\renderer.js</strong></div>
        <div class="pl-4">${muted('⎿ &nbsp;src\\lib\\ui.js · src\\lib\\parse.js · src\\lib\\md.js')}</div>
        ${spinner('Enchanting', 'split1')}
      </div>
      ${S.mock.splitPrompt('esc to interrupt', false)}
    `;

    const b = `
      <div class="space-y-2">
        <div class="px-1.5 py-0.5" style="background: var(--bg-prompt-bar);">&gt; Read lib/ and test/ one file at a time, then a summary per folder.</div>
        <div>● Counting files per folder under lib and test</div>
        <div class="pl-4">${muted('⎿ &nbsp;lib total: 143 · test total: 61')}</div>
        <div>● 2 agents launched</div>
        <div class="pl-4 whitespace-nowrap">${muted('⎿ &nbsp;code-scout(Read lib/ in order) · 38 tool uses')}</div>
        ${spinner('Kerfuffling', 'split2')}
      </div>
      ${S.mock.splitPrompt('esc to interrupt', false)}
    `;

    const c = `
      <div class="whitespace-nowrap">
        <div>PS E:\\pet_project\\Hot garbage&gt; npm run dev</div>
        <div class="mt-2">&nbsp;&nbsp;${green('<strong>VITE</strong> v6.3.5')}&nbsp;&nbsp;${muted('ready in')} <strong>312</strong> ${muted('ms')}</div>
        <div class="mt-2">&nbsp;&nbsp;${green('➜')}&nbsp;&nbsp;<strong>Local</strong>:&nbsp;&nbsp;&nbsp;${code('http://localhost:<strong>5173</strong>/')}</div>
        <div>&nbsp;&nbsp;${green('➜')}&nbsp;&nbsp;${muted('press <strong>h + enter</strong> to show help')}</div>
        <div class="mt-2">${muted('10:42:13 PM')} ${code('[vite]')} ${green('hmr update')} ${muted('/src/components/CatCard.jsx')}</div>
        <div>${muted('10:42:30 PM')} ${code('[vite]')} ${green('page reload')} ${muted('index.html')}</div>
      </div>
      <div class="pt-2">&nbsp;</div>
    `;

    const d = `
      <div class="space-y-2">
        <div class="px-1.5 py-0.5" style="background: var(--bg-prompt-bar);">&gt; Sort the screenshots on my Desktop into folders by month. Ask before deleting anything.</div>
        <div>● Bash(Get-ChildItem ~\\Desktop -Filter *.png)</div>
        <div class="pl-4">${muted('⎿ &nbsp;2026-08: 41 · 2026-09: 63 · 2026-10: 18')}</div>
        <div>● Three folders, 122 files to move. Nothing gets deleted.</div>
        ${spinner('Herding', 'main')}
      </div>
      ${S.mock.splitPrompt('esc to interrupt', true)}
    `;

    return `
      <main class="qgrid flex-1 grid relative overflow-hidden">
        ${pane(0, { title: 'File summaries for src and test', project: 'Claude Terminal', working: true, body: a })}
        ${pane(1, { title: 'Project layout and summaries', project: 'gymapp-offline', working: true, body: b })}
        ${pane(2, { title: 'PowerShell', project: 'Hot garbage', working: false, body: c })}
        ${pane(3, { title: 'Desktop screenshots', project: 'Chats', working: true, body: d })}
      </main>
    `;
  }

  S.mock.screens.quad = screen;
})(window.Stanza);
