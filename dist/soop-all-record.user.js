// ==UserScript==
// @name         SOOP(숲) 라이브 무손실 원본 녹화기
// @namespace    https://github.com/yayokorea/soop-all-record
// @version      4.0.1
// @author       Yayo
// @description  SOOP 라이브 원본 스트림을 File System Access API로 브라우저 메모리 누수 없이 실시간 디스크에 무손실로 저장하고 병합 배치를 생성합니다.
// @license      MIT
// @icon         https://res.sooplive.com/afreeca.ico
// @homepage     https://github.com/yayokorea/soop-all-record#readme
// @homepageURL  https://github.com/yayokorea/soop-all-record
// @source       https://github.com/yayokorea/soop-all-record.git
// @supportURL   https://github.com/yayokorea/soop-all-record/issues
// @match        https://play.sooplive.com/*
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const page = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;
  const PARAM = "__soop_all_record_debug";
  const debugId = new URLSearchParams(location.search).get(PARAM);
  const id = `soop-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const bus = new page.BroadcastChannel(id);
  const isCanStart = () => {
    if (S.recording || S.starting || S.stopping) return false;
    const activeCount = [...S.activeByKind.values()].filter((r) => r.init).length;
    const bufferCount = [...S.buffers.values()].filter((r) => r.init).length;
    return activeCount > 0 || bufferCount > 0;
  };
  const S = {
    version: "4.0.1",
    recording: false,
    starting: false,
    stopping: false,
    get canStart() {
      return isCanStart();
    },
    set canStart(_) {
    },
    buffers: /* @__PURE__ */ new Map(),
    byObject: /* @__PURE__ */ new WeakMap(),
    nextId: 0,
    bytes: 0,
    chunks: 0,
    startedAt: null,
    logs: [],
    error: null,
    readyTimer: 0,
    directory: null,
    stamp: null,
    baseName: null,
    mergeScript: null,
    mergedFilename: null,
    completedAt: null,
    mediaSources: /* @__PURE__ */ new WeakMap(),
    nextGeneration: 1,
    activeByKind: /* @__PURE__ */ new Map(),
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
      seen: /* @__PURE__ */ new Set(),
      missing: /* @__PURE__ */ new Map(),
      highest: null,
      epochGeneration: null,
      timeline: /* @__PURE__ */ new Map(),
      discontinuities: []
    },
    pendingBytes: 0,
    peakPendingBytes: 0,
    reconnects: 0,
    qualityChanges: 0,
    broadcastId: location.pathname.split("/").filter(Boolean).pop()
  };
  const iso = () => (/* @__PURE__ */ new Date()).toISOString();
  const mb = (n) => Math.round(n / 1048576 * 100) / 100;
  function log(level, type, message, data = null) {
    const entry = { time: iso(), level, type, message, data };
    S.logs.push(entry);
    if (S.logs.length > 1e3) {
      S.logs.shift();
    }
    bus.postMessage({ type: "log", entry });
    console[level === "error" ? "error" : level === "warn" ? "warn" : "info"]("[SOOP ALL RECORD]", message, data);
  }
  function snap() {
    return {
      generatedAt: iso(),
      version: S.version,
      page: { url: location.href, title: document.title },
      capture: {
        recording: S.recording,
        starting: S.starting,
        stopping: S.stopping,
        canStart: isCanStart(),
        storageMode: "File System Access API / direct-to-disk",
        memoryLimit: null,
        bytes: S.bytes,
        sizeMiB: mb(S.bytes),
        chunks: S.chunks,
        elapsedSeconds: S.startedAt ? Math.round((Date.now() - S.startedAt) / 1e3) : 0,
        bufferCount: S.activeByKind.size,
        initReadyCount: [...S.activeByKind.values()].filter((r) => r.init).length,
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
        broadcastId: location.pathname.split("/").filter(Boolean).pop(),
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
      buffers: [...S.buffers.values()].map((r) => {
        var _a, _b;
        return {
          id: r.id,
          mime: r.mime,
          initReady: !!r.init,
          initBytes: ((_a = r.init) == null ? void 0 : _a.byteLength) || 0,
          firstBox: ((_b = r.initBoxes[0]) == null ? void 0 : _b.type) || "unknown",
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
        };
      }),
      parts: S.parts.map((p) => ({
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
  function boxes(u8) {
    const out = [];
    let p = 0;
    try {
      while (p + 8 <= u8.byteLength && out.length < 16) {
        const v = new DataView(u8.buffer, u8.byteOffset + p, u8.byteLength - p);
        let size = v.getUint32(0);
        let header = 8;
        const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
        if (size === 1 && p + 16 <= u8.byteLength) {
          size = v.getUint32(8) * 4294967296 + v.getUint32(12);
          header = 16;
        }
        out.push({ type, size, offset: p });
        if (!Number.isFinite(size) || size < header || p + size > u8.byteLength) {
          break;
        }
        p += size;
      }
    } catch (e) {
      out.push({ type: "parse-error", error: String(e) });
    }
    return out;
  }
  function hashBytes(u8) {
    let h = 2166136261;
    for (const b of u8) {
      h ^= b;
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function children(u8, start2, end) {
    const out = [];
    let p = start2;
    while (p + 8 <= end) {
      const v = new DataView(u8.buffer, u8.byteOffset + p, end - p);
      let size = v.getUint32(0);
      const type = String.fromCharCode(u8[p + 4], u8[p + 5], u8[p + 6], u8[p + 7]);
      if (size === 1 && p + 16 <= end) {
        size = v.getUint32(8) * 4294967296 + v.getUint32(12);
      }
      if (!size || size < 8 || p + size > end) {
        break;
      }
      out.push({ type, start: p, size, end: p + size });
      p += size;
    }
    return out;
  }
  function initMeta(u8, mime) {
    let width = null;
    let height = null;
    const top = children(u8, 0, u8.byteLength);
    const moov = top.find((b) => b.type === "moov");
    if (moov) {
      for (const trak of children(u8, moov.start + 8, moov.end).filter((b) => b.type === "trak")) {
        for (const b of children(u8, trak.start + 8, trak.end)) {
          if (b.type === "tkhd" && b.size >= 16) {
            const v = new DataView(u8.buffer, u8.byteOffset + b.end - 8, 8);
            const w = v.getUint32(0) / 65536;
            const h = v.getUint32(4) / 65536;
            if (w > 0 && h > 0) {
              width = Math.round(w);
              height = Math.round(h);
            }
          }
        }
      }
    }
    return {
      fingerprint: hashBytes(u8),
      width,
      height,
      label: width && height ? `${width}x${height}` : mime.includes("audio") ? "audio" : "unknown"
    };
  }
  const has = (bs, name) => bs.some((b) => b.type === name);
  function fragmentInfo(u8) {
    const info = { sequence: null, tracks: [] };
    const top = children(u8, 0, u8.byteLength);
    const moof = top.find((b) => b.type === "moof");
    if (!moof) return info;
    for (const b of children(u8, moof.start + 8, moof.end)) {
      if (b.type === "mfhd" && b.start + 16 <= b.end) {
        info.sequence = new DataView(u8.buffer, u8.byteOffset + b.start + 12, 4).getUint32(0);
      }
      if (b.type === "traf") {
        const t = { trackId: null, baseTime: null, sampleCount: null };
        for (const c of children(u8, b.start + 8, b.end)) {
          const v = new DataView(u8.buffer, u8.byteOffset + c.start, c.size);
          if (c.type === "tfhd" && c.size >= 16) {
            t.trackId = v.getUint32(12);
          }
          if (c.type === "tfdt" && c.size >= 16) {
            const ver = u8[c.start + 8];
            t.baseTime = ver === 1 && c.size >= 20 ? v.getUint32(12) * 4294967296 + v.getUint32(16) : v.getUint32(12);
          }
          if (c.type === "trun" && c.size >= 16) {
            t.sampleCount = v.getUint32(12);
          }
        }
        info.tracks.push(t);
      }
    }
    return info;
  }
  function resetFragmentStats() {
    S.fragmentStats = {
      observed: 0,
      queued: 0,
      written: 0,
      failed: 0,
      duplicates: 0,
      late: 0,
      seen: /* @__PURE__ */ new Set(),
      missing: /* @__PURE__ */ new Map(),
      highest: null,
      epochGeneration: null,
      timeline: /* @__PURE__ */ new Map(),
      discontinuities: []
    };
  }
  function observeFragment(info, generation) {
    const st = S.fragmentStats;
    const seq = info.sequence;
    st.observed++;
    if (st.epochGeneration !== generation) {
      st.epochGeneration = generation;
      st.highest = null;
      st.timeline.clear();
    }
    if (seq != null) {
      const key = `g${generation}:${seq}`;
      if (st.seen.has(key)) {
        st.duplicates++;
      } else {
        st.seen.add(key);
        if (st.missing.has(key)) {
          st.missing.delete(key);
          st.late++;
        }
        if (st.highest != null && seq > st.highest + 1) {
          for (let n = st.highest + 1; n < seq; n++) {
            st.missing.set(`g${generation}:${n}`, {
              number: n,
              generation,
              detectedAt: seq,
              confirmed: false
            });
          }
        }
        if (st.highest == null || seq > st.highest) {
          st.highest = seq;
        }
        for (const [, m] of st.missing) {
          if (m.generation === generation && st.highest - m.number >= 8) {
            m.confirmed = true;
          }
        }
      }
    }
    for (const t of info.tracks) {
      if (t.trackId != null && t.baseTime != null) {
        const prev = st.timeline.get(t.trackId);
        if (prev) {
          const delta = t.baseTime - prev.base;
          const history = prev.deltas;
          if (delta <= 0) {
            st.discontinuities.push({
              trackId: t.trackId,
              type: "backward",
              from: prev.base,
              to: t.baseTime,
              sequence: seq
            });
          } else {
            const sorted = history.slice().sort((a, b) => a - b);
            const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
            if (median && delta > median * 3) {
              st.discontinuities.push({
                trackId: t.trackId,
                type: "gap",
                delta,
                expected: median,
                sequence: seq
              });
            }
            history.push(delta);
            if (history.length > 20) {
              history.shift();
            }
          }
          prev.base = t.baseTime;
        } else {
          st.timeline.set(t.trackId, { base: t.baseTime, deltas: [] });
        }
      }
    }
  }
  let toastTimer = 0;
  function friendlyError(error) {
    const name = (error == null ? void 0 : error.name) || "";
    const text = String((error == null ? void 0 : error.message) || error || "알 수 없는 오류");
    if (name === "AbortError") return "작업을 취소했습니다.";
    if (name === "NotAllowedError" || name === "SecurityError") {
      return "저장 폴더 권한이 없습니다. 녹화 버튼을 다시 눌러 허용하세요.";
    }
    if (name === "QuotaExceededError") {
      return "저장 공간이 부족합니다. 다른 드라이브의 폴더를 선택하세요.";
    }
    return `파일을 처리하지 못했습니다: ${text}`;
  }
  function toast(message, level = "ok", duration = 4500) {
    let el = document.getElementById("soopAllRecordToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "soopAllRecordToast";
      Object.assign(el.style, {
        position: "fixed",
        right: "24px",
        bottom: "72px",
        zIndex: "2147483647",
        maxWidth: "440px",
        padding: "13px 18px",
        borderRadius: "12px",
        color: "#fff",
        font: '13px/1.5 -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif',
        boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
        transition: "all .25s ease",
        transform: "translateY(0)",
        backdropFilter: "blur(8px)"
      });
      document.documentElement.appendChild(el);
    }
    el.style.background = level === "error" ? "rgba(220, 38, 38, 0.95)" : level === "warn" ? "rgba(217, 119, 6, 0.95)" : "rgba(16, 185, 129, 0.95)";
    el.textContent = message;
    el.style.opacity = "1";
    el.style.pointerEvents = "auto";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
    }, duration);
  }
  const kind = (r) => r.mime.includes("video") ? "video" : r.mime.includes("audio") ? "audio" : `buffer-${r.id}`;
  const ext = (r) => r.mime.includes("mp4") ? "mp4" : r.mime.includes("webm") ? "webm" : "bin";
  const clean = (value) => {
    const result = String(value || "SOOP").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/[. ]+$/g, "").trim();
    return (result || "SOOP").slice(0, 80);
  };
  const localStamp = () => {
    const d = /* @__PURE__ */ new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  };
  const broadcastName = () => clean((document.title || "SOOP").split("•")[0].trim());
  const activeRecords = () => {
    const active = [...S.activeByKind.values()].filter((r) => r.init);
    if (active.length > 0) return active;
    return [...S.buffers.values()].filter((r) => r.init);
  };
  const partTag = () => `part${String(S.partNo).padStart(3, "0")}`;
  async function closeActiveWriters() {
    const files = [];
    for (const r of S.buffers.values()) {
      if (r.writable) {
        await r.chain;
        await r.writable.close();
        files.push({ name: r.filename, bytes: r.bytes, kind: kind(r) });
        r.writable = null;
      }
    }
    return files;
  }
  async function openPart(reason) {
    var _a, _b;
    const records = activeRecords();
    if (!records.length || !records.every((r) => r.init)) {
      throw new Error("새 Part 초기화 세그먼트가 준비되지 않았습니다.");
    }
    S.partNo++;
    const tag = partTag();
    const part = {
      number: S.partNo,
      reason,
      generation: Math.max(...records.map((r) => r.generation)),
      label: ((_b = (_a = records.find((r) => kind(r) === "video")) == null ? void 0 : _a.initMeta) == null ? void 0 : _b.label) || "unknown",
      startedAt: iso(),
      endedAt: null,
      bytes: 0,
      chunks: 0,
      writtenChunks: 0,
      files: [],
      status: "recording"
    };
    for (const r of records) {
      const suffix = kind(r) === "video" ? "영상" : kind(r) === "audio" ? "음성" : `트랙${r.id}`;
      const name = `${S.baseName}_${tag}_${part.label}_${suffix}.${ext(r)}`;
      const fh = await S.directory.getFileHandle(name, { create: true });
      r.writable = await fh.createWritable({ keepExistingData: false });
      r.filename = name;
      r.chain = Promise.resolve();
      r.pending = 0;
      r.error = null;
      r.bytes = r.init.byteLength;
      r.chunks = 0;
      r.writtenChunks = 0;
      await r.writable.write(r.init);
      part.files.push({ name, kind: kind(r), mime: r.mime });
      part.bytes += r.init.byteLength;
    }
    S.parts.push(part);
    return part;
  }
  async function rotatePart(reason) {
    if (!S.recording || S.rotating) return;
    S.rotating = true;
    S.rotationReason = reason;
    send();
    toast(`${reason === "quality-change" ? "화질 변경" : "재연결"} 감지 · 새 Part 준비 중`, "warn", 3500);
    try {
      await new Promise((resolve) => setTimeout(resolve, 650));
      if (reason === "reconnect") {
        for (let i = 0; i < 20; i++) {
          const records = activeRecords();
          const max = Math.max(...records.map((r) => r.generation));
          if (records.some((r) => kind(r) === "video" && r.generation === max) && records.some((r) => kind(r) === "audio" && r.generation === max)) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
      const old = S.parts.at(-1);
      const files = await closeActiveWriters();
      if (old) {
        old.endedAt = iso();
        old.status = "closed";
        old.files = files;
      }
      const part = await openPart(reason);
      const queued = S.transitionQueue.splice(0);
      S.transitionBytes = 0;
      S.rotating = false;
      S.rotationReason = null;
      let discarded = 0;
      for (const item of queued) {
        const active = S.activeByKind.get(kind(item.record));
        if (item.record === active) {
          writeFragment(item.record, item.data, item.info, item.boxes);
        } else {
          discarded++;
        }
      }
      log("info", "part-rotated", "새 Part로 녹화 계속", {
        reason,
        part: part.number,
        label: part.label,
        queued: queued.length,
        discardedOldSource: discarded
      });
      toast(`Part ${part.number} · ${part.label}로 녹화를 계속합니다.`);
    } catch (error) {
      S.error = String((error == null ? void 0 : error.stack) || error);
      S.recording = false;
      S.rotating = false;
      log("error", "rotate-error", "Part 전환 실패", { error: S.error });
      toast(friendlyError(error), "error", 8e3);
    } finally {
      send();
    }
  }
  async function createSessionArtifacts() {
    const parts = S.parts;
    if (!parts.length) return null;
    const outputs = [];
    const commands = [];
    for (const p of parts) {
      const v = p.files.find((f) => f.kind === "video");
      const a = p.files.find((f) => f.kind === "audio");
      if (v && a) {
        const out = `${S.baseName}_Part${p.number}_${p.label}.mp4`;
        outputs.push(out);
        commands.push(`ffmpeg -y -i "${v.name}" -i "${a.name}" -c copy -movflags +faststart "${out}"`);
      } else if (v) {
        const out = `${S.baseName}_Part${p.number}_${p.label}.mp4`;
        outputs.push(out);
        commands.push(`ffmpeg -y -i "${v.name}" -c copy -movflags +faststart "${out}"`);
      }
    }
    const scriptName = `${S.baseName}_무손실병합.bat`;
    const script = [
      "@echo off",
      "chcp 65001 >nul",
      "echo ========================================================",
      "echo   SOOP 원본 녹화 무손실 병합 스크립트",
      "echo ========================================================",
      "",
      ...commands.flatMap((cmd, index) => [
        `echo [Part ${index + 1}/${commands.length}] 병합 진행 중...`,
        cmd,
        "if errorlevel 1 ( echo [오류] ffmpeg 병합 실패 & pause & exit /b 1 )",
        ""
      ]),
      "echo --------------------------------------------------------",
      "echo 모든 Part의 무손실 MP4 생성이 완료되었습니다!",
      "echo --------------------------------------------------------",
      "pause",
      ""
    ].join("\r\n");
    const scriptHandle = await S.directory.getFileHandle(scriptName, { create: true });
    const writable = await scriptHandle.createWritable({ keepExistingData: false });
    await writable.write(new TextEncoder().encode(script));
    await writable.close();
    S.mergeScript = scriptName;
    S.mergedFilename = outputs.join(", ");
    const manifestName = `${S.baseName}_녹화정보.json`;
    const manifestHandle = await S.directory.getFileHandle(manifestName, { create: true });
    const manifestWriter = await manifestHandle.createWritable({ keepExistingData: false });
    const manifest = {
      version: S.version,
      createdAt: iso(),
      broadcastId: S.broadcastId,
      baseName: S.baseName,
      summary: snap().capture,
      parts: S.parts,
      outputs,
      diagnostics: {
        missingConfirmed: [...S.fragmentStats.missing].filter(([, m]) => m.confirmed).map(([n]) => n),
        missingPending: [...S.fragmentStats.missing].filter(([, m]) => !m.confirmed).map(([n]) => n),
        discontinuities: S.fragmentStats.discontinuities
      }
    };
    await manifestWriter.write(new TextEncoder().encode(JSON.stringify(manifest, null, 2)));
    await manifestWriter.close();
    return { scriptName, manifestName, outputs, commands };
  }
  function queue(r, data, part) {
    r.pending++;
    S.pendingBytes += data.byteLength;
    S.peakPendingBytes = Math.max(S.peakPendingBytes, S.pendingBytes);
    r.chain = r.chain.then(() => r.writable.write(data)).then(
      () => {
        S.fragmentStats.written++;
        r.writtenChunks++;
        if (part) {
          part.writtenChunks++;
        }
      },
      (e) => {
        r.error = String((e == null ? void 0 : e.stack) || e);
        S.error = r.error;
        S.recording = false;
        S.fragmentStats.failed++;
        log("error", "write-error", `Buffer ${r.id} 쓰기 실패`, { error: r.error });
      }
    ).finally(() => {
      r.pending--;
      S.pendingBytes = Math.max(0, S.pendingBytes - data.byteLength);
    });
  }
  function writeFragment(r, data, info, bs) {
    const target = S.activeByKind.get(kind(r));
    if (!(target == null ? void 0 : target.writable)) {
      S.fragmentStats.failed++;
      log("error", "no-writer", "활성 파일 writer가 없습니다.", {
        kind: kind(r),
        generation: r.generation
      });
      return;
    }
    target.bytes += data.byteLength;
    target.chunks++;
    S.bytes += data.byteLength;
    S.chunks++;
    S.fragmentStats.queued++;
    const part = S.parts.at(-1);
    if (part) {
      part.bytes += data.byteLength;
      part.chunks++;
    }
    queue(target, data, part);
    if (S.pendingBytes > 134217728 && S.pendingBytes - data.byteLength <= 134217728) {
      toast(`디스크 쓰기가 밀리고 있습니다 · ${mb(S.pendingBytes)} MiB 대기`, "warn", 6e3);
    }
    if (S.pendingBytes > 536870912) {
      toast("디스크 쓰기 지연이 512 MiB를 넘어 안전을 위해 녹화를 중지합니다.", "error", 9e3);
      stop();
    }
    if (S.chunks <= 10 || S.chunks % 20 === 0) {
      send();
    }
  }
  async function start(dir) {
    var _a, _b, _c, _d;
    if (!S.canStart) {
      throw new Error("아직 초기화 세그먼트가 준비되지 않았습니다.");
    }
    S.starting = true;
    S.error = null;
    send();
    const opened = [];
    const stamp = localStamp();
    S.directory = dir;
    S.stamp = stamp;
    S.baseName = `${broadcastName()}_${stamp}`;
    S.mergeScript = null;
    S.mergedFilename = null;
    S.completedAt = null;
    try {
      S.parts = [];
      S.partNo = 0;
      S.transitionQueue = [];
      S.transitionBytes = 0;
      S.pendingBytes = 0;
      S.peakPendingBytes = 0;
      resetFragmentStats();
      for (const r of activeRecords()) {
        const suffix = kind(r) === "video" ? "영상" : kind(r) === "audio" ? "음성" : `트랙${r.id}`;
        const label = ((_b = (_a = activeRecords().find((x) => kind(x) === "video")) == null ? void 0 : _a.initMeta) == null ? void 0 : _b.label) || "unknown";
        const name = `${S.baseName}_part001_${label}_${suffix}.${ext(r)}`;
        const fh = await dir.getFileHandle(name, { create: true });
        r.writable = await fh.createWritable({ keepExistingData: false });
        r.filename = name;
        r.chain = Promise.resolve();
        r.pending = 0;
        r.error = null;
        r.bytes = r.init.byteLength;
        r.chunks = 0;
        r.writtenChunks = 0;
        await r.writable.write(r.init);
        opened.push(r);
      }
      S.partNo = 1;
      S.parts.push({
        number: 1,
        reason: "user-start",
        generation: Math.max(...opened.map((r) => r.generation)),
        label: ((_d = (_c = opened.find((r) => kind(r) === "video")) == null ? void 0 : _c.initMeta) == null ? void 0 : _d.label) || "unknown",
        startedAt: iso(),
        endedAt: null,
        bytes: S.bytes,
        chunks: 0,
        writtenChunks: 0,
        files: opened.map((r) => ({ name: r.filename, kind: kind(r), mime: r.mime })),
        status: "recording"
      });
      S.bytes = opened.reduce((n, r) => n + r.init.byteLength, 0);
      S.parts[0].bytes = S.bytes;
      S.chunks = 0;
      S.startedAt = Date.now();
      S.recording = true;
      log("info", "started", "디스크 실시간 녹화 시작", {
        files: opened.map((r) => r.filename)
      });
    } catch (e) {
      for (const r of opened) {
        try {
          await r.writable.abort();
        } catch (_) {
        }
        r.writable = null;
      }
      S.error = String((e == null ? void 0 : e.stack) || e);
      log("error", "start-error", "시작 실패", { error: S.error });
      throw e;
    } finally {
      S.starting = false;
      send();
    }
  }
  async function stop() {
    if (!S.recording || S.stopping) return;
    S.recording = false;
    S.stopping = true;
    send();
    try {
      const files = await closeActiveWriters();
      const part = S.parts.at(-1);
      if (part) {
        part.endedAt = iso();
        part.status = "closed";
        part.files = files;
      }
      const merge = await createSessionArtifacts();
      S.completedAt = iso();
      log("info", "stopped", "파일 쓰기 완료 및 무손실 병합 스크립트 생성", { files, merge });
      const missing = [...S.fragmentStats.missing].filter(([, m]) => m.confirmed).length;
      toast(
        `✓ 녹화 저장 완료 · ${mb(S.bytes)} MiB · Part ${S.parts.length}개 · 누락 ${missing}
