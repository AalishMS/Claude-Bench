/* Settings page: theme cards, accent colors and terminal text size. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const state = S.model.state;

  function screen(ctx, theme) {
    const isDark = theme === 'dark';
    const acc = state.accentKey;
    return `
      <main class="flex-1 overflow-y-auto px-8 pt-6 pb-10 select-none" style="background: var(--bg-main);">
        <div class="max-w-[660px] mx-auto">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-[16px] font-semibold" style="color: var(--text-primary);">Settings</h2>
            <button data-act="selectView" data-arg="home" class="p-1 rounded hover:opacity-75" style="color: var(--text-muted);">${ICONS.close}</button>
          </div>

          <div class="flex gap-8">
            <div class="w-[136px] shrink-0 space-y-1">
              <button data-act="selectView" data-arg="settings-appearance" class="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[12px] font-semibold text-left" style="background: var(--bg-active-row); color: var(--text-primary);">
                ${ICONS.palette}
                <span>Appearance</span>
              </button>
              <button data-act="selectView" data-arg="home" class="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[12px] text-left stanza-row-hover" style="color: var(--text-secondary);">
                ${ICONS.chat}
                <span>Chats</span>
              </button>
              <button data-act="selectView" data-arg="settings-shortcuts" class="w-full px-2.5 py-1.5 rounded-md flex items-center gap-2 text-[12px] text-left stanza-row-hover" style="color: var(--text-secondary);">
                ${ICONS.keyboard}
                <span>Shortcuts</span>
              </button>
            </div>

            <div class="flex-1">
              <div class="pb-3.5 border-b" style="border-color: var(--border-color);">
                <div class="text-[13px] font-semibold" style="color: var(--text-primary);">Appearance</div>
                <div class="text-[11.5px] mt-0.5" style="color: var(--text-muted);">How Stanza looks. Changes apply at once.</div>
              </div>

              <div class="py-4 border-b" style="border-color: var(--border-color);">
                <div class="text-[12px] font-semibold" style="color: var(--text-primary);">Theme</div>
                <div class="text-[11.5px] mt-0.5 mb-3" style="color: var(--text-muted);">
                  System follows Windows. Claude Code picks some colors itself: run <span class="mono">/theme</span> in a session to match.
                </div>

                <div class="grid grid-cols-3 gap-3 max-w-[426px]">
                  <div data-act="setTheme" data-arg="dark" class="cursor-pointer text-center group">
                    <div class="h-[80px] rounded-lg overflow-hidden flex border-2 transition" style="background: #0d0d10; border-color: ${isDark ? 'var(--accent-violet)' : 'var(--border-card)'};">
                      <div class="w-[34px] h-full bg-[#151519] p-2 space-y-1.5 border-r border-[#232329]">
                        <div class="h-1.5 w-4 rounded bg-[#2e2e36]"></div>
                        <div class="h-1.5 w-5 rounded bg-[#2e2e36]"></div>
                        <div class="h-1.5 w-3.5 rounded bg-[#2e2e36]"></div>
                      </div>
                      <div class="flex-1 p-3 flex flex-col justify-between">
                        <div class="space-y-1.5">
                          <div class="h-2 w-16 rounded bg-[#52525b]"></div>
                          <div class="h-2 w-12 rounded bg-[#3f3f46]"></div>
                        </div>
                        <div class="h-2.5 w-7 rounded" style="background: var(--accent-violet);"></div>
                      </div>
                    </div>
                    <div class="text-[11.5px] mt-1.5 ${isDark ? 'font-semibold' : ''}" style="color: ${isDark ? 'var(--text-primary)' : 'var(--text-muted)'};">Dark</div>
                  </div>

                  <div data-act="setTheme" data-arg="light" class="cursor-pointer text-center group">
                    <div class="h-[80px] rounded-lg overflow-hidden flex border-2 transition" style="background: #ffffff; border-color: ${!isDark ? 'var(--accent-violet)' : 'var(--border-card)'};">
                      <div class="w-[34px] h-full bg-[#f4f4f6] p-2 space-y-1.5 border-r border-[#e4e4e7]">
                        <div class="h-1.5 w-4 rounded bg-[#d4d4d8]"></div>
                        <div class="h-1.5 w-5 rounded bg-[#d4d4d8]"></div>
                        <div class="h-1.5 w-3.5 rounded bg-[#d4d4d8]"></div>
                      </div>
                      <div class="flex-1 p-3 flex flex-col justify-between">
                        <div class="space-y-1.5">
                          <div class="h-2 w-16 rounded bg-[#71717a]"></div>
                          <div class="h-2 w-12 rounded bg-[#d4d4d8]"></div>
                        </div>
                        <div class="h-2.5 w-7 rounded" style="background: var(--accent-violet);"></div>
                      </div>
                    </div>
                    <div class="text-[11.5px] mt-1.5 ${!isDark ? 'font-semibold' : ''}" style="color: ${!isDark ? 'var(--text-primary)' : 'var(--text-muted)'};">Light</div>
                  </div>

                  <div data-act="toggleTheme" class="cursor-pointer text-center group">
                    <div class="h-[80px] rounded-lg overflow-hidden relative border transition" style="border-color: var(--border-card);">
                      <div class="absolute inset-0 flex" style="background: linear-gradient(105deg, #0d0d10 48%, #ffffff 48.5%);">
                        <div class="w-[34px] h-full bg-[#151519] p-2 space-y-1.5 border-r border-[#232329]">
                          <div class="h-1.5 w-4 rounded bg-[#2e2e36]"></div>
                          <div class="h-1.5 w-5 rounded bg-[#2e2e36]"></div>
                          <div class="h-1.5 w-3.5 rounded bg-[#2e2e36]"></div>
                        </div>
                        <div class="flex-1 p-3 flex flex-col justify-between">
                          <div class="space-y-1.5">
                            <div class="h-2 w-16 rounded bg-[#71717a]"></div>
                            <div class="h-2 w-12 rounded bg-[#a1a1aa]"></div>
                          </div>
                          <div class="h-2.5 w-7 rounded" style="background: var(--accent-violet);"></div>
                        </div>
                      </div>
                    </div>
                    <div class="text-[11.5px] mt-1.5" style="color: var(--text-muted);">System</div>
                  </div>
                </div>
              </div>

              <div class="py-4 border-b" style="border-color: var(--border-color);">
                <div class="text-[12px] font-semibold" style="color: var(--text-primary);">Accent color</div>
                <div class="text-[11.5px] mt-0.5 mb-3" style="color: var(--text-muted);">
                  Primary buttons, focus rings, meters, attention dots and the split view.
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  ${Object.entries(S.model.ACCENTS).map(([key, hex]) => ({ key, hex, label: key[0].toUpperCase() + key.slice(1) })).map(item => `
                    <button data-act="setStanzaAccent" data-arg="${item.key}" class="px-3 py-1.5 rounded-lg ${acc === item.key ? 'border-2 font-semibold' : 'border'} flex items-center gap-2 text-[11.5px] transition-all" style="border-color: ${acc === item.key ? item.hex : 'var(--border-card)'}; ${acc === item.key ? `background: color-mix(in srgb, ${item.hex} 10%, transparent);` : ''} color: var(--text-primary);">
                      <span class="w-2.5 h-2.5 rounded-full" style="background: ${item.hex};"></span>
                      <span>${item.label}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="py-4">
                <div class="text-[12px] font-semibold" style="color: var(--text-primary);">Terminal text size</div>
                <div class="text-[11.5px] mt-0.5 mb-3" style="color: var(--text-muted);">For every session.</div>
                <div class="flex items-center gap-3">
                  <button data-act="changeTermSize" data-arg="-1" class="w-6 h-6 rounded-md border flex items-center justify-center hover:opacity-80" style="border-color: var(--border-card); color: var(--text-secondary);">${ICONS.minus}</button>
                  <span class="mono text-[12px] font-semibold w-12 text-center" style="color: var(--text-primary);">${state.fontSizePx} px</span>
                  <button data-act="changeTermSize" data-arg="1" class="w-6 h-6 rounded-md border flex items-center justify-center hover:opacity-80" style="border-color: var(--border-card); color: var(--text-secondary);">${ICONS.plus}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens['settings-appearance'] = screen;
})(window.Stanza);
