import { contextBridge, ipcRenderer } from 'electron';
import type { GraderPluginApi, KvScope } from '../shared/plugin-api';

// Inlined like in preload.ts: a sandboxed preload cannot require other files.
// tests/unit/main/preloadChannels.test.ts keeps these in sync with src/shared/ipc-channels.ts.
const IPC = {
  PLUGIN_HOST_CONTEXT: 'pluginHost:context',
  PLUGIN_HOST_STORAGE_GET: 'pluginHost:storageGet',
  PLUGIN_HOST_STORAGE_SET: 'pluginHost:storageSet',
  PLUGIN_HOST_STORAGE_DELETE: 'pluginHost:storageDelete',
  PLUGIN_HOST_STORAGE_KEYS: 'pluginHost:storageKeys',
  PLUGIN_HOST_CREATE_IMPROMPTU: 'pluginHost:createImpromptu',
  PLUGIN_HOST_DELETE_IMPROMPTU: 'pluginHost:deleteImpromptu',
  PLUGIN_HOST_SECRETS_GET: 'pluginHost:secretsGet',
  PLUGIN_HOST_SECRETS_SET: 'pluginHost:secretsSet',
  PLUGIN_HOST_SECRETS_DELETE: 'pluginHost:secretsDelete',
} as const;

const storageScope = (scope: 'course' | 'global'): KvScope => ({
  get: (key) => ipcRenderer.invoke(IPC.PLUGIN_HOST_STORAGE_GET, { scope, key }),
  set: (key, value) => ipcRenderer.invoke(IPC.PLUGIN_HOST_STORAGE_SET, { scope, key, value }),
  delete: (key) => ipcRenderer.invoke(IPC.PLUGIN_HOST_STORAGE_DELETE, { scope, key }),
  keys: (prefix) => ipcRenderer.invoke(IPC.PLUGIN_HOST_STORAGE_KEYS, { scope, prefix }),
});

// Neither a plugin id nor a course id is sent: the main process knows them from the window.
const api: GraderPluginApi = {
  context: () => ipcRenderer.invoke(IPC.PLUGIN_HOST_CONTEXT),
  storage: { ...storageScope('course'), global: storageScope('global') },
  secrets: {
    get: (key) => ipcRenderer.invoke(IPC.PLUGIN_HOST_SECRETS_GET, { key }),
    set: (key, value) => ipcRenderer.invoke(IPC.PLUGIN_HOST_SECRETS_SET, { key, value }),
    delete: (key) => ipcRenderer.invoke(IPC.PLUGIN_HOST_SECRETS_DELETE, { key }),
  },
  assessment: {
    createImpromptu: (request) => ipcRenderer.invoke(IPC.PLUGIN_HOST_CREATE_IMPROMPTU, request),
    deleteImpromptu: (assessmentId) => ipcRenderer.invoke(IPC.PLUGIN_HOST_DELETE_IMPROMPTU, { assessmentId }),
  },
};

contextBridge.exposeInMainWorld('grader', api);
