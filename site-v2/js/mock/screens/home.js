/* Home / launchpad screen (also shown behind the new-session menu). */
(function (S) {
  'use strict';

  const ICONS = S.icons;

  function screen(ctx, theme) {
    return `
      <main class="flex-1 flex flex-col items-center justify-center px-6 select-none overflow-y-auto" style="background: var(--bg-main);">
        <div class="w-full max-w-[516px] -mt-2">
          <div class="text-center mb-6">
            ${ICONS.stanzaHero}
            <h2 class="text-[21px] font-semibold tracking-tight" style="color: var(--text-primary);">What should we build?</h2>
            <p class="text-[12.5px] mt-1" style="color: var(--text-muted);">Pick a project to start a Claude session.</p>
          </div>

          <div class="flex items-center justify-between mb-2 px-0.5">
            <span class="text-[11.5px] font-medium" style="color: var(--text-muted);">Projects</span>
            <button data-act="selectView" data-arg="new-menu" class="flex items-center gap-1.5 text-[11.5px] font-medium hover:opacity-80" style="color: var(--text-primary);">
              ${ICONS.folderPlus}
              <span>Add project</span>
            </button>
          </div>

          <div class="rounded-[10px] border overflow-hidden" style="border-color: var(--border-card); background: var(--bg-main);">
            <div data-act="selectView" data-arg="main" class="px-3.5 py-3 flex items-center justify-between border-b cursor-pointer transition-colors" style="background: var(--bg-card-active); border-color: var(--border-card);">
              <div class="flex items-center gap-3">
                <div class="w-[30px] h-[30px] rounded-lg border flex items-center justify-center shrink-0" style="background: var(--bg-main); border-color: var(--border-card); color: var(--text-secondary);">
                  ${ICONS.chat}
                </div>
                <div>
                  <div class="text-[12.5px] font-semibold leading-tight" style="color: var(--text-primary);">Chats</div>
                  <div class="text-[11px] mt-0.5" style="color: var(--text-muted);">C:\\Users\\Aalish\\Claude Chats</div>
                </div>
              </div>
              <span style="color: var(--text-muted);">${ICONS.arrowRight}</span>
            </div>

            <div data-act="selectView" data-arg="main" class="px-3.5 py-3 flex items-center justify-between border-b cursor-pointer stanza-row-hover transition-colors" style="border-color: var(--border-card);">
              <div class="flex items-center gap-3">
                <div class="w-[30px] h-[30px] rounded-lg border flex items-center justify-center shrink-0" style="background: var(--bg-sidebar); border-color: var(--border-card); color: var(--text-muted);">
                  ${ICONS.folder}
                </div>
                <div>
                  <div class="text-[12.5px] font-semibold leading-tight" style="color: var(--text-primary);">Claude Terminal</div>
                  <div class="text-[11px] mt-0.5" style="color: var(--text-muted);">E:\\pet_project\\Claude Terminal</div>
                </div>
              </div>
              <div class="flex items-center gap-2 text-[11px]">
                <span class="flex items-center gap-1" style="color: var(--text-secondary);">${ICONS.gitBranch} main</span>
                <span style="color: var(--text-amber);">6 changed</span>
              </div>
            </div>

            <div data-act="selectView" data-arg="main-working" class="px-3.5 py-3 flex items-center justify-between border-b cursor-pointer stanza-row-hover transition-colors" style="border-color: var(--border-card);">
              <div class="flex items-center gap-3">
                <div class="w-[30px] h-[30px] rounded-lg border flex items-center justify-center shrink-0" style="background: var(--bg-sidebar); border-color: var(--border-card); color: var(--text-muted);">
                  ${ICONS.folder}
                </div>
                <div>
                  <div class="text-[12.5px] font-semibold leading-tight" style="color: var(--text-primary);">gymapp-offline</div>
                  <div class="text-[11px] mt-0.5" style="color: var(--text-muted);">E:\\pet_project\\OpenGym\\gymapp-offline</div>
                </div>
              </div>
              <div class="flex items-center gap-2 text-[11px]">
                <span class="flex items-center gap-1" style="color: var(--text-secondary);">${ICONS.gitBranch} feat/ai-coach</span>
                <span style="color: var(--text-amber);">2 changed</span>
              </div>
            </div>

            <div data-act="selectView" data-arg="split" class="px-3.5 py-3 flex items-center justify-between cursor-pointer stanza-row-hover transition-colors">
              <div class="flex items-center gap-3">
                <div class="w-[30px] h-[30px] rounded-lg border flex items-center justify-center shrink-0" style="background: var(--bg-sidebar); border-color: var(--border-card); color: var(--text-muted);">
                  ${ICONS.folder}
                </div>
                <div>
                  <div class="text-[12.5px] font-semibold leading-tight" style="color: var(--text-primary);">Hot garbage</div>
                  <div class="text-[11px] mt-0.5" style="color: var(--text-muted);">E:\\pet_project\\Hot garbage</div>
                </div>
              </div>
              <span class="text-[11px]" style="color: var(--text-faint);">not a git repository</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2 mt-5 text-[11px]" style="color: var(--text-muted);">
            <span data-act="selectView" data-arg="new-menu" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80"><kbd class="kbd-pill">Ctrl+T</kbd> new session</span>
            <span data-act="selectView" data-arg="split" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80"><kbd class="kbd-pill">Ctrl+Tab</kbd> switch</span>
            <span data-act="toggleLeftSidebar" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80"><kbd class="kbd-pill">Ctrl+S</kbd> sidebar</span>
            <span data-act="toggleRightSidebar" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80"><kbd class="kbd-pill">Ctrl+Shift+S</kbd> side panel</span>
            <span data-act="selectView" data-arg="settings-appearance" class="flex items-center gap-1.5 cursor-pointer hover:opacity-80"><kbd class="kbd-pill">Ctrl+,</kbd> settings</span>
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens.home = S.mock.screens['new-menu'] = screen;
})(window.Stanza);
