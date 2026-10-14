'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel, cb) => ipcRenderer.on(channel, (_e, ...args) => cb(...args));

contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  initialClaude: process.argv.includes('--stanza-claude'),
  getState: () => ipcRenderer.invoke('state:get'),
  addProjects: () => ipcRenderer.invoke('projects:add'),
  chatProject: () => ipcRenderer.invoke('projects:chat'),
  pickChatDir: () => ipcRenderer.invoke('chat:pickDir'),
  resetChatDir: () => ipcRenderer.invoke('chat:resetDir'),
  removeProject: (p) => ipcRenderer.invoke('projects:remove', p),
  reorderProjects: (paths) => ipcRenderer.invoke('projects:reorder', paths),
  setUi: (patch) => ipcRenderer.invoke('ui:set', patch),
  saveTabs: (payload) => ipcRenderer.send('tabs:set', payload),

  ptyCreate: (opts) => ipcRenderer.invoke('pty:create', opts),
  ptyWrite: (id, data) => ipcRenderer.send('pty:write', id, data),
  ptyResize: (id, cols, rows) => ipcRenderer.send('pty:resize', id, cols, rows),
  ptyKill: (id) => ipcRenderer.send('pty:kill', id),
  onPtyData: (cb) => on('pty:data', cb),
  onPtyExit: (cb) => on('pty:exit', cb),

  gitStatus: (paths) => ipcRenderer.invoke('git:status', paths),
  listSessions: (paths) => ipcRenderer.invoke('sessions:list', paths),
  sessionInfo: (cwd, sessionId) => ipcRenderer.invoke('session:info', cwd, sessionId),
  mcpList: (cwd) => ipcRenderer.invoke('mcp:list', cwd),
  definedAgents: (cwd) => ipcRenderer.invoke('agents:defined', cwd),
  agentPrompt: (cwd, sessionId, name) => ipcRenderer.invoke('agents:prompt', cwd, sessionId, name),
  imagesList: (cwd, sessionId) => ipcRenderer.invoke('images:list', cwd, sessionId),
  imageThumb: (cwd, sessionId, id) => ipcRenderer.invoke('images:thumb', cwd, sessionId, id),
  imageFull: (cwd, sessionId, id) => ipcRenderer.invoke('images:full', cwd, sessionId, id),
  revealImage: (cwd, sessionId, id) => ipcRenderer.invoke('images:reveal', cwd, sessionId, id),
  getUsage: () => ipcRenderer.invoke('usage:get'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  applyUpdate: () => ipcRenderer.invoke('update:apply'),
  listPorts: () => ipcRenderer.invoke('ports:list'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openFolder: (p) => ipcRenderer.invoke('shell:showInFolder', p),
  openInCode: (p) => ipcRenderer.invoke('shell:openInCode', p),
  resolveFiles: (cwd, list) => ipcRenderer.invoke('files:resolve', cwd, list),
  openFile: (file, line, col) => ipcRenderer.invoke('shell:openFile', file, line, col),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.send('clipboard:write', text),
  flash: () => ipcRenderer.send('win:flash'),
  notify: (msg) => ipcRenderer.send('notify', msg),
  onNotifyClick: (cb) => on('notify:click', cb),
  pathForFile: (file) => webUtils.getPathForFile(file),

  onOpenPath: (cb) => on('open-path', cb),
  onCloseRequest: (cb) => on('app:close-request', cb),
  quit: () => ipcRenderer.send('app:quit'),
});
