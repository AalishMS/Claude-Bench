/* Split view: two Claude sessions from two projects side by side, idle. Also the frame both split screens share. */
(function (S) {
  'use strict';

  const ICONS = S.icons;
  const model = S.model;
  const state = model.state;

  /* One pane: a header (status dot, title, ×) over its terminal. The focused pane is lit, the other dimmed. */
  function pane(p, i, focused) {
    return `
      <div data-act="setSplitFocus" data-arg="${i}" class="flex flex-col min-w-0 overflow-hidden transition-opacity ${i === 0 ? 'border-r' : ''} ${focused ? 'opacity-100' : 'opacity-60'}" style="border-color: var(--border-color);">
        <div class="h-[26px] px-2.5 flex items-center justify-between border-b shrink-0" style="border-color: var(--border-color);">
          <span class="flex items-center gap-1.5 text-[11px] min-w-0 ${focused ? 'font-semibold' : ''}" style="color: var(--text-primary);">
            <span class="w-1.5 h-1.5 rounded-full shrink-0 ${p.working ? 'dot-working-pulse' : ''}" style="background: ${p.working ? 'var(--dot-amber)' : 'var(--dot-green)'};"></span>
            <span class="truncate">${p.title}</span>
            <span class="font-normal shrink-0" style="color: var(--text-muted);">· ${p.project}</span>
          </span>
          <span data-act="selectView" data-arg="${p.close}" class="cursor-pointer hover:opacity-80 shrink-0" style="color: var(--text-muted);" title="Close pane">${ICONS.close}</span>
        </div>
        ${p.body}
      </div>
    `;
  }

  /* The terminal area of a split: two panes and the divider between them (dragged in page/actions.js). */
  S.mock.splitFrame = (ctx, panes) => {
    const ratio = ctx.live ? state.splitRatio : 50;
    const focus = ctx.live ? state.focusedSplitPane : 0;
    return `
      <main data-split class="flex-1 grid relative overflow-hidden" style="grid-template-columns: ${ratio}% minmax(0, 1fr); background: var(--bg-main);">
        ${panes.map((p, i) => pane(p, i, focus === i)).join('')}
        <div data-drag="split" class="split-drag" style="left: ${ratio}%;" title="Drag to resize (Ctrl+Alt+←/→)"></div>
      </main>
    `;
  };

  /* The prompt box at the bottom of a pane. */
  S.mock.splitPrompt = (hint, cursor) => `
    <div class="pt-2">
      <div class="border-t" style="border-color: var(--border-term-rule);"></div>
      <div class="py-0.5">&gt; ${cursor ? '<span class="inline-block w-2 h-3.5 align-middle border border-current term-cursor"></span>' : ''}</div>
      <div class="border-t" style="border-color: var(--border-term-rule);"></div>
      <div class="pt-1 pl-3 truncate">
        <span data-act="cycleAutoMode" class="cursor-pointer" style="color: var(--text-auto-mode);">${model.autoModeText()}</span>
        <span style="color: var(--text-muted);"> (shift+tab to cycle) · ${hint}</span>
      </div>
    </div>
  `;

  function screen(ctx) {
    const c = (txt) => `<span style="color: var(--text-code);">${txt}</span>`;
    const muted = (txt) => `<span style="color: var(--text-muted);">${txt}</span>`;

    const left = `
      <div class="flex-1 flex flex-col justify-between p-3 mono text-[11px] leading-[1.44] overflow-y-auto">
        <div class="space-y-2">
          <div>${muted('✻ Cooked for 29s · done 10:30 PM')}</div>
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
          <div>${muted('✻ Baked for 19s · done 10:31 PM')}</div>
        </div>
        ${S.mock.splitPrompt('← for agents', false)}
      </div>
    `;

    const right = `
      <div class="flex-1 flex flex-col justify-between p-3 mono text-[11px] leading-[1.44] overflow-y-auto">
        <div class="space-y-2">
          <div class="px-1.5 py-1" style="background: var(--bg-prompt-bar);">
            &gt; Read every file under lib/ and test/ one at a time, without skipping any, then a summary per folder. Read only, no edits.
          </div>
          <div>● I split the reads across two agents: ${c('lib/')} in one, ${c('test/')} in the other.</div>
          <div class="pl-2.5">
            <strong>${c('lib/data/')}:</strong> Hive boxes and their adapters. ${c('WorkoutRepository')} is the only writer, and ${c('SyncQueue')} replays offline edits in order once the phone is back online.
          </div>
          <div class="pl-2.5">
            <strong>${c('lib/widgets/workout/')}:</strong> The live logger's widgets, which the plan editor also reuses. ${c('PlanSwipeRegion')} steps between plans on horizontal swipes, ${c('ExerciseCard')} wraps each exercise section, and ${c('SetEntryTable')} is the weight, reps, and RPE grid.
          </div>
          <div class="pl-2.5">
            <strong>${c('lib/coach/')}:</strong> The AI coach: ${c('CoachService')} builds the prompt from the last four weeks, ${c('coach_review.dart')} renders its suggestions.
          </div>
          <div class="pl-2.5">
            <strong>${c('test/')} (root, 52 files):</strong> Mostly ${c('testWidgets')} tests with ${c('MaterialApp')} and ${c('Provider')}, plus pure unit tests for the OKLCh solver, set history, and sync sequencing.
          </div>
          <div class="pl-2.5">
            <strong>${c('test/support/')}:</strong> Shared helpers (${c('hive_test_harness.dart')}, ${c('pump_with_storage.dart')}, ${c('test_fonts.dart')}, ${c('coach_fixtures.dart')}).
          </div>
          <div>● Agent "Read test/ files m through z and support" finished · 1m 31s</div>
          <div>${muted('✻ Worked for 2m 4s · done 10:32 PM')}</div>
        </div>
        ${S.mock.splitPrompt('/tasks to see subagents', true)}
      </div>
    `;

    return S.mock.splitFrame(ctx, [
      { title: 'File summaries for src and test', project: 'Claude Terminal', close: 'main', body: left },
      { title: 'Project layout and source file summaries', project: 'gymapp-offline', close: 'main', body: right },
    ]);
  }

  S.mock.screens.split = screen;
})(window.Stanza);
