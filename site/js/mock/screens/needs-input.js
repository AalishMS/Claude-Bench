/* A Claude session in gymapp-offline stopped on a permission prompt. The options answer it (click, or ↑/↓/Enter/Esc
   while the window has focus, page/actions.js); the toast it raised is in mock/overlays.js. */
(function (S) {
  'use strict';

  const model = S.model;
  const state = model.state;

  const COMMAND = 'flutter test test/coach_review_test.dart';
  const OPTIONS = [
    'Yes',
    'Yes, and don\'t ask again for <strong>flutter test</strong> commands in E:\\pet_project\\OpenGym\\gymapp-offline',
    'No, and tell Claude what to do differently <span style="color: var(--text-muted);">(esc)</span>',
  ];

  function screen(ctx) {
    const c = txt => `<span style="color: var(--text-code);">${txt}</span>`;
    const muted = txt => `<span style="color: var(--text-muted);">${txt}</span>`;
    const answer = ctx.live ? state.promptAnswer : null;
    const cursor = ctx.live ? state.promptCursor : 0;
    const del = txt => `<div class="whitespace-pre" style="background: var(--diff-del);">${txt}</div>`;
    const add = txt => `<div class="whitespace-pre" style="background: var(--diff-add);">${txt}</div>`;

    const dialog = `
      <div class="mt-3 pt-2 border-t" style="border-color: var(--text-permission);">
        <div class="font-bold" style="color: var(--text-permission);">Bash command</div>
        <div class="mt-2 pl-4">${COMMAND}</div>
        <div class="pl-4">${muted('Run the coach review tests')}</div>
        <div class="mt-2">Do you want to proceed?</div>
        <div class="mt-0.5">
          ${OPTIONS.map((text, i) => `
            <div data-act="answerPrompt" data-arg="${i}" class="flex gap-2 px-1 -mx-1 rounded cursor-pointer stanza-row-hover" style="${i === cursor ? 'color: var(--text-permission);' : ''}">
              <span class="w-3 shrink-0">${i === cursor ? '❯' : ''}</span>
              <span>${i + 1}. ${text}</span>
            </div>
          `).join('')}
        </div>
        <div class="mt-2">${muted('Esc to cancel · Tab to amend')}</div>
      </div>
    `;

    const result = answer === 2 ? `
      <div class="pl-3.5">${muted('⎿ &nbsp;Interrupted · What should Claude do instead?')}</div>
    ` : `
      <div class="pl-3.5">${muted('⎿ &nbsp;')}00:07 +14: ${'<span style="color: var(--dot-green);">All tests passed!</span>'}</div>
      <div class="mt-2.5">● All 14 coach review tests pass, including the new empty-week one. The crash came from ${c('reduce()')} on an empty list at ${c('coach_review.dart:88')}; an empty week now shows ${c('CoachEmptyWeek')} instead.</div>
      <div class="mt-2.5">${muted('✻ Worked for 1m 3s · done 10:47 PM')}</div>
    `;

    const promptBox = `
      <div class="pt-3">
        <div class="border-t" style="border-color: var(--border-term-rule);"></div>
        <div class="py-1 flex items-center gap-1.5"><span>&gt;</span><span class="inline-block w-2 h-3.5 bg-current term-cursor"></span></div>
        <div class="border-t" style="border-color: var(--border-term-rule);"></div>
        <div class="pt-1.5 pl-3.5 text-[11.5px]">
          <span data-act="cycleAutoMode" class="cursor-pointer hover:underline" style="color: var(--text-auto-mode);">${model.autoModeText()}</span>
          ${muted(' (shift+tab to cycle) · ← for agents')}
        </div>
      </div>
    `;

    return `
      <main data-autoscroll class="flex-1 min-w-0 flex flex-col justify-between px-4 pt-4 pb-2 mono leading-[1.42] overflow-y-auto" style="background: var(--bg-main); color: var(--text-primary); font-size: var(--stanza-term-size);">
        <div class="pr-2">
          <div class="px-1.5 py-0.5 mb-2.5" style="background: var(--bg-prompt-bar);">
            &gt; The coach review screen crashes when last week has no sets. Fix it and add a test for an empty week.
          </div>

          <div>● Read(${c('lib/coach/coach_review.dart')})</div>
          <div class="pl-3.5 mb-1.5">${muted('⎿ &nbsp;Read 212 lines')}</div>

          <div>● Update(${c('lib/coach/coach_review.dart')})</div>
          <div class="pl-3.5">${muted('⎿ &nbsp;Updated lib/coach/coach_review.dart with 2 additions and 1 removal')}</div>
          <div class="pl-9 mb-1.5 text-[0.94em]">
            ${del(' 88 -    final best = week.sets.reduce(_heavier);')}
            ${add(' 88 +    if (week.sets.isEmpty) return const CoachEmptyWeek();')}
            ${add(' 89 +    final best = week.sets.reduce(_heavier);')}
          </div>

          <div>● Update(${c('test/coach_review_test.dart')})</div>
          <div class="pl-3.5 mb-1.5">${muted('⎿ &nbsp;Added 1 test: \'shows the empty-week card when no sets were logged\'')}</div>

          <div class="mb-1.5">● Now the coach tests.</div>

          <div>● Bash(${COMMAND})</div>
          ${answer === null ? `<div class="pl-3.5">${muted('⎿ &nbsp;Waiting for permission…')}</div>${dialog}` : result}
        </div>
        ${answer === null ? '' : promptBox}
      </main>
    `;
  }

  S.mock.screens['needs-input'] = screen;
  S.mock.PROMPT_OPTIONS = OPTIONS.length;
})(window.Stanza);
