/* Split view with both sessions working. The frame and prompt box come from screens/split.js. */
(function (S) {
  'use strict';

  const model = S.model;

  function screen(ctx) {
    const c = (txt) => `<span style="color: var(--text-code);">${txt}</span>`;

    const left = `
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
        ${S.mock.splitPrompt('<span data-act="selectView" data-arg="split" class="cursor-pointer hover:underline">esc to interrupt</span>', false)}
      </div>
    `;

    const right = `
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
            <div class="pl-3.5" style="color: var(--text-muted);">⎿ &nbsp;lib total: 143 · test total: 61</div>
          </div>
          <div>
            <div>● 2 agents launched</div>
            <div class="pl-3.5 whitespace-nowrap" style="color: var(--text-muted);">⎿ &nbsp;code-scout(Read lib/ in order) · 38 tool uses</div>
            <div class="pl-3.5 whitespace-nowrap" style="color: var(--text-muted);">&nbsp;&nbsp;&nbsp;code-scout(Read test/ files a through l) · 21 tool uses</div>
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
        ${S.mock.splitPrompt('esc to interrupt', true)}
      </div>
    `;

    return S.mock.splitFrame(ctx, [
      { title: 'File summaries for src and test', project: 'Claude Terminal', close: 'main-working', body: left, working: true },
      { title: 'Project layout and source file summaries', project: 'gymapp-offline', close: 'main-working', body: right, working: true },
    ]);
  }

  S.mock.screens['split-working'] = screen;
})(window.Stanza);
