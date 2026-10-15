'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('../src/lib/parse');

const jl = (...objs) => objs.map((o) => (typeof o === 'string' ? o : JSON.stringify(o))).join('\n');

// ------------------------------------------------------------------ git ----

test('parseGitStatus counts staged, modified, untracked, conflicts and ahead/behind', () => {
  const out = [
    '# branch.oid 0123456789abcdef',
    '# branch.head main',
    '# branch.upstream origin/main',
    '# branch.ab +2 -1',
    '1 .M N... 100644 100644 100644 aaa bbb src/a.js',
    '1 A. N... 000000 100644 100644 000 ccc src/b.js',
    '1 MM N... 100644 100644 100644 ddd eee src/c.js',
    '2 R. N... 100644 100644 100644 fff ggg R100 new.js\told.js',
    'u UU N... 100644 100644 100644 100644 h1 h2 h3 conflict.js',
    '? notes.txt',
    '? tmp/',
    '',
  ].join('\n');
  assert.deepEqual(p.parseGitStatus(out), {
    branch: 'main', detached: false, upstream: 'origin/main', ahead: 2, behind: 1,
    staged: 3, modified: 2, untracked: 2, conflicts: 1, dirty: 8,
  });
});

test('parseGitStatus shows the short commit when detached, nothing for a fresh repo', () => {
  const detached = p.parseGitStatus('# branch.oid 0123456789abcdef\n# branch.head (detached)\n');
  assert.equal(detached.branch, '0123456');
  assert.equal(detached.detached, true);
  const fresh = p.parseGitStatus('# branch.oid (initial)\n# branch.head main\n');
  assert.equal(fresh.branch, 'main');
  assert.equal(fresh.upstream, null);
  assert.equal(fresh.dirty, 0);
});

// ---------------------------------------------------------------- ports ----

test('parseNetstat keeps listeners only, whatever the localized state text', () => {
  const out = [
    '',
    'Active Connections',
    '',
    '  Proto  Local Address          Foreign Address        State           PID',
    '  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING       1234',
    '  TCP    127.0.0.1:3000         0.0.0.0:0              ABHÖREN         5678',
    '  TCP    192.168.1.5:50123      140.82.112.4:443       ESTABLISHED     9999',
    '  TCP    127.0.0.1:50200        127.0.0.1:3000         ESTABLISHED     9998',
    '  TCP    [::]:445               [::]:0                 LISTENING       4',
    '  TCP    [::1]:5173             [::]:0                 LISTENING       4321',
    '  TCP    [fe80::1%12]:8080      [::]:0                 LISTENING       777',
    '  UDP    0.0.0.0:5353           *:*                                    888',
  ].join('\r\n');
  assert.deepEqual(p.parseNetstat(out), [
    { LocalAddress: '0.0.0.0', LocalPort: 135, OwningProcess: 1234 },
    { LocalAddress: '127.0.0.1', LocalPort: 3000, OwningProcess: 5678 },
    { LocalAddress: '::', LocalPort: 445, OwningProcess: 4 },
    { LocalAddress: '::1', LocalPort: 5173, OwningProcess: 4321 },
    { LocalAddress: 'fe80::1', LocalPort: 8080, OwningProcess: 777 },
  ]);
  assert.deepEqual(p.parseNetstat(''), []);
});

test('parentPid ignores a "parent" created after its child (recycled pid)', () => {
  const procs = new Map([
    [10, { ProcessId: 10, ParentProcessId: 1, T: 1000 }],
    [20, { ProcessId: 20, ParentProcessId: 10, T: 2000 }], // real child of 10
    [30, { ProcessId: 30, ParentProcessId: 40, T: 3000 }], // its parent 40 exited and the pid was reused
    [40, { ProcessId: 40, ParentProcessId: 1, T: 9000 }],
  ]);
  assert.equal(p.parentPid(procs, procs.get(20)), 10);
  assert.equal(p.parentPid(procs, procs.get(30)), 0);
  assert.equal(p.parentPid(procs, { ProcessId: 50, ParentProcessId: 99, T: 1 }), 99); // parent not in the table
});

