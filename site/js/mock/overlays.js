/* What sits on top of a screen: the subagent dialog, the image lightbox and the "Needs input" toast. Also the data
   they share with the side panel: subagent definitions and runs, and the session's images. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;

  /* ~/.claude/agents/*.md: frontmatter model and the prompt body. Explore is built in, so it has no file. */
  const DEFS = {
    'code-scout': {
      model: 'Haiku 5.5',
      file: '~/.claude/agents/code-scout.md',
      body: 'Read-only codebase exploration and search. Use Grep and Glob first, read only the parts that matter, and answer with file:line references. Never edit files.',
    },
    'code-reviewer': {
      model: 'Sonnet 5.5',
      file: '~/.claude/agents/code-reviewer.md',
      body: 'Review the given change for bugs first, then clarity and test coverage. Quote the line, say what breaks and when. No style nits.',
    },
    'deep-debugger': {
      model: 'Opus 5.5',
      file: '~/.claude/agents/deep-debugger.md',
      body: 'For hard problems only: tricky bugs, races, architectural calls. Reproduce first, state the root cause with evidence, then the smallest fix.',
    },
  };

  /* This session's runs (the Side panel screen). used = the run's own context, in k tokens of a 1M window. */
  const RUNS = [
    {
      id: 'scout-zoom', type: 'code-scout', desc: 'Find the zoom and sidebar CSS', model: 'Haiku 5.5', status: 'running', time: '1m 04s', used: 41.8,
      prompt: 'Find the CSS that sizes the left sidebar and the terminal area, and everything that divides by --zoom. List file:line for each. Read only.',
    },
    {
      id: 'scout-update', type: 'code-scout', desc: 'Trace the update popover error', model: 'Haiku 5.5', status: 'running', time: '58s', used: 27.3,
      prompt: 'The update popover shows "local changes would be overwritten" for package-lock.json. Trace where applyUpdate runs git and what resets the lockfile first. Read only.',
    },
    {
      id: 'review-update', type: 'code-reviewer', desc: 'Review the update path', model: 'Sonnet 5.5', status: 'running', time: '52s', used: 63.5,
      prompt: 'Review applyUpdate and scripts/update.ps1 for any way a dirty package-lock.json can still make git pull abort.',
    },
    {
      id: 'explore-tests', type: 'Explore', desc: 'Map the tests that cover zoom', model: 'Haiku 5.5', status: 'done', time: '41s', used: 18.2,
      prompt: 'Which tests in test/ touch zoom, overlay height or the sidebar width? Quick, medium breadth.',
    },
  ];

  const definitionRow = (type, id = `def:${type}`) => ({ id, type, desc: '', model: DEFS[type].model, status: 'idle' });

  /* The Subagents section: on the Side panel screen, this session's runs and the idle definitions; elsewhere just
     the definitions. Running runs are a row each; a type that ran is not repeated as an idle row. */
  function subagentRows(screen) {
    if (screen !== 'panel') return ['code-reviewer', 'code-scout', 'deep-debugger'].map(type => definitionRow(type));
    return [...RUNS, definitionRow('deep-debugger')];
  }

  const findAgent = id => RUNS.find(run => run.id === id) || (id.startsWith('def:') && DEFS[id.slice(4)] ? definitionRow(id.slice(4), id) : null);

  /* The session's images, drawn as small SVG "screenshots" so the page makes no requests. #3 came from the Read tool. */
  const shot = inner => `<svg viewBox="0 0 320 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="display: block;">${inner}</svg>`;
  const IMAGES = [
    {
      id: '1', label: '#1', source: 'Pasted image',
      // The app at 125 % zoom: the sidebar runs under the terminal
      html: shot(`
        <rect width="320" height="200" fill="#0a0a0a"/>
        <rect width="320" height="16" fill="#030303"/><rect x="8" y="5" width="6" height="6" rx="1.5" fill="#fafafa"/><rect x="18" y="6" width="28" height="4" rx="2" fill="#a1a1a1"/>
        <g fill="#3f3f46"><rect x="96" y="30" width="170" height="5" rx="2"/><rect x="96" y="42" width="196" height="5" rx="2"/><rect x="96" y="54" width="150" height="5" rx="2"/></g>
        <g fill="#60a5fa"><rect x="96" y="74" width="60" height="5" rx="2"/><rect x="96" y="98" width="44" height="5" rx="2"/></g>
        <g fill="#d4d4d8"><rect x="162" y="74" width="110" height="5" rx="2"/><rect x="96" y="86" width="186" height="5" rx="2"/><rect x="146" y="98" width="120" height="5" rx="2"/><rect x="96" y="110" width="160" height="5" rx="2"/></g>
        <rect x="0" y="16" width="122" height="184" fill="#030303" fill-opacity="0.94"/>
        <g fill="#52525b"><rect x="12" y="30" width="70" height="5" rx="2"/><rect x="20" y="44" width="80" height="5" rx="2"/><rect x="20" y="56" width="64" height="5" rx="2"/><rect x="20" y="68" width="88" height="5" rx="2"/><rect x="12" y="88" width="60" height="5" rx="2"/><rect x="20" y="102" width="76" height="5" rx="2"/></g>
        <rect x="86" y="22" width="44" height="100" rx="3" fill="none" stroke="#ef4444" stroke-width="2" stroke-dasharray="5 3"/>
        <rect x="0" y="182" width="320" height="18" fill="#030303"/><rect x="132" y="188" width="70" height="5" rx="2" fill="#52525b"/>
      `),
    },
    {
      id: '2', label: '#2', source: 'Pasted image',
      // The update popover's error
      html: shot(`
        <rect width="320" height="200" fill="#0a0a0a"/>
        <rect x="0" y="0" width="80" height="200" fill="#030303"/>
        <g fill="#27272a"><rect x="10" y="20" width="50" height="5" rx="2"/><rect x="10" y="34" width="58" height="5" rx="2"/><rect x="10" y="48" width="44" height="5" rx="2"/></g>
        <rect x="20" y="62" width="250" height="116" rx="8" fill="#171717" stroke="#262626"/>
        <circle cx="38" cy="82" r="7" fill="#ef4444"/><path d="M35 79l6 6M41 79l-6 6" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
        <text x="52" y="86" fill="#fafafa" font-family="system-ui, sans-serif" font-size="11" font-weight="600">Update failed</text>
        <text x="32" y="108" fill="#a1a1a1" font-family="ui-monospace, monospace" font-size="7.6">error: Your local changes to the following</text>
        <text x="32" y="119" fill="#a1a1a1" font-family="ui-monospace, monospace" font-size="7.6">files would be overwritten by merge:</text>
        <text x="40" y="132" fill="#fca5a5" font-family="ui-monospace, monospace" font-size="7.6">package-lock.json</text>
        <rect x="196" y="150" width="62" height="18" rx="5" fill="#262626"/><text x="227" y="162" fill="#fafafa" font-family="system-ui, sans-serif" font-size="8" text-anchor="middle">Close</text>
      `),
    },
    {
      id: '3', label: '#3', source: 'Read · assets/icon.png',
      html: `<div class="w-full h-full flex items-center justify-center" style="background: #18181b;"><img src="assets/icon.png" alt="" draggable="false" style="height: 72%; width: auto; border-radius: 22%;"></div>`,
    },
  ];

  const findImage = id => IMAGES.find(image => image.id === id);

  function contextBar(used) {
    const pct = Math.max(1, Math.round(used / 10));
    return `
      <div class="flex items-center justify-between text-[11px]">
        <span class="font-medium" style="color: var(--text-secondary);">Context</span>
        <span class="mono text-[10.5px]" style="color: var(--text-muted);">${used.toFixed(1)}k / 1M · ${pct}%</span>
      </div>
      <div class="w-full h-[4px] rounded-full mt-1.5 overflow-hidden" style="background: var(--track-bg);">
        <div class="h-full rounded-full" style="width: ${pct}%; background: var(--accent-violet);"></div>
      </div>
    `;
  }

  const block = text => `<div class="mono text-[11px] leading-[1.5] px-2.5 py-2 rounded-md whitespace-pre-wrap" style="background: var(--bg-prompt-bar); color: var(--text-primary);">${text}</div>`;
  const label = text => `<div class="text-[11px] font-medium mb-1.5" style="color: var(--text-secondary);">${text}</div>`;

  /* A dialog box over the whole mock: backdrop click, the × and Esc close it (page/actions.js). */
  const modal = (width, inner) => `
    <div data-act="closeDialog" class="dialog-fade absolute inset-0 z-50 flex items-center justify-center" style="background: rgba(0, 0, 0, 0.55);">
      <div data-act="noop" role="dialog" class="dialog-pop rounded-xl border cursor-default overflow-hidden" style="width: ${width}px; max-height: 560px; background: var(--bg-main); border-color: var(--border-card); box-shadow: var(--menu-shadow);">
        ${inner}
      </div>
    </div>
  `;

  const closeButton = `<button data-act="closeDialog" class="p-1 rounded hover:opacity-80" style="color: var(--text-muted);" title="Close (Esc)">${ICONS.close}</button>`;

  function agentDialog(agent) {
    const def = DEFS[agent.type];
    const status = { running: 'working', done: 'finished', idle: 'idle' }[agent.status];
    const runs = agent.status === 'idle' ? [] : [agent];
    return modal(540, `
      <div class="px-4 h-[44px] flex items-center justify-between border-b" style="border-color: var(--border-color);">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-semibold text-[13px]" style="color: var(--text-primary);">${agent.type}</span>
          ${agent.desc ? `<span class="text-[12px] truncate" style="color: var(--text-muted);">· ${agent.desc}</span>` : ''}
        </div>
        <div class="flex items-center gap-3 shrink-0">
          <span class="mono text-[10.5px]" style="color: var(--text-muted);">${agent.model}</span>
          ${closeButton}
        </div>
      </div>
      <div class="p-4 space-y-4 overflow-y-auto" style="max-height: 500px;">
        <div>
          ${label(def ? `Definition · ${def.file}` : 'Definition')}
          ${def ? block(def.body) : `<div class="text-[11.5px]" style="color: var(--text-muted);">Built-in agent, no definition file.</div>`}
        </div>
        ${runs.length ? runs.map(run => `
          <div>
            ${label(`This run · ${status} · ${run.time}`)}
            ${block(run.prompt)}
            <div class="mt-3">${contextBar(run.used)}</div>
          </div>
        `).join('') : `<div class="text-[11.5px]" style="color: var(--text-muted);">No runs in this session yet.</div>`}
      </div>
    `);
  }

  function imageDialog(image) {
    return modal(760, `
      <div class="aspect-[16/10] w-full" style="background: #0a0a0a;">${image.html}</div>
      <div class="px-4 h-[42px] flex items-center justify-between border-t" style="border-color: var(--border-color);">
        <span class="text-[11.5px]" style="color: var(--text-secondary);"><span class="font-semibold" style="color: var(--text-primary);">${image.label}</span> · ${image.source}</span>
        <div class="flex items-center gap-2">
          <button class="px-2 py-1 rounded-md text-[11px] stanza-row-hover" style="color: var(--text-secondary);">Show in Explorer</button>
          ${closeButton}
        </div>
      </div>
    `);
  }

  /* The Windows toast Stanza raises when a background session waits on a prompt (notifyTab in the app). */
  function toast(animate) {
    return `
      <div data-act="dismissToast" class="${animate ? 'toast-in ' : ''}absolute right-3 bottom-[33px] z-40 w-[292px] rounded-lg border px-3 py-2.5 cursor-pointer" style="background: var(--menu-bg); border-color: var(--border-card); box-shadow: var(--menu-shadow);" title="Click to dismiss">
        <div class="flex items-center justify-between text-[10.5px]" style="color: var(--text-muted);">
          <span class="flex items-center gap-1.5">${ICONS.stanzaSmall} Stanza</span>
          ${ICONS.close}
        </div>
        <div class="mt-2 text-[12px] font-semibold" style="color: var(--text-primary);">gymapp-offline: Needs input</div>
        <div class="mt-0.5 text-[11.5px]" style="color: var(--text-secondary);">Coach tests after the fixture change</div>
      </div>
    `;
  }

  function overlays(screen, ctx) {
    let html = '';
    if (screen === 'needs-input' && state.promptAnswer === null && !(ctx.live && state.toastDismissed)) {
      // Slide in once per visit, not again on every redraw (arrow keys redraw the prompt)
      html += toast(ctx.live && !state.toastSeen);
      if (ctx.live) state.toastSeen = true;
    }
    if (ctx.live && state.dialog) {
      const { kind, id } = state.dialog;
      const item = kind === 'agent' ? findAgent(id) : findImage(id);
      if (item) html += kind === 'agent' ? agentDialog(item) : imageDialog(item);
    }
    return html;
  }

  S.mock.overlays = overlays;
  S.mock.subagentRows = subagentRows;
  S.mock.images = IMAGES;
})(window.Stanza);
