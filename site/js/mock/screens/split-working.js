/* Split view with three panes, two of them working. */
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
            <span class="flex items-center gap-1.5 text-[11px] font-semibold" style="color: var(--text-primary);">
              <span class="w-1.5 h-1.5 rounded-full dot-working-pulse" style="background: var(--dot-amber);"></span>
              <span>File summaries for src and test</span>
            </span>
            <span data-act="selectView" data-arg="main-working" class="cursor-pointer hover:opacity-80" style="color: var(--text-muted);">${ICONS.close}</span>
          </div>

          <div class="flex-1 flex flex-col justify-between p-3 mono text-[12px] leading-[1.42] overflow-hidden">
            <div>
              <div class="overflow-hidden pl-1 mb-3">
                <table class="ascii-table">
                  <tr>
                    <td class="w-[46px]">204</td>
                    <td class="w-[300px]">parseModelEffort follows /model, /effort and replies</td>
                    <td>Checks the last<br/>across messages</td>
                  </tr>
                  <tr>
                    <td>218</td>
                    <td>agentDone: handback, final text reply or interrupt = finished</td>
                    <td>Checks finished<br/>cases for sub</td>
                  </tr>
                  <tr>
                    <td>248</td>
                    <td>lastModel takes the last real reply</td>
                    <td>Checks synthetic<br/>are ignored.</td>
                  </tr>
                  <tr>
                    <td>273</td>
                    <td>parseMcpList maps ${c('claude mcp list')} lines to statuses</td>
                    <td>Checks each<br/>status.</td>
                  </tr>
                  <tr>
                    <td>297</td>
                    <td>remapSplits follows dropped tabs and drops groups left with one member</td>
                    <td>Checks split<br/>tabs are dropped</td>
                  </tr>
                </table>
              </div>

              <div class="mb-2.5" style="color: var(--text-muted);">✻ Cooked for 29s · done 10:30 PM</div>

              <div class="px-1.5 py-1 mb-2.5 whitespace-nowrap overflow-hidden" style="background: var(--bg-prompt-bar);">
                &gt; Read every file under src/, test/ and scripts/ one at a time, without skipping<br/>
                &nbsp;&nbsp;one-paragraph summary per folder. Read only, no edits.
              </div>

              <div class="pl-3.5 mb-2.5">
                <div>Reading <strong>scripts\\install.ps1</strong></div>
                <div style="color: var(--text-muted);">⎿ &nbsp;scripts\\rename-handoff.js</div>
              </div>

              <div class="mb-1">
                <div>
                  <span data-live-spinner="Enchanting" style="color: var(--text-computing);">${model.spinnerText('Enchanting')}</span>
                  <span data-live-counter="split1" style="color: var(--text-muted);">${model.counterText('split1')}</span>
                </div>
                <div class="pl-3.5 truncate" style="color: var(--text-muted);">
                  ⎿ &nbsp;Tip: Use /permissions to pre-approve and pre-deny bash, edit, and MCP tools
                </div>
              </div>
            </div>

            <div>
              <div class="border-t" style="border-color: var(--border-term-rule);"></div>
              <div class="py-0.5">&gt;</div>
              <div class="border-t" style="border-color: var(--border-term-rule);"></div>
              <div class="pt-1 pl-3 text-[12px] truncate">
                <span data-act="cycleAutoMode" class="cursor-pointer" style="color: var(--text-auto-mode);">${autoModeText}</span>
                <span style="color: var(--text-muted);"> (shift+tab to cycle) · <span data-act="selectView" data-arg="split" class="cursor-pointer hover:underline">esc to interrupt</span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col overflow-hidden">
          <div data-act="setSplitFocus" data-arg="1" class="h-[58%] flex flex-col border-b overflow-hidden transition-opacity ${fPane === 1 ? 'opacity-100' : 'opacity-65'}" style="border-color: var(--border-color);">
            <div class="h-[26px] px-2.5 flex items-center justify-between border-b shrink-0" style="border-color: var(--border-color);">
              <span class="flex items-center gap-1.5 text-[11px] ${fPane === 1 ? 'font-semibold' : ''}">
                <span class="w-1.5 h-1.5 rounded-full dot-working-pulse" style="background: var(--dot-amber);"></span>
                <span>Project layout and source file summaries</span>
              </span>
              <span style="color: var(--text-muted);">${ICONS.close}</span>
            </div>
            <div class="flex-1 flex flex-col justify-between p-3 mono text-[12px] leading-[1.42] overflow-hidden">
              <div class="space-y-2.5">
                <div class="px-1.5 py-0.5 whitespace-nowrap overflow-hidden" style="background: var(--bg-prompt-bar);">
                  &gt; Read every file under lib/ and test/ one at a time, without skipping any<br/>
                  &nbsp;&nbsp;summary per folder. Read only, no edits.
                </div>
                <div class="whitespace-nowrap">● I'll start by counting files per folder so the reads can be split sensibly</div>
                <div>
                  <div>● Counting files per folder under lib and testing</div>
                  <div class="pl-3.5 whitespace-nowrap" style="color: var(--text-muted);">
                    ⎿ &nbsp;$ cd "E:/pet_project/OpenGym/gymapp-offline" &amp;&amp; echo "lib total: $(find<br/>
                    &nbsp;&nbsp;&nbsp;-l)" &amp;&amp; echo "test total: $(find test -type f | wc -l)"
                  </div>
                </div>
                <div>
                  <div>
                    <span data-live-spinner="Kerfuffling" style="color: var(--text-computing);">${model.spinnerText('Kerfuffling')}</span>
                    <span data-live-counter="split2" style="color: var(--text-muted);">${model.counterText('split2')}</span>
                  </div>
                  <div class="pl-3.5 whitespace-nowrap" style="color: var(--text-muted);">
                    ⎿ &nbsp;Tip: Did you know you can drag and drop image files into your terminal
                  </div>
                </div>
              </div>

              <div>
                <div class="border-t" style="border-color: var(--border-term-rule);"></div>
                <div class="py-0.5">&gt; <span class="inline-block w-2 h-3.5 align-middle border border-current term-cursor"></span></div>
                <div class="border-t" style="border-color: var(--border-term-rule);"></div>
                <div class="pt-1 pl-3 text-[12px] whitespace-nowrap">
                  <span style="color: var(--text-auto-mode);">${autoModeText}</span>
                  <span style="color: var(--text-muted);"> (shift+tab to cycle) · esc to interrupt</span>
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

  S.mock.screens['split-working'] = screen;
})(window.Stanza);