test('parseMsysPs maps Windows pids to their MSYS parent\'s Windows pid', () => {
  // `npx remotion studio` from Claude's Bash tool: Windows pid 19748's parent (the fork child) has exited.
  const out = [
    '      PID    PPID    PGID     WINPID   TTY         UID    STIME COMMAND',
    '      249       1     249      10668  ?         197609 09:49:33 /usr/bin/bash',
    '      258     250     249      20188  ?         197609 09:49:33 /c/Program Files/nodejs/node',
    'I     316       1     316       2976  pty0      197609 09:56:18 /usr/bin/bash',
    '      250     249     249      19748  ?         197609 09:49:33 /usr/bin/bash',
    '',
  ].join('\n');
  const m = p.parseMsysPs(out);
  assert.equal(m.get(19748), 10668);
  assert.equal(m.get(20188), 19748);
  assert.equal(m.has(10668), false); // PPID 1: no MSYS parent
  assert.equal(m.has(2976), false);
});

test('etimeSeconds reads ps elapsed times', () => {
  assert.equal(p.etimeSeconds('00:05'), 5);
  assert.equal(p.etimeSeconds('01:02:03'), 3723);
  assert.equal(p.etimeSeconds('2-03:04:05'), 2 * 86400 + 3 * 3600 + 4 * 60 + 5);
});

test('macOS scan: lsof + ps map to the Windows scan shape', () => {
  const lsof = ['p1234', 'cnode', 'n127.0.0.1:3000', 'n[::1]:3000', 'p5678', 'cPython', 'n*:8000', 'nweird', ''].join('\n');
  const { conns, names } = p.parseLsof(lsof);
  assert.deepEqual(conns, [
    { LocalAddress: '127.0.0.1', LocalPort: 3000, OwningProcess: 1234 },
    { LocalAddress: '::1', LocalPort: 3000, OwningProcess: 1234 },
    { LocalAddress: '0.0.0.0', LocalPort: 8000, OwningProcess: 5678 },
  ]);
  assert.equal(names.get(1234), 'node');

  const ps = [
    '  1234     1    01:02:03 /usr/local/bin/node /Users/me/app/server.js',
    '  5678  1234 2-03:04:05 /opt/homebrew/bin/python3.12 -m http.server',
    '  9000  5678       00:01 /usr/bin/ruby script.rb',
    'garbage',
  ].join('\n');
  const now = 10_000_000_000;
  const procs = p.parsePs(ps, names, now);
  assert.equal(procs.length, 3);
  assert.deepEqual(procs[0], {
    ProcessId: 1234, ParentProcessId: 1, Name: 'node',
    CommandLine: '/usr/local/bin/node /Users/me/app/server.js', T: now - 3723 * 1000,
  });
  assert.equal(procs[1].Name, 'Python'); // lsof's name wins
  assert.equal(procs[2].Name, 'ruby'); // else the executable's basename
  assert.ok(procs[1].T < procs[0].T);
});

test('macDevName maps macOS process names to the DEV_PROCESSES names', () => {
  assert.equal(p.macDevName('python3.12'), 'python.exe');
  assert.equal(p.macDevName('Python'), 'python.exe');
  assert.equal(p.macDevName('node'), 'node.exe');
});

test('withoutFlagValues drops --flag=value paths but keeps script paths', () => {
  assert.ok(!p.withoutFlagValues('agy.exe --add-dir=C:\\Proj\\App').includes('c:\\proj\\app'));
  assert.ok(!p.withoutFlagValues('agy.exe "--add-dir=C:\\My Proj"').includes('my proj'));
  assert.ok(!p.withoutFlagValues('agy.exe --add-dir="C:\\My Proj" x').includes('my proj'));
  assert.ok(p.withoutFlagValues('node C:\\Proj\\App\\server.js --port=3000').includes('c:\\proj\\app\\server.js'));
  assert.equal(p.withoutFlagValues(null), '');
});

// ----------------------------------------------------------- transcripts ----

