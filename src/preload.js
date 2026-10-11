'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel, cb) => ipcRenderer.on(channel, (_e, ...args) => cb(...args));

contextBridge.exposeInMainWorld('api', {
  getState: () => ipcRenderer.invoke('state:get'),
  addProjects: () => ipcRenderer.invoke('projects:add'),
  removeProject: (p) => ipcRenderer.invoke('projects:remove', p),
  setUi: (patch) => ipcRenderer.invoke('ui:set', patch),

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
  getUsage: () => ipcRenderer.invoke('usage:get'),
  listPorts: () => ipcRenderer.invoke('ports:list'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openFolder: (p) => ipcRenderer.invoke('shell:showInFolder', p),
  openInCode: (p) => ipcRenderer.invoke('shell:openInCode', p),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  writeClipboard: (text) => ipcRenderer.send('clipboard:write', text),
  flash: () => ipcRenderer.send('win:flash'),
  pathForFile: (file) => webUtils.getPathForFile(file),

  onOpenPath: (cb) => on('open-path', cb),
  onCloseRequest: (cb) => on('app:close-request', cb),
  quit: () => ipcRenderer.send('app:quit'),
});
