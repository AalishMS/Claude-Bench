/* Left sidebar of the mock: search, the split box and each project's session list. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;
  const esc = S.esc;

  /* The split's members, in pane order. They come from two projects, so each row names its project. */
  const SPLIT_ROWS = [
    { title: 'File summar...', project: 'Claude Termi...' },
    { title: 'Project layou...', project: 'gymapp-offli...' },
  ];
  /* The split stage's four panes; rows past the pane count are hidden by CSS (data-panes on the window). */
  const QUAD_ROWS = [
    ...SPLIT_ROWS,
    { title: 'PowerShell', project: 'Hot garbage', idle: true },
    { title: 'Desktop scr...', project: 'Chats' },
  ];

  function leftSidebar(screen, ctx) {
    if (ctx.live && !state.leftSidebarOpen) return '';

    const isQuad = screen === 'quad';
    const isSplit = screen === 'split' || screen === 'split-working' || isQuad;
    const isSplitWorking = screen === 'split-working' || isQuad;
    const rows = isQuad ? QUAD_ROWS : SPLIT_ROWS;
    const isMain = screen === 'main';
    const isMainWorking = screen === 'main-working';
    const isSettings = screen.startsWith('settings-');
    const isNewMenu = screen === 'new-menu';
    const isTerminal = screen === 'terminal';
    const isInput = screen === 'needs-input';
    const isPanel = screen === 'panel';

    const splitBoxHtml = isSplit ? `
      <div class="split-box mx-2 mb-2 p-1.5 rounded-lg border transition-colors" style="background: var(--bg-split-box); border-color: var(--border-split-box);">
        <div class="flex items-center justify-between px-1.5 py-1 text-[11px] font-medium" style="color: var(--text-secondary);">
          <span class="flex items-center gap-1.5">
            ${ICONS.splitCols}
            <span>Split view</span>
          </span>
          <span ${isQuad ? 'data-quad-count' : ''} class="px-1.5 rounded-full text-[10px] font-semibold" style="background: var(--bg-Split-badge); color: var(--text-secondary);">${rows.length}</span>
        </div>
        <div class="mt-0.5 space-y-0.5">
          ${rows.map((row, i) => {
            const focused = (ctx.live ? state.focusedSplitPane : 0) === i;
            const working = isSplitWorking && !row.idle;
            return `
              <div data-act="setSplitFocus" data-arg="${i}" data-row="${i}" class="flex items-center justify-between px-2 py-1 rounded-md cursor-pointer transition-colors ${focused ? '' : 'stanza-row-hover'}" style="${focused ? 'background: var(--bg-active-row);' : ''}">
                <span class="flex items-center gap-2 min-w-0">
                  <span class="w-1.5 h-1.5 rounded-full shrink-0 ${working ? 'dot-working-pulse' : ''}" style="background: ${working ? 'var(--dot-amber)' : 'var(--dot-green)'};"></span>
                  <span class="text-[11.5px] truncate ${focused ? 'font-semibold' : ''}" style="color: ${focused ? 'var(--text-primary)' : 'var(--text-secondary)'};">${row.title}</span>
                </span>
                <span class="text-[10.5px] truncate ml-1" style="color: var(--text-muted);">${row.project}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    ` : '';

    let claudeItems = [];
    if (screen === 'home' || isNewMenu || isTerminal || isInput) {
      claudeItems = [
        { title: 'Promo screenshots', time: 'now', target: 'main' },
        { title: 'Logo redesign', time: '4m', target: 'main' },
        { title: 'App name and icon re...', time: isNewMenu ? '37m' : '36m', target: 'main' },
        { title: 'merge-footer-update-...', time: '1h', target: 'main' },
        { title: 'Subagent sidebar mod...', time: '2h', target: 'main' },
        { title: 'add-sidebar-footer-bo...', time: '2h', target: 'main' },
        { more: 'Show 90 more' }
      ];
    } else if (isMain) {
      claudeItems = [
        { title: 'Project overview with...', time: 'now', active: true, dot: 'green', target: 'main' },
        { title: 'Promo screenshots', time: 'now', target: 'main-working' },
        { title: 'Logo redesign', time: '7m', target: 'main' },
        { title: 'App name and icon re...', time: '38m', target: 'main' },
        { title: 'merge-footer-update-...', time: '1h', target: 'main' },
        { title: 'Subagent sidebar mod...', time: '2h', target: 'main' },
        { more: 'Show 91 more' }
      ];
    } else if (isMainWorking) {
      claudeItems = [
        { title: 'File summaries for src...', time: 'now', active: true, dot: 'amber', target: 'main-working' },
        { title: 'Project overview with f...', time: 'now', dot: 'green', target: 'main' },
        { title: 'Promo screenshots', time: 'now', target: 'main' },
        { title: 'Logo redesign', time: '8m', target: 'main' },
        { title: 'App name and icon re...', time: '39m', target: 'main' },
        { title: 'merge-footer-update-...', time: '1h', target: 'main' },
        { more: 'Show 92 more' }
      ];
    } else if (isPanel) {
      claudeItems = [
        { title: 'Zoom overlap and upd...', time: 'now', active: true, dot: 'amber', target: 'panel' },
        { title: 'Promo screenshots', time: '2m', target: 'main' },
        { title: 'Logo redesign', time: '9m', target: 'main' },
        { title: 'App name and icon re...', time: '41m', target: 'main' },
        { title: 'merge-footer-update-...', time: '1h', target: 'main' },
        { more: 'Show 91 more' }
      ];
    } else if (isSettings) {
      claudeItems = [
        { title: 'Promo screenshots', time: 'now', target: 'main' },
        { title: 'File summaries for src ...', time: '3m', target: 'split' },
        { title: 'Project overview with f...', time: '6m', target: 'main' },
        { title: 'Logo redesign', time: '13m', target: 'main' },
        { title: 'App name and icon re...', time: '44m', target: 'main' },
        { title: 'merge-footer-update-...', time: '1h', target: 'main' },
        { more: 'Show 92 more' }
      ];
    } else if (isSplit) {
      claudeItems = [
        { title: 'Project overview with f...', time: isSplitWorking ? '2m' : '4m', dot: 'green', target: 'main' },
        { title: 'Promo screenshots', time: 'now', target: 'main' },
        { title: 'Logo redesign', time: isSplitWorking ? '9m' : '11m', target: 'main' },
        { title: 'App name and icon re...', time: isSplitWorking ? '41m' : '43m', target: 'main' },
        { more: 'Show 93 more' }
      ];
    }

    let gymItems;
    if (isInput) {
      gymItems = [
        { title: 'Coach tests after the f...', time: 'now', active: true, dot: 'green', target: 'needs-input' },
        { title: 'Project structure overv...', time: '11h', target: 'split' },
        { title: 'Small issues', time: '3d', target: 'main' },
        { title: 'Settings page accent c...', time: '3d', target: 'settings-appearance' },
        { title: 'Settings Artificial Intelli...', time: '3d', target: 'main' },
        { more: 'Show 53 more' }
      ];
    } else if (isMainWorking) {
      gymItems = [
        { title: 'Project layout and sou...', time: 'now', dot: 'amber', target: 'split-working' },
        { title: 'Project structure overv...', time: '11h', target: 'split' },
        { title: 'Small issues', time: '3d', target: 'main' },
        { title: 'Settings page accent c...', time: '3d', target: 'settings-appearance' },
        { title: 'Settings Artificial Intelli...', time: '3d', target: 'main' },
        { title: 'Android emulator in T...', time: '3d', target: 'main' },
        { more: 'Show 53 more' }
      ];
    } else {
      gymItems = [
        { title: 'Project structure overv...', time: '11h', target: 'split' },
        { title: 'Small issues', time: '3d', target: 'main' },
        { title: 'Settings page accent c...', time: '3d', target: 'settings-appearance' },
        { title: 'Settings Artificial Intelli...', time: '3d', target: 'main' },
        { title: 'Android emulator in T...', time: '3d', target: 'main' },
        { title: 'Coach review changes ...', time: '3d', target: 'main' },
        { more: 'Show 52 more' }
      ];
    }

    let hotItems = [
      { title: 'Capabilities and recom...', time: (screen === 'home' || isNewMenu) ? '1d' : '2d', target: 'main' },
      { title: 'Vibe-coded cat website', time: '2d', target: 'main' }
    ];
    if (isTerminal) hotItems.unshift({ title: 'PowerShell', time: '', active: true, dot: 'green', target: 'terminal' });

    const query = ctx.live ? state.searchQuery.trim().toLowerCase() : '';
    if (query) {
      const match = i => i.title && i.title.toLowerCase().includes(query);
      claudeItems = claudeItems.filter(match);
      gymItems = gymItems.filter(match);
      hotItems = hotItems.filter(match);
    }

    const showGitSub = isMain || isMainWorking || isSplit || isPanel;
    const claudeFolderDot = isMain ? 'green' : (isMainWorking || isSplitWorking || isPanel ? 'amber' : (screen === 'split' ? 'green' : null));
    const gymFolderDot = isMainWorking || isSplitWorking ? 'amber' : (isInput || screen === 'split' ? 'green' : null);
    const hotFolderDot = isTerminal || isQuad ? 'green' : null;
    const folderDot = dot => dot ? `<span class="w-1.5 h-1.5 rounded-full mr-1 ${dot === 'amber' ? 'dot-working-pulse' : ''}" style="background: ${dot === 'green' ? 'var(--dot-green)' : 'var(--dot-amber)'};"></span>` : '';

    const renderItemRow = (item) => {
      if (item.more) {
        return `<div data-act="selectView" data-arg="split" class="pl-7 pr-2.5 py-1 text-[11px] cursor-pointer hover:underline" style="color: var(--text-muted);">${item.more}</div>`;
      }
      const dotHtml = item.dot
        ? `<span class="w-1.5 h-1.5 rounded-full shrink-0 ${item.dot === 'amber' ? 'dot-working-pulse' : ''}" style="background: ${item.dot === 'green' ? 'var(--dot-green)' : 'var(--dot-amber)'};"></span>`
        : '';
      const targetView = item.target || (item.dot === 'amber' ? 'main-working' : 'main');
      return `
        <div data-act="selectView" data-arg="${targetView}" class="mx-1.5 px-2 py-[4.5px] rounded-md flex items-center justify-between cursor-pointer transition-colors ${item.active ? 'font-semibold' : 'stanza-row-hover'}" style="${item.active ? 'background: var(--bg-active-row); color: var(--text-primary);' : 'color: var(--text-secondary);'}">
          <span class="flex items-center gap-2 min-w-0">
            ${dotHtml}
            <span class="${item.dot ? '' : 'pl-3.5'} text-[11.5px] truncate">${item.title}</span>
          </span>
          <span class="text-[10.5px] shrink-0 ml-1.5" style="color: var(--text-muted);">${item.time}</span>
        </div>
      `;
    };

    const newMenuDropdown = isNewMenu ? `
      <div class="menu-pop absolute left-[196px] top-[34px] z-40 w-[166px] p-1 rounded-lg border" style="background: var(--menu-bg); border-color: var(--border-card); box-shadow: var(--menu-shadow);">
        <div data-act="selectView" data-arg="main" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] cursor-pointer" style="background: var(--bg-active-row); color: var(--text-primary);">
          <span style="color: var(--text-muted);">${ICONS.chat}</span>
          <span>No project</span>
        </div>
        <div class="my-1 border-t" style="border-color: var(--border-color);"></div>
        <div data-act="selectView" data-arg="main" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] cursor-pointer stanza-row-hover" style="color: var(--text-primary);">
          <span style="color: var(--text-muted);">${ICONS.folder}</span>
          <span>Claude Terminal</span>
        </div>
        <div data-act="selectView" data-arg="main-working" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] cursor-pointer stanza-row-hover" style="color: var(--text-primary);">
          <span style="color: var(--text-muted);">${ICONS.folder}</span>
          <span>gymapp-offline</span>
        </div>
        <div data-act="selectView" data-arg="split" class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11.5px] cursor-pointer stanza-row-hover" style="color: var(--text-primary);">
          <span style="color: var(--text-muted);">${ICONS.folder}</span>
          <span>Hot garbage</span>
        </div>
      </div>
    ` : '';

    const claudeCollapsed = ctx.live && state.collapsedFolders.claude;
    const gymCollapsed = ctx.live && state.collapsedFolders.gym;
    const hotCollapsed = ctx.live && state.collapsedFolders.hot;

    return `
      <aside class="w-[228px] shrink-0 flex flex-col border-r select-none relative" style="background: var(--bg-sidebar); border-color: var(--border-color);">
        ${newMenuDropdown}
        <div class="h-[34px] px-2.5 flex items-center justify-between gap-1">
          <div class="flex items-center gap-1.5 text-[11.5px] flex-1 min-w-0" style="color: var(--text-muted);">
            ${ICONS.search}
            ${ctx.live ? `
              <input
                type="text"
                value="${esc(state.searchQuery)}"
                data-field="search"
                placeholder="Search"
                class="bg-transparent border-none outline-none w-full text-[11.5px] placeholder:text-[var(--text-muted)]"
                style="color: var(--text-primary);"
              />
            ` : `<span>Search</span>`}
          </div>
          <div class="flex items-center gap-2 shrink-0" style="color: var(--text-muted);">
            <button data-act="selectView" data-arg="home" class="hover:opacity-80" title="Add project">${ICONS.folderPlus}</button>
            <button data-act="selectView" data-arg="${isNewMenu ? 'home' : 'new-menu'}" class="hover:opacity-80" title="New session">${ICONS.plus}</button>
          </div>
        </div>

        ${splitBoxHtml}

        <div class="flex-1 overflow-y-auto py-0.5 space-y-0.5">
          <div data-act="toggleFolder" data-arg="chats" class="px-2 py-1 flex items-center gap-1.5 cursor-pointer stanza-row-hover" style="color: var(--text-primary);">
            <span style="color: var(--text-muted);">${(ctx.live && !state.collapsedFolders.chats) ? ICONS.chevronDown : ICONS.chevronRight}</span>
            <span style="color: var(--text-muted);">${ICONS.chat}</span>
            <span class="font-semibold text-[11.5px]">Chats</span>
          </div>
          ${(ctx.live && !state.collapsedFolders.chats) ? `
            <div class="space-y-[1px] mt-0.5">
              ${renderItemRow({ title: 'Quick regex helper', time: '3h', target: 'main' })}
            </div>
          ` : ''}

          <div class="pt-1">
            <div data-act="toggleFolder" data-arg="claude" class="px-2 py-1 flex items-center justify-between cursor-pointer stanza-row-hover">
              <span class="flex items-center gap-1.5">
                <span style="color: var(--text-muted);">${claudeCollapsed ? ICONS.chevronRight : ICONS.chevronDown}</span>
                <span style="color: var(--text-muted);">${ICONS.folder}</span>
                <span class="font-semibold text-[11.5px]" style="color: var(--text-primary);">Claude Terminal</span>
              </span>
              ${folderDot(claudeFolderDot)}
            </div>
            ${!claudeCollapsed ? `
              ${showGitSub ? `<div class="pl-7 pr-2 pb-0.5 text-[10.5px]" style="color: var(--text-muted);">main · 6 changed</div>` : ''}
              <div class="space-y-[1px] mt-0.5">
                ${claudeItems.map(renderItemRow).join('')}
              </div>
            ` : ''}
          </div>

          <div class="pt-2">
            <div data-act="toggleFolder" data-arg="gym" class="px-2 py-1 flex items-center justify-between cursor-pointer stanza-row-hover">
              <span class="flex items-center gap-1.5">
                <span style="color: var(--text-muted);">${gymCollapsed ? ICONS.chevronRight : ICONS.chevronDown}</span>
                <span style="color: var(--text-muted);">${ICONS.folder}</span>
                <span class="font-semibold text-[11.5px]" style="color: var(--text-primary);">gymapp-offline</span>
              </span>
              ${folderDot(gymFolderDot)}
            </div>
            ${!gymCollapsed ? `
              ${isInput ? `<div class="pl-7 pr-2 pb-0.5 text-[10.5px]" style="color: var(--text-muted);">feat/ai-coach · 2 changed</div>` : ''}
              <div class="space-y-[1px] mt-0.5">
                ${gymItems.map(renderItemRow).join('')}
              </div>
            ` : ''}
          </div>

          <div class="pt-2">
            <div data-act="toggleFolder" data-arg="hot" class="px-2 py-1 flex items-center justify-between cursor-pointer stanza-row-hover">
              <span class="flex items-center gap-1.5">
                <span style="color: var(--text-muted);">${hotCollapsed ? ICONS.chevronRight : ICONS.chevronDown}</span>
                <span style="color: var(--text-muted);">${ICONS.folder}</span>
                <span class="font-semibold text-[11.5px]" style="color: var(--text-primary);">Hot garbage</span>
              </span>
              ${folderDot(hotFolderDot)}
            </div>
            ${!hotCollapsed ? `
              <div class="space-y-[1px] mt-0.5">
                ${hotItems.map(renderItemRow).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </aside>
    `;
  }

  S.mock.leftSidebar = leftSidebar;
})(window.Stanza);
