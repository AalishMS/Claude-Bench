/* Wraps a screen in the app's title bar, sidebars and status bar. S.mock.build() returns the markup. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;

  const center = (screen, theme, ctx) => (S.mock.screens[screen] || (() => ''))(ctx, theme);

  const DOTS = { muted: 'var(--text-muted)', green: 'var(--dot-green)', amber: 'var(--dot-amber)' };

  /* The split button's target: the same screen with or without the split, keeping working/idle. */
  const SPLIT_TOGGLE = { main: 'split', 'main-working': 'split-working', split: 'main', 'split-working': 'main-working' };

  function gitLine(git) {
    if (!git) return '';
    return `
      <div class="flex items-center gap-2 text-[10.5px]">
        ${git.none ? `<span style="color: var(--text-faint);">${git.none}</span>` : `
          <span class="flex items-center gap-1" style="color: var(--text-secondary);">${ICONS.gitBranch} ${git.branch}</span>
          <span class="flex items-center gap-1" style="color: var(--text-amber);">
            <span class="w-1.5 h-1.5 rounded-full" style="background: var(--text-amber);"></span>
            <span>${git.changed}</span>
          </span>
        `}
        <span style="color: var(--text-muted);">${git.path}</span>
      </div>
    `;
  }

  function build(screen, theme, ctx) {
    const meta = S.model.screenOf(screen);
    const hasSession = meta.kind === 'claude' || meta.kind === 'shell' || meta.kind === 'split';
    const isSplit = meta.kind === 'split';
    const isWorking = meta.status[0] === 'amber';
    // In a split the status bar follows the focused pane's project
    const git = isSplit && ctx.live && state.focusedSplitPane === 1 ? meta.gitAlt : meta.git;

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
              <button data-act="selectView" data-arg="${SPLIT_TOGGLE[screen] || 'split'}" class="p-1 rounded transition" style="${isSplit ? 'background: var(--icon-active-bg); color: var(--text-primary);' : ''}" title="${isSplit ? 'Unsplit (Ctrl+Shift+\\)' : 'New session beside (Ctrl+Shift+→)'}">${ICONS.splitCols}</button>
            ` : ''}
            <button data-act="selectView" data-arg="main" class="p-1 rounded hover:opacity-80" title="Open in VS Code">${ICONS.vscode}</button>
            <button data-act="selectView" data-arg="terminal" class="p-1 rounded transition hover:opacity-80" style="${screen === 'terminal' ? 'background: var(--icon-active-bg); color: var(--text-primary);' : ''}" title="Open PowerShell">${ICONS.terminal}</button>
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
                <span class="text-[10.5px]">${meta.usage || '8%'}</span>
              </span>
            </div>
            <div data-act="toggleWorkingVariant" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80" title="Click to toggle working/idle">
              <span class="w-1.5 h-1.5 rounded-full ${isWorking ? 'dot-working-pulse' : ''}" style="background: ${DOTS[meta.status[0]]};"></span>
              <span class="text-[10.5px]">${meta.status[1]}</span>
            </div>
          </div>

          <div class="flex-1 h-full px-3 flex items-center justify-between" style="background: var(--bg-footer-main); color: var(--text-muted);">
            <div>${gitLine(git)}</div>
            <div class="flex items-center gap-3 text-[10.5px]">
              ${meta.model ? `
                <span class="flex items-center gap-1">${ICONS.gear} ${meta.model}</span>
                <span class="flex items-center gap-1">${ICONS.bolt} high effort</span>
              ` : ''}
              <span>${meta.sessions}</span>
            </div>
          </div>
        </footer>

        ${S.mock.overlays(screen, ctx)}
      </div>
    `;
  }

  S.mock.build = build;
})(window.Stanza);
