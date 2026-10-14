/* Split view with three panes, idle. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const model = S.model;
  const state = model.state;

  function screen(ctx, theme) {
    const autoModeText = model.autoModeText();
    const c = (txt) => `<span style="color: var(--text-code);">${txt}</span>`;
    const fPane = ctx.live ? state.focusedSplitPane : 0;
    return `
      <main class="flex-1 grid grid-cols-2 overflow-hidden" style="background: var(--bg-main);">
        <div data-act="setSplitFocus" data-arg="0" class="flex flex-col border-r overflow-hidden transition-opacity ${fPane === 0 ? 'opacity-100' : 'opacity-65'}" style="border-color: var(--border-color);">
          <div class="h-[26px] px-2.5 flex items-center justify-between border-b shrink-0" style="border-color: var(--border-color);">
            <span class="flex items-center gap-1.5 text-[11px] ${fPane === 0 ? 'font-semibold' : ''}" style="color: var(--text-primary);">
              <span class="w-1.5 h-1.5 rounded-full" style="background: var(--dot-green);"></span>
              <span>File summaries for src and test</span>
            </span>
            <span data-act="selectView" data-arg="main" class="cursor-pointer hover:opacity-80" style="color: var(--text-muted);">${ICONS.close}</span>
          </div>

          <div class="flex-1 flex flex-col justify-between p-3 mono text-[11px] leading-[1.44] overflow-y-auto">
            <div class="space-y-2">
              <div style="color: var(--text-muted);">✻ Cooked for 29s · done 10:30 PM</div>
              <div class="px-1.5 py-1" style="background: var(--bg-prompt-bar);">
                &gt; Read every file under src/, test/ and scripts/ one at a time, without skipping any, then give a one-paragraph summary per folder. Read only, no edits.
              </div>
              <div class="pl-3" style="color: var(--text-muted);">
                Searched for <strong style="color: var(--text-primary);">1</strong> pattern, read <strong style="color: var(--text-primary);">6</strong> files
              </div>
              <div>
                ● I re-read the six ${c('scripts/')} files one at a time. The ${c('src/')} and ${c('test/')} files were already read in full earlier in this conversation. Nothing was edited.
              </div>
              <div class="pl-2.5">
                <strong>${c('src/')} (top level):</strong> The Electron main process lives in ${c('main.js')} (1524 lines), which owns the window, node-pty sessions, ${c('state.json')} persistence, git and port scans, transcript and image reads, and the self-update flow. ${c('preload.js')} is a thin ${c('contextBridge')} wrapper. ${c('renderer.js')} (3169 lines) is the whole UI as one plain browser script.
              </div>
              <div class="pl-2.5">
                <strong>${c('src/lib/')}:</strong> Three pure modules with no Electron or DOM dependencies: ${c('parse.js')}, ${c('images.js')}, and ${c('ui.js')}.
              </div>
              <div class="pl-2.5">
                <strong>${c('test/')}:</strong> Three ${c('node:test')} files (${c('parse.test.js')}, ${c('images.test.js')}, ${c('ui.test.js')}) covering every parser and helper.
              </div>
              <div class="pl-2.5">
                <strong>${c('scripts/')}:</strong> Install, update and packaging helpers (${c('install.ps1')}, ${c('install.sh')}, ${c('update.ps1')}, ${c('update.sh')}, ${c('create-shortcut.ps1')}).
              </div>
              <div style="color: var(--text-muted);">✻ Baked for 19s · done 10:31 PM</div>
            </div>

            <div class="pt-2">
              <div class="border-t" style="border-color: var(--border-term-rule);"></div>
              <div class="py-0.5">&gt;</div>
              <div class="border-t" style="border-color: var(--border-term-rule);"></div>
              <div class="pt-1 pl-3">
                <span data-act="cycleAutoMode" class="cursor-pointer" style="color: var(--text-auto-mode);">${autoModeText}</span>
                <span style="color: var(--text-muted);"> (shift+tab to cycle) · ← for agents</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col overflow-hidden">
          <div data-act="setSplitFocus" data-arg="1" class="h-[58%] flex flex-col border-b overflow-hidden transition-opacity ${fPane === 1 ? 'opacity-100' : 'opacity-60'}" style="border-color: var(--border-color);">
            <div class="h-[26px] px-2.5 flex items-center justify-between border-b shrink-0" style="border-color: var(--border-color);">
              <span class="flex items-center gap-1.5 text-[11px] ${fPane === 1 ? 'font-semibold' : ''}">
                <span class="w-1.5 h-1.5 rounded-full" style="background: var(--dot-green);"></span>
                <span>Project layout and source file summaries</span>
              </span>
              <span style="color: var(--text-muted);">${ICONS.close}</span>
            </div>
            <div class="flex-1 flex flex-col justify-between p-3 mono text-[11px] leading-[1.44] overflow-y-auto">
              <div class="space-y-2">
                <div class="pl-2.5">
                  <strong>${c('lib/widgets/workout/')}:</strong> The live logger's widgets, which the plan editor also reuses. ${c('PlanSwipeRegion')} steps between plans on horizontal swipes, ${c('ExerciseCard')} wraps each exercise section, and ${c('SetEntryTable')} is the weight, reps, and RPE grid.
                </div>
                <div class="pl-2.5">
                  <strong>${c('test/')} (root, 52 files):</strong> Mostly ${c('testWidgets')} tests with ${c('MaterialApp')} and ${c('Provider')}, plus pure unit tests for the OKLCh solver, set history, and sync sequencing.
                </div>
                <div class="pl-2.5">
                  <strong>${c('test/support/')}:</strong> Shared helpers (${c('hive_test_harness.dart')}, ${c('pump_with_storage.dart')}, ${c('test_fonts.dart')}, ${c('coach_fixtures.dart')}).
                </div>
                <div>● Agent "Read test/ files m through z and support" finished · 1m 31s</div>
              </div>
              <div class="pt-1">
                <div class="border-t" style="border-color: var(--border-term-rule);"></div>
                <div class="py-0.5">&gt; <span class="inline-block w-2 h-3.5 align-middle border border-current term-cursor"></span>ait for the test agent to finish</div>
                <div class="border-t" style="border-color: var(--border-term-rule);"></div>
                <div class="pt-1 pl-3">
                  <span style="color: var(--text-auto-mode);">${autoModeText}</span>
                  <span style="color: var(--text-muted);"> (shift+tab to cycle) · /tasks to see subagents</span>
                </div>
              </div>
            </div>
          </div>

          <div data-act="setSplitFocus" data-arg="2" class="flex-1 flex flex-col transition-opacity ${fPane === 2 ? 'opacity-100' : 'opacity-70'}">
            <div class="h-[26px] px-2.5 flex items-center justify-between border-b shrink-0" style="border-color: var(--border-color);">
              <span class="flex items-center gap-1.5 text-[11px] ${fPane === 2 ? 'font-semibold' : ''}">
                <span class="w-1.5 h-1.5 rounded-full" style="background: var(--dot-green);"></span>
                <span>PowerShell</span>
              </span>
              <span style="color: var(--text-muted);">${ICONS.close}</span>
            </div>
            <div class="p-3 mono text-[11.5px]">
              PS E:\\pet_project\\Claude Terminal&gt; <span class="inline-block w-2 h-3.5 align-middle border border-current term-cursor"></span>
            </div>
          </div>
        </div>
      </main>
    `;
  }

  S.mock.screens['split'] = screen;
})(window.Stanza);
