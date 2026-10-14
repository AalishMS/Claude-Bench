/* Right sidebar of the mock: context meter, MCP servers, subagents, running servers, images. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;

  function rightSidebar(screen, ctx) {
    if (screen === 'split' || screen === 'split-working') return '';
    if (ctx.live && !state.rightSidebarOpen) return '';

    const hasSession = screen === 'main' || screen === 'main-working';
    const contextPct = screen === 'main-working' ? '14%' : '6%';
    const contextTokens = screen === 'main-working' ? '144k / 1M' : '62k / 1M';

    const contextSection = hasSession ? `
      <div class="px-3.5 pt-2.5 pb-3 border-b" style="border-color: var(--border-color);">
        <div class="flex items-center justify-between text-[11px]">
          <span class="font-medium" style="color: var(--text-secondary);">Context</span>
          <span class="mono text-[10.5px]" style="color: var(--text-muted);">${contextTokens}</span>
        </div>
        <div class="text-[16px] font-bold mt-0.5 tracking-tight" style="color: var(--text-primary);">${contextPct}</div>
        <div class="w-full h-[4px] rounded-full mt-1.5 overflow-hidden" style="background: var(--track-bg);">
          <div class="h-full rounded-full transition-all duration-500" style="width: ${contextPct}; background: var(--accent-violet);"></div>
        </div>
      </div>
    ` : '';

    const mcpSubtext = !hasSession ? `
      <div class="text-[11px] mb-2" style="color: var(--text-muted);">User-level servers, no project selected.</div>
    ` : '';

    const mcps = [
      'claude.ai Claude Docs',
      'claude.ai Gmail',
      'playwright',
      'chrome-devtools',
      'supabase'
    ];

    const subagents = [
      { name: 'code-reviewer', model: 'Sonnet' },
      { name: 'code-scout', model: 'Haiku' },
      { name: 'deep-debugger', model: 'Opus' }
    ];

    const mcpCollapsed = ctx.live && state.collapsedRight.mcps;
    const subCollapsed = ctx.live && state.collapsedRight.subagents;

    return `
      <aside class="w-[238px] shrink-0 border-l flex flex-col select-none overflow-y-auto" style="background: var(--bg-right); border-color: var(--border-color);">
        ${contextSection}

        <div class="px-3.5 py-2.5">
          <div data-act="toggleRightSection" data-arg="mcps" class="flex items-center justify-between text-[11px] mb-1.5 cursor-pointer">
            <span class="flex items-center gap-1 font-medium" style="color: var(--text-secondary);">
              ${mcpCollapsed ? ICONS.chevronRight : ICONS.chevronDown}
              <span>MCPs</span>
            </span>
            <span class="text-[10.5px]" style="color: var(--text-muted);">5/13</span>
          </div>
          ${!mcpCollapsed ? `
            ${mcpSubtext}
            <div class="space-y-1.5 mt-1">
              ${mcps.map(m => `
                <div class="flex items-center justify-between text-[11.5px]">
                  <span class="flex items-center gap-2 truncate" style="color: var(--text-primary);">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: var(--dot-green);"></span>
                    <span class="truncate">${m}</span>
                  </span>
                  <span class="text-[10.5px] shrink-0 ml-2" style="color: var(--text-connected);">connected</span>
                </div>
              `).join('')}
              <div class="pl-3.5 pt-0.5 text-[11px] cursor-pointer hover:underline" style="color: var(--text-muted);">Show 8 more</div>
            </div>
          ` : ''}
        </div>

        <div class="px-3.5 py-2.5">
          <div data-act="toggleRightSection" data-arg="subagents" class="flex items-center justify-between text-[11px] mb-1.5 cursor-pointer">
            <span class="flex items-center gap-1 font-medium" style="color: var(--text-secondary);">
              ${subCollapsed ? ICONS.chevronRight : ICONS.chevronDown}
              <span>Subagents</span>
            </span>
            <span class="text-[10.5px]" style="color: var(--text-muted);">3</span>
          </div>
          ${!subCollapsed ? `
            <div class="space-y-1.5">
              ${subagents.map(s => `
                <div class="flex items-center justify-between text-[11.5px]">
                  <span class="flex items-center gap-2 truncate" style="color: var(--text-primary);">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: var(--text-muted);"></span>
                    <span class="truncate">${s.name}</span>
                  </span>
                  <span class="mono text-[10.5px]" style="color: var(--text-muted);">${s.model}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="px-3.5 py-2.5">
          <div class="flex items-center gap-1 text-[11px] font-medium mb-1" style="color: var(--text-secondary);">
            ${ICONS.chevronDown}
            <span>Running</span>
          </div>
          <div class="text-[11px]" style="color: var(--text-muted);">
            ${hasSession ? 'Nothing running in this session.' : 'Nothing running.'}
          </div>
        </div>

        ${hasSession ? `
          <div class="px-3.5 py-2.5">
            <div class="flex items-center gap-1 text-[11px] font-medium mb-1" style="color: var(--text-secondary);">
              ${ICONS.chevronDown}
              <span>Images</span>
            </div>
            <div class="text-[11px]" style="color: var(--text-muted);">No images in this session.</div>
          </div>
        ` : ''}
      </aside>
    `;
  }

  S.mock.rightSidebar = rightSidebar;
})(window.Stanza);
