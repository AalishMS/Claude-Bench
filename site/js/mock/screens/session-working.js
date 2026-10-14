/* A single Claude Code session while it is working. */
(function (S) {
  'use strict';

  const model = S.model;

  function screen(ctx, theme) {
    const autoModeText = model.autoModeText();

    return `
      <main class="flex-1 flex flex-col justify-end px-4 pb-3 mono text-[14px] leading-[1.5]" style="background: var(--bg-main); color: var(--text-primary);">
        <div class="mb-7">
          <span data-live-spinner="Computing" style="color: var(--text-computing);">${model.spinnerText('Computing')}</span>
          <span data-live-counter="main" style="color: var(--text-muted);">${model.counterText('main')}</span>
        </div>
        <div>
          <div class="border-t" style="border-color: var(--border-term-rule);"></div>
          <div class="py-1.5 flex items-center gap-1">
            <span>&gt;</span>
            <span class="inline-block w-2 h-4 border border-current term-cursor"></span>
          </div>
          <div class="border-t" style="border-color: var(--border-term-rule);"></div>
          <div class="pt-2 pl-4 text-[13px]">
            <span data-act="cycleAutoMode" class="cursor-pointer hover:underline" style="color: var(--text-auto-mode);">${autoModeText}</span>
            <span style="color: var(--text-muted);"> (shift+tab to cycle) · <span data-act="selectView" data-arg="main" class="cursor-pointer hover:underline">esc to interrupt</span> · ← for agents</span>
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens['main-working'] = screen;
})(window.Stanza);