test('oneLine and usageTokens', () => {
  assert.equal(p.oneLine('  a\n\tb  '), 'a b');
  assert.equal(p.oneLine('x'.repeat(200)).length, 160);
  assert.equal(p.oneLine(null), '');
  assert.equal(p.usageTokens({ input_tokens: 1, cache_creation_input_tokens: 2, cache_read_input_tokens: 3, output_tokens: 4 }), 10);
  assert.equal(p.usageTokens(null), 0);
});

test('parseTail: last title, prompt, usage and message time; skips synthetic replies and partial lines', () => {
  const text = jl(
    '{"type":"assistant","message":{"usage":', // cut off at the start of the tail
    { type: 'ai-title', aiTitle: 'Old title' },
    { type: 'user', timestamp: '2026-10-01T10:00:00Z', message: { content: 'hi' } },
    { type: 'assistant', timestamp: '2026-10-01T10:00:05Z', message: { model: 'claude-opus-5-5', usage: { input_tokens: 100, output_tokens: 5 } } },
    { type: 'assistant', timestamp: '2026-10-01T10:00:06Z', message: { model: '<synthetic>', usage: { input_tokens: 1 } } },
    { type: 'ai-title', aiTitle: 'New title' },
    { type: 'last-prompt', lastPrompt: 'fix the bug' },
    { type: 'user', isMeta: true, timestamp: '2026-10-02T00:00:00Z', message: { content: 'meta' } },
    { type: 'system', content: 'mentions "type":"user" in text' },
  );
  const t = p.parseTail(text);
  assert.equal(t.title, 'New title');
  assert.equal(t.prompt, 'fix the bug');
  assert.equal(t.model, 'claude-opus-5-5');
  assert.deepEqual(t.usage, { input_tokens: 100, output_tokens: 5 });
  assert.equal(t.last, Date.parse('2026-10-01T10:00:06Z')); // meta lines don't count
});

test('firstPrompt skips meta lines and command output', () => {
  const text = jl(
    { type: 'user', isMeta: true, message: { content: 'caveat' } },
    { type: 'user', message: { content: '<command-name>/model</command-name>' } },
    { type: 'user', message: { content: [{ type: 'image' }, { type: 'text', text: 'what is this?' }] } },
    { type: 'user', message: { content: 'later' } },
  );
  assert.equal(p.firstPrompt(text), 'what is this?');
  assert.equal(p.firstPrompt('{"type":"user","mess'), null);
});

test('transcriptCwd: first cwd field, skipping text that only mentions cwd and a cut-off line', () => {
  const text = jl(
    { type: 'summary', summary: 'Shell cwd was reset to /tmp' },
    { type: 'user', message: { content: 'the "cwd" key' } },
    { type: 'user', cwd: 'E:\\pet_project\\Claude Terminal', message: { content: 'hi' } },
    { type: 'assistant', cwd: '/Users/me/other' },
  );
  assert.equal(p.transcriptCwd(text), 'E:\\pet_project\\Claude Terminal');
  assert.equal(p.transcriptCwd('{"type":"user","cwd":"/Users/me/ap'), null);
  assert.equal(p.transcriptCwd(''), null);
});

test('defaultEffort: by model id, then by unique family, then global', () => {
  const settings = {
    effortLevel: 'medium',
    modelSettings: { 'claude-opus-5-5': { effortLevel: 'high' }, 'claude-sonnet-5-5': { effortLevel: 'low' } },
  };
  assert.equal(p.defaultEffort(settings, 'Opus 5.5'), 'high');
  assert.equal(p.defaultEffort(settings, 'claude-opus-5-5[1m]'), 'high');
  assert.equal(p.defaultEffort(settings, 'sonnet'), 'low'); // only one sonnet entry
  assert.equal(p.defaultEffort(settings, 'claude-haiku-5-5'), 'medium');
  assert.equal(p.defaultEffort({ modelSettings: { 'claude-mythos-1': { effortLevel: 'max' } } }, 'Mythos'), 'max');
  assert.equal(p.defaultEffort(null, 'x'), null);
});

