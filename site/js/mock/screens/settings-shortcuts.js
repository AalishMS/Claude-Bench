/* Settings page: the shortcut list, each row clickable to record. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;

  function screen(ctx, theme) {
    const renderShortcutGroup = (label, rows) => `
      <div class="mt-4">
        <div class="text-[11px] font-medium mb-1.5" style="color: var(--text-muted);">${label}</div>
        <div class="rounded-lg border overflow-hidden" style="border-color: var(--border-card);">
          ${rows.map((r, idx) => {
            const isRec = state.recordingShortcutId === r.name;
            return `
              <div data-act="startShortcutRecord" data-arg="${r.name}" class="px-3.5 py-2 flex items-center justify-between cursor-pointer stanza-row-hover ${idx < rows.length - 1 ? 'border-b' : ''}" style="border-color: var(--border-color);">
                <div>
                  <div class="text-[12px]" style="color: var(--text-primary);">${r.name}</div>
                  ${r.sub ? `<div class="text-[10.5px] mt-0.5" style="color: var(--text-muted);">${r.sub}</div>` : ''}
                </div>
                <div class="flex items-center gap-1.5">
                  ${isRec
                    ? `<span class="kbd-pill" style="border-color: var(--accent-violet); color: var(--accent-violet);">Press keys… Esc</span>`
                    : r.keys.map(k => `<kbd class="kbd-pill">${k}</kbd>`).join('')
                  }
                  <button class="w-5 h-5 flex items-center justify-center rounded hover:opacity-75" style="color: var(--text-muted);">+</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    return `
      <main class="flex-1 overflow-y-auto px-8 pt-6 pb-10 select-none" style="background: var(--bg-main);">
        <div class="max-w-[660px] mx-auto">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-[16px] font-semibold" style="color: var(--text-primary);">Settings</h2>
            <button data-act="selectView" data-arg="home" class="p-1 rounded hover:opacity-75" style="color: var(--text-muted);">${ICONS.close}</button>
          </div>

          <div class="flex gap-8">
            <div class="w-[136px] shrink-0 space-y-1">
              <button data-act="selectView" data-arg="settings-appearance" class="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[12px] text-left stanza-row-hover" style="color: var(--text-secondary);">
                ${ICONS.palette}
                <span>Appearance</span>
              </button>
              <button data-act="selectView" data-arg="home" class="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[12px] text-left stanza-row-hover" style="color: var(--text-secondary);">
                ${ICONS.chat}
                <span>Chats</span>
              </button>
              <button data-act="selectView" data-arg="settings-shortcuts" class="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[12px] font-semibold text-left" style="background: var(--bg-active-row); color: var(--text-primary);">
                ${ICONS.keyboard}
                <span>Shortcuts</span>
              </button>
            </div>

            <div class="flex-1">
              <div class="pb-3 border-b" style="border-color: var(--border-color);">
                <div class="text-[13px] font-semibold" style="color: var(--text-primary);">Shortcuts</div>
                <div class="text-[11.5px] mt-0.5" style="color: var(--text-muted);">Click a shortcut to change it, or + to add another. Esc cancels.</div>
              </div>

              ${renderShortcutGroup('Sessions', [
                { name: 'New Claude session', keys: ['Ctrl+T', 'Ctrl+Shift+T'] },
                { name: 'Close session', keys: ['Ctrl+W', 'Ctrl+Shift+W'] },
                { name: 'Next session', keys: ['Ctrl+Tab'] },
                { name: 'Previous session', keys: ['Ctrl+Shift+Tab'] },
                { name: 'Go to session 1–9', keys: ['Alt+1…9'] }
              ])}

              ${renderShortcutGroup('Split view', [
                { name: 'New session beside', keys: ['Ctrl+Shift+→'] },
                { name: 'New session below', keys: ['Ctrl+Shift+↓', 'Ctrl+Shift+↑'] },
                { name: 'Back to one terminal', keys: ['Ctrl+Shift+\\'] },
                { name: 'Move focus to the pane in that direction', sub: 'Only while split, otherwise the keys reach the terminal', keys: ['Alt+←↑→↓'] },
                { name: 'Resize panes', sub: 'Moves the divider in that direction, only while split', keys: ['Ctrl+Alt+←↑→↓'] }
              ])}

              ${renderShortcutGroup('Window', [
                { name: 'Toggle sidebar', keys: ['Ctrl+S', 'Ctrl+Shift+B'] },
                { name: 'Toggle right sidebar', keys: ['Ctrl+Shift+S'] },
                { name: 'Search sessions', keys: ['Ctrl+Shift+F'] },
                { name: 'Settings', keys: ['Ctrl+,'] }
              ])}
            </div>
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens['settings-shortcuts'] = screen;
})(window.Stanza);
