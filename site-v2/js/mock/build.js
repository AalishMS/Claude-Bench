/* Wraps a screen in the app's title bar, sidebars and status bar. S.mock.build() returns the markup. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;

  const center = (screen, theme, ctx) => (S.mock.screens[screen] || (() => ''))(ctx, theme);

  function build(screen, theme, ctx) {
    const hasSession = screen === 'main' || screen === 'main-working' || screen === 'split' || screen === 'split-working';
    const isSplit = screen === 'split' || screen === 'split-working';
    const isSettings = screen.startsWith('settings-');

    let footerPct = isSettings ? '9%' : '8%';
    let footerStatusDot = 'var(--text-muted)';
    let footerStatusText = '0 running';
    let isWorkingFooter = false;

    if (screen === 'main') {
      footerStatusDot = 'var(--dot-green)';
      footerStatusText = '1 running';
    } else if (screen === 'main-working' || screen === 'split-working') {
      footerStatusDot = 'var(--dot-amber)';
      footerStatusText = '2 working';
      isWorkingFooter = true;
    } else if (screen === 'split') {
      footerStatusDot = 'var(--dot-green)';
      footerStatusText = '4 running';
    }

    let sessionsRunningText = '0 sessions running';
    if (screen === 'main') sessionsRunningText = '1 session running';
    else if (screen === 'main-working') sessionsRunningText = '3 sessions running';
    else if (isSplit) sessionsRunningText = '4 sessions running';

    const showLeft = !ctx.live || state.leftSidebarOpen;
    const showRight = (!ctx.live || state.rightSidebarOpen) && !isSplit;

    return `
      <div class="stanza-root theme-${theme}">
        <header class="h-[34px] shrink-0 flex items-center justify-between border-b select-none" style="border-color: var(--border-color); background: var(--bg-header);">
          <div class="w-[228px] h-full px-2.5 flex items-center gap-2 border-r" style="background: var(--bg-header-sidebar); border-color: var(--border-color);">
            <button data-act="toggleLeftSidebar" class="p-1 rounded transition hover:opacity-80" style="${showLeft ? 'background: var(--icon-active-bg); color: var(--text-primary);' : 'color: var(--text-muted);'}" title="Toggle sidebar (Ctrl+S)">${ICONS.sidebarLeft}</button>
            <div data-act="selectView" data-arg="home" class="flex items-center gap-1.5 cursor-pointer">
              ${ICONS.stanzaSmall}
              <span class="font-semibold text-[12px] tracking-tight" style="color: var(--text-primary);">Stanza</span>
            </div>
          </div>

          <div class="flex-1 h-full px-2.5 flex items-center justify-end gap-1.5" style="color: var(--text-muted);">
            ${hasSession ? `
              <button data-act="selectView" data-arg="home" class="p-1 rounded hover:opacity-80" title="Close session (Ctrl+W)">${ICONS.close}</button>
              <button data-act="selectView" data-arg="${isSplit ? (screen === 'split-working' ? 'main-working' : 'main') : (screen === 'main-working' ? 'split-working' : 'split')}" class="p-1 rounded transition" style="${isSplit ? 'background: var(--icon-active-bg); color: var(--text-primary);' : ''}" title="Toggle Split View">${ICONS.splitCols}</button>
            ` : ''}
            <button data-act="selectView" data-arg="main" class="p-1 rounded hover:opacity-80" title="Open in VS Code">${ICONS.vscode}</button>
            <button data-act="selectView" data-arg="split" class="p-1 rounded hover:opacity-80" title="Open PowerShell">${ICONS.terminal}</button>
            <button data-act="selectView" data-arg="home" class="p-1 rounded hover:opacity-80" title="Open project folder">${ICONS.folder}</button>
            <button data-act="toggleRightSidebar" class="p-1 rounded transition" style="${showRight ? 'background: var(--icon-active-bg); color: var(--text-primary);' : ''}" title="Toggle side panel (Ctrl+Shift+S)">${ICONS.sidebarRight}</button>
          </div>
        </header>

        <div class="flex-1 flex overflow-hidden">
          ${S.mock.leftSidebar(screen, ctx)}
          ${center(screen, theme, ctx)}
          ${S.mock.rightSidebar(screen, ctx)}
        </div>

        <footer class="h-[25px] shrink-0 flex items-center border-t text-[11px] select-none" style="border-color: var(--border-color);">
          <div class="w-[228px] h-full px-2.5 flex items-center justify-between border-r" style="background: var(--bg-footer-sidebar); border-color: var(--border-color); color: var(--text-muted);">
            <div class="flex items-center gap-2">
              <button data-act="selectView" data-arg="settings-appearance" class="hover:opacity-80" title="Settings (Ctrl+,)">${ICONS.gear}</button>
              <button class="hover:opacity-80" title="Check updates">${ICONS.refresh}</button>
              <span class="flex items-center gap-1" title="Plan usage">
                ${ICONS.ringMeter}
                <span class="text-[10.5px]">${footerPct}</span>
              </span>
            </div>
            <div data-act="toggleWorkingVariant" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80" title="Click to toggle working/idle">
              <span class="w-1.5 h-1.5 rounded-full ${isWorkingFooter ? 'dot-working-pulse' : ''}" style="background: ${footerStatusDot};"></span>
              <span class="text-[10.5px]">${footerStatusText}</span>
            </div>
          </div>

          <div class="flex-1 h-full px-3 flex items-center justify-between" style="background: var(--bg-footer-main); color: var(--text-muted);">
            <div>
              ${hasSession ? `
                <div class="flex items-center gap-2 text-[10.5px]">
                  <span class="flex items-center gap-1" style="color: var(--text-secondary);">${ICONS.gitBranch} main</span>
                  <span class="flex items-center gap-1" style="color: var(--text-amber);">
                    <span class="w-1.5 h-1.5 rounded-full" style="background: var(--text-amber);"></span>
                    <span>6 changed</span>
                  </span>
                  <span style="color: var(--text-muted);">E:\\pet_project\\Claude Terminal</span>
                </div>
              ` : ''}
            </div>
            <div class="flex items-center gap-3 text-[10.5px]">
              ${hasSession ? `
                <span class="flex items-center gap-1">${ICONS.gear} Haiku 5.5</span>
                <span class="flex items-center gap-1">${ICONS.bolt} high effort</span>
              ` : ''}
              <span>${sessionsRunningText}</span>
            </div>
          </div>
        </footer>
      </div>
    `;
  }

  S.mock.build = build;
})(window.Stanza);