test('withLongContext re-attaches [1m] only for the same model family', () => {
  assert.equal(p.withLongContext('claude-sonnet-5-5', 'sonnet[1m]'), 'claude-sonnet-5-5[1m]');
  assert.equal(p.withLongContext('claude-sonnet-5-5', 'claude-sonnet-5-5[1m]'), 'claude-sonnet-5-5[1m]');
  assert.equal(p.withLongContext('claude-sonnet-5-5', 'opus[1m]'), 'claude-sonnet-5-5');
  assert.equal(p.withLongContext('claude-sonnet-5-5', 'sonnet'), 'claude-sonnet-5-5');
  assert.equal(p.withLongContext('claude-opus-5-5[1m]', 'opus[1m]'), 'claude-opus-5-5[1m]');
  assert.equal(p.withLongContext(null, 'opus[1m]'), null);
});

test('parseModelEffort follows /model, /effort and replies', () => {
  const stdout = (s) => ({ type: 'user', message: { content: `<local-command-stdout>${s}</local-command-stdout>` } });
  const reply = (model) => ({ type: 'assistant', message: { model, content: [] } });
  assert.deepEqual(p.parseModelEffort(jl(stdout('Set model to `Sonnet 5.5` with `high` effort'))), { model: 'Sonnet 5.5', effort: 'high' });
  // "(1M context)" only in the trailing note; the next reply keeps the [1m]
  assert.deepEqual(
    p.parseModelEffort(jl(stdout('Set model to Opus 4.6 (1M context)'), reply('claude-opus-4-6'), stdout('Set effort level to low'))),
    { model: 'claude-opus-4-6[1m]', effort: 'low' },
  );
  // a later reply of another family replaces it, synthetic replies don't
  assert.deepEqual(p.parseModelEffort(jl(stdout('Set model to Opus 4.6 (1M context)'), reply('claude-haiku-5-5'), reply('<synthetic>'))),
    { model: 'claude-haiku-5-5', effort: null });
});

test('agentDone: handback, final text reply or interrupt = finished; a tool call, mid-run text or a partial line = working', () => {
  const text = { type: 'assistant', message: { stop_reason: null, content: [{ type: 'text', text: 'Let me look' }] } };
  const report = { type: 'assistant', message: { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Report' }] } };
  const thinking = { type: 'assistant', message: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'x' }] } };
  const tool = { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read' }] } };
  const result = { type: 'user', message: { content: [{ type: 'tool_result', content: 'x' }] } };
  assert.equal(p.agentDone(jl(tool, { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'SubagentHandback' }] } })), true);
  // text and the next tool call are separate lines: mid-run text has no stop_reason, a final report ends the turn
  assert.equal(p.agentDone(jl(tool, result, text) + '\n'), false);
  assert.equal(p.agentDone(jl(tool, result, report) + '\n'), true);
  assert.equal(p.agentDone(jl(tool, result, thinking)), false);
  assert.equal(p.agentDone(jl(text, tool)), false);
  assert.equal(p.agentDone(jl(tool, result)), false);
  assert.equal(p.agentDone(jl(tool, { type: 'user', message: { content: '[Request interrupted by user]' } })), true);
  assert.equal(p.agentDone(jl(tool, { type: 'user', message: { content: [{ type: 'text', text: '[Request interrupted by user for tool use]' }] } })), true);
  assert.equal(p.agentDone(jl(tool) + '\n{"type":"assistant","message":{"content":[{"type":"te'), false);
  assert.equal(p.agentDone(''), null);
  // Real order (Claude Code 2.x): the handback call, its result, then a prompt_snapshot attachment whose tool list
  // names SubagentHandback; the same snapshot also lands mid-run, where it must not count.
  const handback = { type: 'assistant', message: { model: 'claude-haiku-5-5', content: [{ type: 'tool_use', name: 'SubagentHandback', input: { message: 'Done' } }] } };
  const delivered = { type: 'user', message: { content: [{ type: 'tool_result', content: [{ type: 'text', text: '{"success":true}' }] }] } };
  const snapshot = { type: 'attachment', attachment: { type: 'prompt_snapshot', tools: [{ name: 'Read' }, { name: 'SubagentHandback' }] } };
  assert.equal(p.agentDone(jl(tool, handback, delivered, snapshot)), true);
  assert.equal(p.agentDone(jl(tool, result, report, snapshot)), true); // Explore / review runs: no handback
  assert.equal(p.agentDone(jl(tool, result, snapshot)), false);
  assert.equal(p.agentDone(jl(snapshot)), null);
  // a tail that starts inside one huge line has no message to judge by
  assert.equal(p.agentDone(JSON.stringify(snapshot).slice(20)), null);
});