${merge.scriptName}을 실행하면 최종 MP4가 생성됩니다.`,
        "ok",
        9e3
      );
    } catch (e) {
      S.error = String((e == null ? void 0 : e.stack) || e);
      log("error", "stop-error", "파일 닫기 실패", { error: S.error });
      toast(friendlyError(e), "error", 8e3);
    } finally {
      S.stopping = false;
      S.startedAt = null;
      readiness(true);
    }
  }
  function copy(input) {
    let src;
    if (input instanceof page.ArrayBuffer) {
      src = new page.Uint8Array(input);
    } else if (page.ArrayBuffer.isView(input)) {
      src = new page.Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    } else {
      return null;
    }
    const dst = new page.Uint8Array(src.byteLength);
    dst.set(src);
    return dst;
  }
  function record(sb) {
    let r = S.byObject.get(sb);
    if (!r) {
      r = {
        id: S.nextId++,
        generation: 0,
        mime: "unknown",
        init: null,
        initBoxes: [],
        initMeta: null,
        firstHex: "",
        observedBytes: 0,
        observedChunks: 0,
        bytes: 0,
        chunks: 0,
        writtenChunks: 0,
        lastBoxes: [],
        filename: null,
        writable: null,
        chain: Promise.resolve(),
        pending: 0,
        error: null
      };
      S.byObject.set(sb, r);
      S.buffers.set(r.id, r);
    }
    return r;
  }
  let controlButtonUpdater = () => {
  };
  function setControlButtonUpdater(fn) {
    controlButtonUpdater = fn;
  }
  function updateControlButton$1() {
    controlButtonUpdater();
  }
  function send() {
    updateControlButton$1();
    bus.postMessage({ type: "snapshot", snapshot: snap() });
  }
  function readiness$1(immediate = false) {
    clearTimeout(S.readyTimer);
    const check = () => {
      const active = [...S.activeByKind.values()].filter((r) => r.init);
      const allWithInit = [...S.buffers.values()].filter((r) => r.init);
      log(
        "info",
        "readiness",
        S.canStart ? "녹화 시작 가능" : "초기화 세그먼트 대기",
        { active: active.length, totalWithInit: allWithInit.length, canStart: S.canStart }
      );
      send();
    };
    if (immediate) {
      check();
    } else {
      S.readyTimer = setTimeout(check, 250);
    }
  }
  function setupMseHooks() {
    const originalAdd = page.MediaSource.prototype.addSourceBuffer;
    const originalAppend = page.SourceBuffer.prototype.appendBuffer;
    page.MediaSource.prototype.addSourceBuffer = function(mime) {
      let generation = S.mediaSources.get(this);
      if (!generation) {
        generation = S.nextGeneration++;
        S.mediaSources.set(this, generation);
        if (generation > 1) {
          S.reconnects++;
          log("warn", "media-source-generation", `새 MediaSource generation ${generation} 감지`, {});
        }
      }
      const sb = originalAdd.call(this, mime);
      const r = record(sb);
      r.mime = String(mime || "unknown");
      r.generation = generation;
      log("info", "buffer-created", `Buffer ${r.id} 생성`, { mime: r.mime, generation });
      readiness$1();
      return sb;
    };
    page.SourceBuffer.prototype.appendBuffer = function(input) {
      var _a;
      try {
        const data = copy(input);
        if (data) {
          const r = record(this);
          const bs = boxes(data);
          r.observedBytes += data.byteLength;
          r.observedChunks++;
          r.lastBoxes = bs;
          if (has(bs, "ftyp") && has(bs, "moov")) {
            const previous = r.initMeta;
            const newMeta = initMeta(data, r.mime);
            const previousActive = S.activeByKind.get(kind(r));
            r.init = data;
            r.initBoxes = bs;
            r.initMeta = newMeta;
            r.firstHex = Array.from(data.slice(0, 32)).map((v) => v.toString(16).padStart(2, "0")).join("");
            S.activeByKind.set(kind(r), r);
            log("info", "init-cached", `Buffer ${r.id} init 캐시`, {
              bytes: data.byteLength,
              meta: newMeta,
              generation: r.generation
            });
            readiness$1();
            if (S.recording) {
              const current = S.parts.at(-1);
              const changed = previous && previous.fingerprint !== newMeta.fingerprint || previousActive && previousActive !== r && ((_a = previousActive.initMeta) == null ? void 0 : _a.fingerprint) !== newMeta.fingerprint;
              const reason = current && r.generation > current.generation ? "reconnect" : changed ? "quality-change" : null;
              if (reason) {
                if (reason === "quality-change") {
                  S.qualityChanges++;
                }
                rotatePart(reason);
              }
            }
          } else if (S.recording && (has(bs, "moof") || has(bs, "mdat"))) {
            const info = fragmentInfo(data);
            observeFragment(info, r.generation);
            if (S.rotating) {
              S.transitionQueue.push({ record: r, data, info, boxes: bs });
              S.transitionBytes += data.byteLength;
            } else {
              writeFragment(r, data, info, bs);
            }
          }
        }
      } catch (e) {
        S.error = String((e == null ? void 0 : e.stack) || e);
        log("error", "hook-error", "appendBuffer 후킹 오류", { error: S.error });
      }
      return originalAppend.call(this, input);
    };
  }
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("soop-all-record", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("settings");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function rememberDirectory(handle) {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction("settings", "readwrite");
      tx.objectStore("settings").put(handle, "directory");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }
  async function recalledDirectory() {
    const db = await openDb();
    const handle = await new Promise((resolve, reject) => {
      const req = db.transaction("settings").objectStore("settings").get("directory");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return handle;
  }
  async function chooseDirectory() {
    let handle = null;
    try {
      handle = await recalledDirectory();
    } catch (e) {
      log("warn", "folder-recall", "폴더 복원 실패", { error: String(e) });
    }
    if (handle) {
      let permission = await handle.queryPermission({ mode: "readwrite" });
      if (permission !== "granted") {
        permission = await handle.requestPermission({ mode: "readwrite" });
      }
      if (permission === "granted") {
        return handle;
      }
    }
    handle = await page.showDirectoryPicker({ mode: "readwrite", id: "soop-all-record" });
    try {
      await rememberDirectory(handle);
    } catch (error) {
      log("warn", "folder-memory", "폴더 기억 실패", { error: String(error) });
    }
    return handle;
  }
  let controlButton = null;
  let popover = null;
  function hidePopover() {
    if (popover) {
      popover.style.display = "none";
    }
  }
  function openDebug() {
    const debugUrl = new URL(location.href);
    debugUrl.searchParams.set(PARAM, id);
    debugUrl.hash = "";
    page.open(debugUrl.href, `soop_all_record_debug_${id}`);
  }
  async function beginFromUi() {
    if (!S.canStart) {
      return toast("아직 스트림을 준비하고 있습니다. 잠시 후 다시 시도하세요.", "warn");
    }
    try {
      toast("저장 폴더를 준비하고 있습니다.", "warn", 1800);
      const dir = await chooseDirectory();
      await start(dir);
      toast("● 원본 녹화를 시작했습니다.");
    } catch (error) {
      if ((error == null ? void 0 : error.name) !== "AbortError") {
        toast(friendlyError(error), "error", 7e3);
      }
    }
  }
  function showPopover(reposition = true) {
    var _a, _b;
    if (!popover) {
      popover = document.createElement("div");
      popover.id = "soopAllRecordPopover";
      Object.assign(popover.style, {
        position: "fixed",
        zIndex: "2147483646",
        width: "320px",
        padding: "18px",
        borderRadius: "14px",
        background: "rgba(20, 20, 20, 0.96)",
        backdropFilter: "blur(20px)",
        webkitBackdropFilter: "blur(20px)",
        border: "1px solid #2e2e2e",
        color: "#ffffff",
        font: '13px/1.5 -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, sans-serif',
        boxShadow: "0 20px 40px -12px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.06)",
        boxSizing: "border-box",
        userSelect: "none"
      });
      document.documentElement.appendChild(popover);
      document.addEventListener(
        "click",
        (e) => {
          if (popover.style.display !== "none" && !popover.contains(e.target) && e.target !== controlButton && !(controlButton == null ? void 0 : controlButton.contains(e.target))) {
            hidePopover();
          }
        },
        true
      );
    }
    const stateText = S.stopping ? "저장 마무리 중" : S.starting ? "녹화 준비 중" : S.recording ? "녹화 진행 중" : S.canStart ? "녹화 대기 중" : "스트림 감지 중";
    const fs = S.fragmentStats;
    const missing = [...fs.missing].filter(([, m]) => m.confirmed).length;
    const elapsed = S.startedAt ? Math.round((Date.now() - S.startedAt) / 1e3) : 0;
    const elapsedMin = Math.floor(elapsed / 60);
    const elapsedSec = String(elapsed % 60).padStart(2, "0");
    const summary = S.recording ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
         <span style="font-weight:800;font-size:17px;color:#ff4d4f;font-variant-numeric:tabular-nums">${elapsedMin}:${elapsedSec}</span>
         <span style="font-weight:700;font-size:14px;color:#ffffff">${mb(S.bytes)} <span style="font-size:11px;color:#737373">MiB</span></span>
       </div>
       <div style="font-size:11px;color:#b3b3b3;display:grid;grid-template-columns:1fr 1fr;gap:5px;line-height:1.4">
         <div>저장: <span style="color:#ffffff;font-weight:700">${fs.written}/${fs.queued}</span></div>
         <div>누락: <span style="color:${missing > 0 ? "#ff4d4f" : "#00c471"};font-weight:700">${missing}</span></div>
         <div>세그먼트: <span style="color:#ffffff;font-weight:700">Part ${S.parts.length}</span></div>
         <div>대기 큐: <span style="color:#ffffff;font-weight:700">${mb(S.pendingBytes)} MiB</span></div>
       </div>` : S.completedAt ? `<div style="font-size:12px;color:#ffffff;margin-bottom:4px">저장 완료: <b>${fs.written}개 청크</b> (Part ${S.parts.length})</div>
         <div style="font-size:11px;color:#737373;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${S.mergeScript || "병합 스크립트 생성됨"}</div>` : `<div style="font-size:12px;color:#b3b3b3">미디어 트랙 초기화: <b style="color:#00c471">${[...S.activeByKind.values()].filter((r) => r.init).length}/${S.activeByKind.size}</b></div>`;
    const statusBg = S.recording ? "rgba(255, 77, 79, 0.18)" : S.canStart ? "rgba(0, 196, 113, 0.18)" : "rgba(255, 160, 0, 0.18)";
    const statusColor = S.recording ? "#ff4d4f" : S.canStart ? "#00c471" : "#ffa000";
    const dotColor = S.recording ? "#ff4d4f" : S.canStart ? "#00c471" : "#ffa000";
    popover.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <div style="font-weight:700;font-size:14px;color:#ffffff;display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};"></span>
        SOOP 원본 녹화
      </div>
      <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:${statusBg};color:${statusColor}">${stateText}</span>
    </div>
    <div style="background:#1e1e1e;border:1px solid #282828;border-radius:10px;padding:12px 14px;margin-bottom:12px">${summary}</div>
    <div style="color:#737373;font-size:11.5px;margin-bottom:14px;display:flex;align-items:center;gap:4px;overflow:hidden">
      <span style="flex-shrink:0;color:#737373">폴더:</span>
      <span style="font-weight:600;color:#b3b3b3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${((_a = S.directory) == null ? void 0 : _a.name) || "시작 시 지정"}">${((_b = S.directory) == null ? void 0 : _b.name) || "시작 시 지정"}</span>
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap">
      <button id="sarPrimary" style="flex:1;min-width:120px;padding:9px 14px;border:0;border-radius:8px;background:${S.recording ? "#ff4d4f" : "#00c471"};color:${S.recording ? "#ffffff" : "#141414"};font-weight:700;cursor:pointer;font-size:12.5px;transition:opacity .15s" ${!S.recording && !S.canStart || S.starting || S.stopping ? "disabled" : ""}>${S.recording ? "녹화 중지" : "새 녹화 시작"}</button>
      <button id="sarFolder" style="padding:9px 12px;border:1px solid #2e2e2e;border-radius:8px;background:#1e1e1e;color:#b3b3b3;font-weight:600;cursor:pointer;font-size:12px" ${S.recording ? "disabled" : ""}>폴더 변경</button>
      <button id="sarDebug" style="width:100%;margin-top:2px;padding:8px 10px;border:1px solid #282828;border-radius:8px;background:transparent;color:#737373;font-weight:600;cursor:pointer;font-size:11.5px">상세 모니터링 대시보드</button>
    </div>`;
    const primaryBtn = popover.querySelector("#sarPrimary");
    if (primaryBtn) {
      primaryBtn.onclick = async () => {
        hidePopover();
        if (S.recording) {
          await stop();
        } else {
          await beginFromUi();
        }
      };
    }
    const folderBtn = popover.querySelector("#sarFolder");
    if (folderBtn) {
      folderBtn.onclick = async () => {
        try {
          const handle = await page.showDirectoryPicker({ mode: "readwrite", id: "soop-all-record" });
          await rememberDirectory(handle);
          S.directory = handle;
          toast(`저장 폴더: ${handle.name}`);
          showPopover(false);
        } catch (error) {
          if ((error == null ? void 0 : error.name) !== "AbortError") {
            toast(friendlyError(error), "error");
          }
        }
      };
    }
    const debugBtn = popover.querySelector("#sarDebug");
    if (debugBtn) {
      debugBtn.onclick = () => openDebug();
    }
    if (reposition || popover.style.display !== "block") {
      const rect = controlButton == null ? void 0 : controlButton.getBoundingClientRect();
      if (rect) {
        const popoverWidth = 320;
        const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.right - popoverWidth));
        const bottomDistance = Math.max(48, window.innerHeight - rect.top + 8);
        popover.style.left = `${left}px`;
        popover.style.bottom = `${bottomDistance}px`;
        popover.style.top = "auto";
      }
    }
    popover.style.display = "block";
  }
  function updateControlButton() {
    if (!controlButton) return;
    const elapsed = S.startedAt ? Math.round((Date.now() - S.startedAt) / 1e3) : 0;
    const mins = Math.floor(elapsed / 60);
    const secs = String(elapsed % 60).padStart(2, "0");
    if (S.stopping || S.starting) {
      controlButton.innerHTML = `<span style="display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,0.3);border-top-color:#00c471;border-radius:50%;animation:soopAllRecordSpin .8s linear infinite;box-sizing:border-box;"></span>`;
      controlButton.title = S.starting ? "녹화 시작 준비 중..." : "파일 저장 마무리 중...";
    } else if (S.recording) {
      controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:5px;padding:3px 8px;background:rgba(255,77,79,0.2);border:1px solid rgba(255,77,79,0.5);border-radius:14px;">
        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ff4d4f;animation:soopAllRecordPulse 1.2s ease-in-out infinite;"></span>
        <span style="font-size:11.5px;font-weight:700;color:#ff7875;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1;font-variant-numeric:tabular-nums;">${mins}:${secs}</span>
      </span>`;
      controlButton.title = `SOOP 원본 녹화 중 · ${mb(S.bytes)} MiB · 좌클릭: 중지 · 우클릭: 상세 정보`;
    } else if (S.canStart) {
      controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:#00c471;transition:transform .15s ease;"></span>
      </span>`;
      controlButton.title = "SOOP 원본 녹화 준비 완료 · 좌클릭: 녹화 시작 · 우클릭: 상세 정보";
    } else {
      controlButton.innerHTML = `
      <span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;">
        <span style="display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid #666666;background:transparent;box-sizing:border-box;"></span>
      </span>`;
      controlButton.title = "SOOP 원본 녹화 초기화 세그먼트 준비 중";
    }
  }
  function installControlButton() {
    setControlButtonUpdater(updateControlButton);
    const styleEl = document.createElement("style");
    styleEl.textContent = `
    @keyframes soopAllRecordPulse { 0% { transform: scale(0.92); opacity: 0.8; } 50% { transform: scale(1.18); opacity: 1; box-shadow: 0 0 12px #ef4444; } 100% { transform: scale(0.92); opacity: 0.8; } }
    @keyframes soopAllRecordSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn_soop_all_record:hover { filter: brightness(1.2); }
    .btn_soop_all_record:active { transform: scale(0.94); }
  `;
    document.head.appendChild(styleEl);
    const attach = () => {
      if (controlButton == null ? void 0 : controlButton.isConnected) return true;
      const right = document.querySelector("div.right_ctrl");
      if (!right) return false;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn_soop_all_record";
      button.setAttribute("aria-label", "SOOP 원본 녹화");
      Object.assign(button.style, {
        minWidth: "36px",
        height: "32px",
        padding: "0 4px",
        margin: "0 3px",
        border: "0",
        background: "transparent",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        outline: "none",
        transition: "transform 0.15s ease"
      });
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (S.recording || S.starting || S.stopping || !S.canStart) {
          showPopover();
        } else {
          beginFromUi();
        }
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openDebug();
      });
      right.prepend(button);
      controlButton = button;
      updateControlButton();
      setInterval(() => {
        updateControlButton();
        if ((popover == null ? void 0 : popover.style.display) === "block") {
          showPopover(false);
        }
      }, 1e3);
      return true;
    };
    if (attach()) return;
    const observer = new MutationObserver(() => {
      if (attach()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
  function dashboard(channelId) {
    try {
      page.stop();
    } catch (_) {
    }
    const bus2 = new page.BroadcastChannel(channelId);
    const D = { snap: null, logs: [] };
    document.documentElement.innerHTML = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>SOOP 원본 녹화 · 상세 모니터링</title>
  <style>
    :root {
      --bg-base: #121212;
      --bg-surface: #1c1c1c;
      --bg-card: #232323;
      --bg-card-hover: #292929;
      --bg-input: #161616;
      
      --border: #2c2c2c;
      --border-light: #242424;
      
      --text-main: #ffffff;
      --text-sub: #a6a6a6;
      --text-muted: #6e6e6e;
      
      --accent-green: #00c471;
      --accent-green-hover: #00b065;
      --accent-red: #ff4d4f;
      --accent-orange: #ffa000;
      --accent-blue: #1890ff;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    
    body {
      background: var(--bg-base);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Segoe UI", Roboto, "Noto Sans KR", sans-serif;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 60px;
    }

    /* Header */
    header {
      background: var(--bg-base);
      border-bottom: 1px solid var(--border);
      padding: 16px 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }

    .brand-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-icon {
      width: 32px;
      height: 32px;
      border-radius: 9px;
      background: var(--accent-green);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #121212;
      font-weight: 900;
      font-size: 16px;
    }

    .brand-title {
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.4px;
      color: var(--text-main);
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .brand-version {
      font-size: 11px;
      font-weight: 700;
      background: var(--bg-card);
      color: var(--text-sub);
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all .15s ease;
      border: 1px solid var(--border);
      background: var(--bg-surface);
      color: var(--text-main);
      outline: none;
      user-select: none;
    }

    .btn:hover {
      background: var(--bg-card-hover);
      border-color: #3e3e3e;
    }

    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    .btn-green {
      background: var(--accent-green);
      color: #121212;
      border-color: transparent;
      font-weight: 700;
    }
    .btn-green:hover { background: var(--accent-green-hover); color: #121212; }

    .btn-red {
      background: var(--accent-red);
      color: #ffffff;
      border-color: transparent;
      font-weight: 700;
    }
    .btn-red:hover { background: #f5222d; color: #fff; }

    /* Layout Container */
    .main-container {
      max-width: 1400px;
      margin: 28px auto 0;
      padding: 0 40px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    /* Top KPI 3-Column Summary Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }

    @media (max-width: 900px) {
      .summary-grid { grid-template-columns: 1fr; }
    }

    .summary-card {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .summary-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-sub);
    }

    .summary-value {
      font-size: 36px;
      font-weight: 800;
      letter-spacing: -1px;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
      line-height: 1.2;
    }

    .summary-desc {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    /* Full-width Panels */
    .panel {
      background: var(--bg-surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 22px 26px;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 18px;
      padding-bottom: 14px;
      border-bottom: 1px solid var(--border-light);
    }

    .panel-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-main);
      letter-spacing: -0.3px;
    }

    .panel-subinfo {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Sub KPI 4-Column Row */
    .sub-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }

    @media (max-width: 1000px) {
      .sub-grid { grid-template-columns: repeat(2, 1fr); }
    }

    .sub-card {
      background: var(--bg-card);
      border: 1px solid var(--border-light);
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sub-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
    }

    .sub-value {
      font-size: 22px;
      font-weight: 800;
      color: var(--text-main);
      font-variant-numeric: tabular-nums;
    }

    /* Value colors */
    .val-green { color: var(--accent-green) !important; }
    .val-red { color: var(--accent-red) !important; }
    .val-orange { color: var(--accent-orange) !important; }

    /* Badges / Pills */
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
    }

    .pill-green { background: var(--accent-green); color: #121212; }
    .pill-red { background: var(--accent-red); color: #ffffff; }
    .pill-orange { background: var(--accent-orange); color: #121212; }
    .pill-dark { background: var(--bg-card); color: var(--text-sub); border: 1px solid var(--border); }

    /* Tables (Clean & Spacious) */
    .table-box {
      width: 100%;
      overflow-x: auto;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--bg-card);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 13px;
    }

    th {
      background: var(--bg-surface);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    td {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border-light);
      color: var(--text-sub);
      vertical-align: middle;
      white-space: nowrap;
    }

    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); color: var(--text-main); }

    code {
      font-family: "JetBrains Mono", Consolas, monospace;
      background: var(--bg-input);
      color: #93c5fd;
      padding: 3px 7px;
      border-radius: 5px;
      font-size: 12px;
      border: 1px solid var(--border);
    }

    /* Terminal & Diagnostics */
    .log-box {
      height: 240px;
      overflow-y: auto;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 18px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.65;
      color: var(--text-sub);
    }

    .log-row {
      display: flex;
      gap: 10px;
      margin-bottom: 2px;
      word-break: break-all;
    }

    .log-t { color: var(--text-muted); flex-shrink: 0; }
    .log-tag { color: #58a6ff; font-weight: 600; flex-shrink: 0; }
    .log-m { color: var(--text-main); }
    .log-row.error .log-m { color: var(--accent-red); font-weight: 600; }
    .log-row.warn .log-m { color: var(--accent-orange); }

    .json-textarea {
      width: 100%;
      height: 160px;
      background: var(--bg-input);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      font-family: "JetBrains Mono", Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
      resize: vertical;
      outline: none;
    }

    .empty-row {
      padding: 28px;
      text-align: center;
      color: var(--text-muted);
      font-size: 13px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand-group">
      <div class="brand-icon">S</div>
      <div class="brand-title">
        <span>SOOP 원본 녹화 대시보드</span>
        <span class="brand-version" id="engineVersion">v4.0</span>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn" id="refreshBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        새로고침
      </button>
      <button class="btn btn-green" id="startBtn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
        녹화 시작 · 폴더 선택
      </button>
      <button class="btn btn-red" id="stopBtn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        녹화 중지
      </button>
      <button class="btn" id="copyJsonBtn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        진단 JSON 복사
      </button>
    </div>
  </header>

  <main class="main-container">
    <!-- Top 3-Card Summary Grid (LiveDownload Style) -->
    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">녹화 상태</div>
        <div class="summary-value" id="kpiStatus">-</div>
        <div class="summary-desc" id="kpiStatusDesc">스트림 감지 대기 중</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">녹화 시간 및 용량</div>
        <div class="summary-value" id="kpiTime">00:00</div>
        <div class="summary-desc" id="kpiSizeDesc">누적 저장: 0 MiB</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">저장 완료 조각 (Chunks)</div>
        <div class="summary-value" id="kpiChunks">0</div>
        <div class="summary-desc" id="kpiChunksDesc">누락: 0개 · 큐 대기: 0 MiB</div>
      </div>
    </div>

    <!-- 미디어 조각 및 파이프라인 지표 (4-Column) -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">미디어 청크(Chunk) 파이프라인 지표</h2>
        <span class="panel-subinfo">Direct-to-Disk 무손실 무재인코딩</span>
      </div>
      <div class="sub-grid" id="pipelineGrid"></div>
      <div id="missingReport" style="margin-top:14px;padding:12px 18px;background:var(--bg-card);border:1px solid var(--border-light);border-radius:10px;font-size:13px;"></div>
    </section>

    <!-- 녹화 세그먼트 (Part 목록) - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">녹화 파일 세그먼트 (Part 목록)</h2>
      </div>
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th style="width:10%">Part</th>
              <th style="width:18%">생성 사유</th>
              <th style="width:14%">화질/해상도</th>
              <th style="width:14%">저장율 (청크)</th>
              <th style="width:12%">상태</th>
              <th style="width:32%">파일명</th>
            </tr>
          </thead>
          <tbody id="partsTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- 활성 미디어 버퍼 (MSE) - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">활성 미디어 소스 버퍼 (MSE 트랙)</h2>
      </div>
      <div class="table-box">
        <table>
          <thead>
            <tr>
              <th style="width:8%">트랙</th>
              <th style="width:24%">MIME / Codecs</th>
              <th style="width:24%">Init 헤더 메타</th>
              <th style="width:14%">저장 완료</th>
              <th style="width:12%">대기 큐</th>
              <th style="width:18%">최근 패킷 박스</th>
            </tr>
          </thead>
          <tbody id="buffersTableBody"></tbody>
        </table>
      </div>
    </section>

    <!-- 타임라인 무결성 & 최종 파일 - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">타임라인 무결성 및 완료 파일</h2>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div id="anomaliesBox"></div>
        <div id="outputBox"></div>
      </div>
    </section>

    <!-- 실시간 이벤트 콘솔 - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">실시간 이벤트 콘솔</h2>
        <span class="panel-subinfo">실시간 파이프라인 이벤트</span>
      </div>
      <div id="logTerminal" class="log-box"></div>
    </section>

    <!-- 진단 JSON 데이터 - Full Width -->
    <section class="panel">
      <div class="panel-header">
        <h2 class="panel-title">진단 데이터 스냅샷 (JSON)</h2>
      </div>
      <textarea id="jsonBox" class="json-textarea" readonly></textarea>
    </section>
  </main>
</body>
</html>`;
    const $ = (q) => document.querySelector(q);
    const esc = (x) => String(x ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const cmd = (command, x = {}) => bus2.postMessage({ type: "command", command, ...x });
    function diag() {
      const snapshot = D.snap ? structuredClone(D.snap) : null;
      if (snapshot) {
        delete snapshot.logs;
      }
      return {
        dashboard: { generatedAt: (/* @__PURE__ */ new Date()).toISOString(), channelId },
        snapshot,
        recentLogs: D.logs.slice(-100)
      };
    }
    function render(s) {
      D.snap = s;
      const c = s.capture;
      const f = c.fragments;
      const isReady = c.canStart && !c.recording && !c.starting && !c.stopping;
      const stateTitle = c.rotating ? "Part 교체 중" : c.starting ? "파일 생성 중" : c.stopping ? "파일 마무리 중" : c.recording ? "녹화 진행 중" : isReady ? c.completedAt ? "저장 완료 (새 녹화 대기)" : "녹화 준비 완료" : "스트림 감지 대기";
      const stateColorClass = c.error ? "val-red" : c.recording ? "val-red" : isReady ? "val-green" : "val-orange";
      const startBtn2 = $("#startBtn");
      if (startBtn2) {
        startBtn2.disabled = !isReady;
        startBtn2.textContent = isReady ? "녹화 시작 · 폴더 선택" : c.recording ? "녹화 진행 중" : "스트림 대기 중";
      }
      const stopBtn2 = $("#stopBtn");
      if (stopBtn2) {
        stopBtn2.disabled = !c.recording || c.stopping;
      }
      const engineVersion = $("#engineVersion");
      if (engineVersion && s.version) {
        engineVersion.textContent = `v${s.version}`;
      }
      const elapsedMins = String(Math.floor(c.elapsedSeconds / 60)).padStart(2, "0");
      const elapsedSecs = String(c.elapsedSeconds % 60).padStart(2, "0");
      const kpiStatus = $("#kpiStatus");
      if (kpiStatus) {
        kpiStatus.className = `summary-value ${stateColorClass}`;
        kpiStatus.textContent = stateTitle;
      }
      const kpiStatusDesc = $("#kpiStatusDesc");
      if (kpiStatusDesc) {
        kpiStatusDesc.textContent = c.recording ? `Part ${c.partCount} 녹화 진행 중 · 오류 없음` : isReady ? c.completedAt ? `이전 녹화 저장 완료 (${c.sizeMiB} MiB) · 다음 녹화 가능` : "스트림 준비 완료 · 언제든 녹화 시작 가능" : "SOOP 플레이어 스트림 연결 대기 중";
      }
      const kpiTime = $("#kpiTime");
      if (kpiTime) {
        kpiTime.textContent = `${elapsedMins}:${elapsedSecs}`;
      }
      const kpiSizeDesc = $("#kpiSizeDesc");
      if (kpiSizeDesc) {
        kpiSizeDesc.textContent = `누적 저장: ${c.sizeMiB} MiB (Part ${c.partCount})`;
      }
      const kpiChunks = $("#kpiChunks");
      if (kpiChunks) {
        kpiChunks.className = `summary-value ${f.written > 0 ? "val-green" : ""}`;
        kpiChunks.textContent = `${f.written} / ${f.queued}`;
      }
      const kpiChunksDesc = $("#kpiChunksDesc");
      if (kpiChunksDesc) {
        kpiChunksDesc.textContent = `누락 확정: ${f.missingCount}개 · 디스크 대기 큐: ${c.pendingMiB} MiB`;
      }
      const pipelineGrid = $("#pipelineGrid");
      if (pipelineGrid) {
        pipelineGrid.innerHTML = `
        <div class="sub-card">
          <div class="sub-label">관찰된 세그먼트 청크</div>
          <div class="sub-value">${f.observed}</div>
        </div>
        <div class="sub-card">
          <div class="sub-label">디스크 쓰기 대기 큐</div>
          <div class="sub-value ${c.pendingMiB > 128 ? "val-orange" : ""}">${c.pendingMiB} <span style="font-size:13px;color:var(--text-muted)">MiB</span></div>
        </div>
        <div class="sub-card">
          <div class="sub-label">화질 변경 횟수</div>
          <div class="sub-value">${c.qualityChanges} <span style="font-size:13px;color:var(--text-muted)">회</span></div>
        </div>
        <div class="sub-card">
          <div class="sub-label">플레이어 재연결</div>
          <div class="sub-value">${c.reconnects} <span style="font-size:13px;color:var(--text-muted)">회</span></div>
        </div>`;
      }
      const missingReport = $("#missingReport");
      if (missingReport) {
        missingReport.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--accent-red);font-weight:700;min-width:110px">확정 누락 번호:</span>
            <code>${esc(f.missingConfirmed.join(", ") || "누락 없음 (완벽 수신)")}</code>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="color:var(--accent-orange);font-weight:700;min-width:110px">판정 대기 번호:</span>
            <code>${esc(f.missingPending.join(", ") || "대기 항목 없음")}</code>
          </div>
        </div>`;
      }
      const reasonMap = {
        "user-start": "사용자 시작",
        "quality-change": "화질·코덱 변경",
        reconnect: "플레이어 재연결"
      };
      const partsTableBody = $("#partsTableBody");
      if (partsTableBody) {
        partsTableBody.innerHTML = s.parts.map(
          (p) => `
        <tr>
          <td><span class="pill pill-green">Part ${p.number}</span></td>
          <td>${esc(reasonMap[p.reason] || p.reason)}</td>
          <td><span class="pill pill-dark">${esc(p.label || "자동 감지")}</span></td>
          <td><span class="pill ${p.writtenChunks === p.chunks ? "pill-green" : "pill-orange"}">${p.writtenChunks}/${p.chunks}</span></td>
          <td><span class="pill ${p.status === "closed" ? "pill-dark" : "pill-red"}">${esc(p.status)}</span></td>
          <td><div style="word-break:break-all;white-space:normal;color:var(--text-sub)">${p.files.map((x) => esc(x.name)).join("<br>")}</div></td>
        </tr>`
        ).join("") || '<tr><td colspan="6" class="empty-row">기록된 세그먼트가 없습니다.</td></tr>';
      }
      const buffersTableBody = $("#buffersTableBody");
      if (buffersTableBody) {
        buffersTableBody.innerHTML = s.buffers.map(
          (r) => {
            var _a;
            return `
        <tr>
          <td><b>#${r.id}</b></td>
          <td><code>${esc(r.mime)}</code></td>
          <td>
            <span class="${r.initReady ? "val-green" : "val-orange"}" style="font-weight:700">${r.firstBox} (${r.initBytes} B)</span>
            ${((_a = r.initMeta) == null ? void 0 : _a.label) ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">${esc(r.initMeta.label)}</div>` : ""}
          </td>
          <td><span class="pill ${r.writtenChunks === r.sessionChunks ? "pill-green" : "pill-orange"}">${r.writtenChunks}/${r.sessionChunks}</span></td>
          <td>${r.pendingWrites}</td>
          <td><code>${esc(r.lastBoxes.map((b) => b.type).join(","))}</code></td>
        </tr>`;
          }
        ).join("") || '<tr><td colspan="6" class="empty-row">연결된 MSE 소스 버퍼가 없습니다.</td></tr>';
      }
      const anomaliesBox = $("#anomaliesBox");
      if (anomaliesBox) {
        anomaliesBox.innerHTML = f.discontinuities.length ? f.discontinuities.map(
          (x) => `
          <div style="padding:12px 18px;background:rgba(255,160,0,0.15);border:1px solid var(--accent-orange);border-radius:10px;color:var(--accent-orange);font-size:13px">
            Track ${x.trackId} · ${esc(x.type)} · seq ${x.sequence ?? "-"}
          </div>`
        ).join("") : '<div style="padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;color:var(--accent-green);font-size:13px;font-weight:700">✓ 타임라인 불연속(이상 감지) 없음 · 원본 스트림 안정 수신 중</div>';
      }
      const outputBox = $("#outputBox");
      if (outputBox) {
        outputBox.innerHTML = c.mergeScript ? `
        <div style="padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;font-size:13px">
          <div style="margin-bottom:6px;font-weight:700;color:var(--accent-green)">무손실 파일 저장 완료</div>
          <div style="margin-bottom:4px"><b>병합 스크립트:</b> <code>${esc(c.mergeScript)}</code></div>
          <div><b>최종 완성 파일:</b> <code>${esc(c.mergedFilename)}</code></div>
        </div>` : `<div style="color:var(--text-muted);font-size:13px;padding:14px 18px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px">녹화 중지 시 무손실 병합 스크립트(.bat)와 메타데이터 JSON이 디스크에 자동 생성됩니다.</div>`;
      }
      D.logs = s.logs.slice(-100);
      renderLogs();
      const jsonBox = $("#jsonBox");
      if (jsonBox) {
        jsonBox.value = JSON.stringify(diag(), null, 2);
      }
    }
    function renderLogs() {
      const e = $("#logTerminal");
      if (!e) return;
      e.innerHTML = D.logs.map((x) => {
        var _a;
        const timeStr = x.time ? (_a = x.time.split("T")[1]) == null ? void 0 : _a.slice(0, 8) : "";
        const levelClass = x.level === "error" ? "error" : x.level === "warn" ? "warn" : "";
        return `<div class="log-row ${levelClass}">
          <span class="log-t">[${esc(timeStr)}]</span>
          <span class="log-tag">[${esc(x.type)}]</span>
          <span class="log-m">${esc(x.message)} ${x.data ? esc(JSON.stringify(x.data)) : ""}</span>
        </div>`;
      }).join("");
      e.scrollTop = e.scrollHeight;
    }
    bus2.addEventListener("message", (e) => {
      const m = e.data;
      if ((m == null ? void 0 : m.type) === "snapshot") {
        render(m.snapshot);
      }
      if ((m == null ? void 0 : m.type) === "log") {
        D.logs.push(m.entry);
        if (D.logs.length > 1e3) {
          D.logs.shift();
        }
        renderLogs();
      }
      if ((m == null ? void 0 : m.type) === "result" && !m.ok) {
        alert(m.error);
      }
    });
    const refreshBtn = $("#refreshBtn");
    if (refreshBtn) refreshBtn.onclick = () => cmd("snapshot");
    const startBtn = $("#startBtn");
    if (startBtn) {
      startBtn.onclick = async () => {
        try {
          if (!page.showDirectoryPicker) {
            throw new Error("File System Access API 미지원");
          }
          const directoryHandle = await page.showDirectoryPicker({
            mode: "readwrite",
            id: "soop-all-record"
          });
          cmd("start", { directoryHandle });
        } catch (e) {
          if ((e == null ? void 0 : e.name) !== "AbortError") {
            alert((e == null ? void 0 : e.message) || e);
          }
        }
      };
    }
    const stopBtn = $("#stopBtn");
    if (stopBtn) stopBtn.onclick = () => cmd("stop");
    const copyJsonBtn = $("#copyJsonBtn");
    if (copyJsonBtn) {
      copyJsonBtn.onclick = async () => {
        const t = JSON.stringify(diag(), null, 2);
        try {
          await navigator.clipboard.writeText(t);
        } catch (_) {
          const box = $("#jsonBox");
          if (box) {
            box.select();
            document.execCommand("copy");
          }
        }
        alert("진단 JSON 데이터가 클립보드에 복사되었습니다.");
      };
    }
    cmd("snapshot");
    setTimeout(() => cmd("snapshot"), 300);
    setTimeout(() => cmd("snapshot"), 1e3);
    setInterval(() => {
      cmd("snapshot");
    }, 1e3);
  }
  if (debugId) {
    dashboard(debugId);
  } else {
    setupMseHooks();
    bus.addEventListener("message", (e) => {
      const m = e.data;
      if ((m == null ? void 0 : m.type) !== "command") return;
      if (m.command === "snapshot") {
        send();
      }
      if (m.command === "start") {
        start(m.directoryHandle).catch(
          (err) => bus.postMessage({ type: "result", ok: false, error: String((err == null ? void 0 : err.message) || err) })
        );
      }
      if (m.command === "stop") {
        stop();
      }
    });
    page.__SOOP_ALL_RECORD__ = { state: S, snapshot: snap, start, stop };
    log("info", "installed", "후킹 완료: init만 RAM 보관, 미디어는 디스크 직결", { limit: "none", channelId: id });
    installControlButton();
    setInterval(() => {
      const current = location.pathname.split("/").filter(Boolean).pop();
      if (current !== S.broadcastId) {
        const previous = S.broadcastId;
        S.broadcastId = current;
        log("warn", "broadcast-changed", "방송 ID 변경 감지", { previous, current });
        if (S.recording) {
          toast("다른 방송으로 이동하여 기존 녹화를 마무리합니다.", "warn", 6e3);
          stop();
        }
      }
    }, 1e3);
    page.addEventListener("beforeunload", (event) => {
      if (S.recording || S.stopping || S.rotating) {
        event.preventDefault();
        event.returnValue = "녹화 파일을 기록 중입니다.";
      }
    });
    setTimeout(send, 500);
    setTimeout(send, 1500);
    setTimeout(send, 3e3);
  }

})();