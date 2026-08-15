/**
 * [1] 전역 설정 및 상태 관리 (Global Config & State)
 */

export const page = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
export const PARAM = '__soop_all_record_debug';
export const debugId = new URLSearchParams(location.search).get(PARAM);

export const id = `soop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const bus = new page.BroadcastChannel(id);

export const isCanStart = () => {
  if (S.recording || S.starting || S.stopping) return false;
  const activeCount = [...S.activeByKind.values()].filter(r => r.init).length;
  const bufferCount = [...S.buffers.values()].filter(r => r.init).length;
  return activeCount > 0 || bufferCount > 0;
};

export const S = {
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '4.0.0',
  recording: false,
  starting: false,
  stopping: false,
  get canStart() {
    return isCanStart();
  },
  set canStart(_) {},
  buffers: new Map(),
  byObject: new WeakMap(),
  nextId: 0,
  bytes: 0,
  chunks: 0,
  startedAt: null,
  logs: [],
  error: null,
  readyTimer: 0,
  rootDirectory: null,
  directory: null,
  stamp: null,
  baseName: null,
  mergeScript: null,
  mergedFilename: null,
  completedAt: null,
  mediaSources: new WeakMap(),
  nextGeneration: 1,
  activeByKind: new Map(),
  partNo: 0,
  parts: [],
  rotating: false,
  rotationReason: null,
  transitionQueue: [],
  transitionBytes: 0,
  fragmentStats: {
    observed: 0,
    queued: 0,
    written: 0,
    failed: 0,
    duplicates: 0,
    late: 0,
    seen: new Set(),
    missing: new Map(),
    highest: null,
    epochGeneration: null,
    timeline: new Map(),
    discontinuities: []
  },
  pendingBytes: 0,
  peakPendingBytes: 0,
  reconnects: 0,
  qualityChanges: 0,
  broadcastId: location.pathname.split('/').filter(Boolean).pop()
};

export const iso = () => new Date().toISOString();
export const mb = n => Math.round((n / 1048576) * 100) / 100;

export function log(level, type, message, data = null) {
  const entry = { time: iso(), level, type, message, data };
  S.logs.push(entry);
  if (S.logs.length > 1000) {
    S.logs.shift();
  }
  bus.postMessage({ type: 'log', entry });
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info']('[SOOP ALL RECORD]', message, data);
}

export function snap() {
  return {
    generatedAt: iso(),
    version: S.version,
    page: { url: location.href, title: document.title },
    capture: {
      recording: S.recording,
      starting: S.starting,
      stopping: S.stopping,
      canStart: isCanStart(),
      storageMode: 'File System Access API / direct-to-disk',
      memoryLimit: null,
      bytes: S.bytes,
      sizeMiB: mb(S.bytes),
      chunks: S.chunks,
      elapsedSeconds: S.startedAt ? Math.round((Date.now() - S.startedAt) / 1000) : 0,
      bufferCount: S.activeByKind.size,
      initReadyCount: [...S.activeByKind.values()].filter(r => r.init).length,
      totalBufferCount: S.buffers.size,
      mergeScript: S.mergeScript,
      mergedFilename: S.mergedFilename,
      completedAt: S.completedAt,
      error: S.error,
      partNo: S.partNo,
      partCount: S.parts.length,
      rotating: S.rotating,
      rotationReason: S.rotationReason,
      pendingBytes: S.pendingBytes,
      pendingMiB: mb(S.pendingBytes),
      transitionMiB: mb(S.transitionBytes),
      peakPendingMiB: mb(S.peakPendingBytes),
      reconnects: S.reconnects,
      qualityChanges: S.qualityChanges,
      broadcastId: location.pathname.split('/').filter(Boolean).pop(),
      fragments: {
        observed: S.fragmentStats.observed,
        queued: S.fragmentStats.queued,
        written: S.fragmentStats.written,
        failed: S.fragmentStats.failed,
        duplicates: S.fragmentStats.duplicates,
        late: S.fragmentStats.late,
        highest: S.fragmentStats.highest,
        missingPending: [...S.fragmentStats.missing].filter(([, m]) => !m.confirmed).map(([n]) => n).slice(-100),
        missingConfirmed: [...S.fragmentStats.missing].filter(([, m]) => m.confirmed).map(([n]) => n).slice(-100),
        missingCount: [...S.fragmentStats.missing].filter(([, m]) => m.confirmed).length,
        discontinuities: S.fragmentStats.discontinuities.slice(-100)
      }
    },
    buffers: [...S.buffers.values()].map(r => ({
      id: r.id,
      mime: r.mime,
      initReady: !!r.init,
      initBytes: r.init?.byteLength || 0,
      firstBox: r.initBoxes[0]?.type || 'unknown',
      firstHex: r.firstHex,
      observedMiB: mb(r.observedBytes),
      observedChunks: r.observedChunks,
      generation: r.generation,
      initMeta: r.initMeta,
      filename: r.filename,
      sessionMiB: mb(r.bytes),
      sessionChunks: r.chunks,
      writtenChunks: r.writtenChunks || 0,
      pendingWrites: r.pending,
      lastBoxes: r.lastBoxes,
      error: r.error
    })),
    parts: S.parts.map(p => ({
      number: p.number,
      reason: p.reason,
      generation: p.generation,
      label: p.label,
      startedAt: p.startedAt,
      endedAt: p.endedAt,
      bytes: p.bytes,
      chunks: p.chunks,
      writtenChunks: p.writtenChunks || 0,
      files: p.files,
      status: p.status
    })),
    logs: S.logs.slice(-100)
  };
}