test('lastModel takes the last real reply, not synthetic replies or tool inputs', () => {
  const reply = (model, content = []) => ({ type: 'assistant', message: { model, content } });
  assert.equal(p.lastModel(jl(reply('claude-haiku-5-5'), reply('claude-sonnet-5-5'))), 'claude-sonnet-5-5');
  assert.equal(p.lastModel(jl(reply('claude-sonnet-5-5'), reply('<synthetic>'))), 'claude-sonnet-5-5');
  assert.equal(p.lastModel(jl(
    reply('claude-opus-5-5', [{ type: 'tool_use', name: 'Agent', input: { model: 'haiku', prompt: 'x' } }]),
    { type: 'user', message: { content: [{ type: 'tool_result', content: '{"model":"haiku"}' }] } },
  )), 'claude-opus-5-5');
  assert.equal(p.lastModel(jl(reply('claude-haiku-5-5')) + '\n{"type":"assistant","message":{"model":"claude-son'), 'claude-haiku-5-5');
  assert.equal(p.lastModel('{}'), null);
});

test('parseAgentFile reads frontmatter name and model, the body after it', () => {
  const def = p.parseAgentFile('\uFEFF---\r\nname: "code-scout"\r\nmodel: haiku\r\ndescription: x\r\n---\r\nYou search code.\r\n', 'scout.md');
  assert.deepEqual(def, { name: 'code-scout', model: 'haiku', body: 'You search code.' });
  assert.deepEqual(p.parseAgentFile('---\nname: a\n---', 'a.md'), { name: 'a', model: null, body: '' });
  // No frontmatter: a "name:" line in the body or a later "---" rule doesn't count
  assert.deepEqual(p.parseAgentFile('Use name: fake\n\n---\nmore', 'helper.md'),
    { name: 'helper', model: null, body: 'Use name: fake\n\n---\nmore' });
  // A "---" inside the body after the frontmatter stays in the body
  assert.equal(p.parseAgentFile('---\nname: b\n---\nintro\n---\nend', 'b.md').body, 'intro\n---\nend');
});

// ------------------------------------------------------------------ mcp ----

test('parseMcpList maps `claude mcp list` lines to statuses', () => {
  const out = [
    'Checking MCP server health...',
    '',
    'plugin:design:slack: https://mcp.slack.com/mcp (HTTP) - ✔ Connected',
    'supabase: npx -y @supabase/mcp-server --project-ref=abc - ✗ Failed to connect',
    'figma: https://mcp.figma.com/mcp (HTTP) - ! Needs authentication',
    'linear: https://mcp.linear.app/sse (SSE) - ! Needs client registration',
    'old: node old.js - Disabled',
    'odd: thing - ? Pending',
    'no separator line',
  ].join('\r\n');
  assert.deepEqual(p.parseMcpList(out).map((s) => [s.name, s.status]), [
    ['plugin:design:slack', 'connected'],
    ['supabase', 'failed'],
    ['figma', 'needs_auth'],
    ['linear', 'needs_client_registration'],
    ['old', 'disabled'],
    ['odd', 'unknown'],
  ]);
});

// -------------------------------------------------------------- restore ----

test('remapSplits follows dropped tabs and drops groups left with one member', () => {
  const at = new Map([[0, 0], [2, 1], [3, 2]]); // saved tabs 1 and 4 could not be restored
  const splits = [
    { tabs: [0, 1, 2], cx: 0.4, ry: 0.5, v: true },
    { tabs: [1, 4] },
    { tabs: [3, 4], cx: 0.3 },
    null,
  ];
  assert.deepEqual(p.remapSplits(splits, at), [{ cx: 0.4, ry: 0.5, v: true, tabs: [0, 1] }]);
  assert.deepEqual(p.remapSplits(undefined, at), []);
});
