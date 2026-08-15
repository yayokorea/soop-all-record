/**
 * [4] 파일 시스템 및 Part 녹화 스트림 관리 (Disk Stream & Part Rotation)
 */

import { S, iso, mb, log, snap } from '../config/state.js';
import { resetFragmentStats } from '../parser/fragmentTracker.js';
import { toast, friendlyError } from '../ui/toast.js';
import { updateControlButton, send } from './mseHook.js';

export const kind = r => (r.mime.includes('video') ? 'video' : r.mime.includes('audio') ? 'audio' : `buffer-${r.id}`);
export const ext = r => (r.mime.includes('mp4') ? 'mp4' : r.mime.includes('webm') ? 'webm' : 'bin');

export const clean = (value, fallback = '') => {
  const str = value !== undefined && value !== null ? String(value) : fallback;
  const result = str
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();
  return (result || fallback).slice(0, 80);
};

export const localStamp = () => {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
};

export const streamerName = () => {
  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const nick = win.szBjNick
    || win.oBroadInfo?.szBjNick
    || win.oBroadInfo?.bjNick
    || win.liveInfo?.bjNick
    || document.querySelector('.streamer_nick, button[report-name="bj_nickname"], .nickname, a.nickname')?.textContent?.trim()
    || ((document.title || '').split('•')[1] || '').replace(/\|\s*SOOP.*/i, '').trim();
  return clean(nick, '');
};

export const broadcastTitle = () => {
  const win = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const title = win.szBroadTitle
    || win.oBroadInfo?.szBroadTitle
    || (document.title || 'SOOP').split('•')[0].trim();
  return clean(title, 'SOOP');
};

export const broadcastName = () => {
  const streamer = streamerName();
  const title = broadcastTitle();
  if (streamer) {
    return `${streamer}_${title}`;
  }
  return title;
};
export const activeRecords = () => {
  const active = [...S.activeByKind.values()].filter(r => r.init);
  if (active.length > 0) return active;
  return [...S.buffers.values()].filter(r => r.init);
};
export const partTag = () => `part${String(S.partNo).padStart(3, '0')}`;

export async function closeActiveWriters() {
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

export async function openPart(reason) {
  const records = activeRecords();
  if (!records.length || !records.every(r => r.init)) {
    throw new Error('새 Part 초기화 세그먼트가 준비되지 않았습니다.');
  }

  S.partNo++;
  const tag = partTag();
  const part = {
    number: S.partNo,
    reason,
    generation: Math.max(...records.map(r => r.generation)),
    label: records.find(r => kind(r) === 'video')?.initMeta?.label || 'unknown',
    startedAt: iso(),
    endedAt: null,
    bytes: 0,
    chunks: 0,
    writtenChunks: 0,
    files: [],
    status: 'recording'
  };

  for (const r of records) {
    const suffix = kind(r) === 'video' ? '영상' : kind(r) === 'audio' ? '음성' : `트랙${r.id}`;
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

export async function rotatePart(reason) {
  if (!S.recording || S.rotating) return;

  S.rotating = true;
  S.rotationReason = reason;
  send();
  toast(`${reason === 'quality-change' ? '화질 변경' : '재연결'} 감지 · Part 전환 중`, 'warn', 3000);

  try {
    await new Promise(resolve => setTimeout(resolve, 650));

    if (reason === 'reconnect') {
      for (let i = 0; i < 20; i++) {
        const records = activeRecords();
        const max = Math.max(...records.map(r => r.generation));
        if (
          records.some(r => kind(r) === 'video' && r.generation === max) &&
          records.some(r => kind(r) === 'audio' && r.generation === max)
        ) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    const old = S.parts.at(-1);
    const files = await closeActiveWriters();
    if (old) {
      old.endedAt = iso();
      old.status = 'closed';
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

    log('info', 'part-rotated', '새 Part로 녹화 계속', {
      reason,
      part: part.number,
      label: part.label,
      queued: queued.length,
      discardedOldSource: discarded
    });
    toast(`Part ${part.number} (${part.label}) 녹화 시작`);
  } catch (error) {
    S.error = String(error?.stack || error);
    S.recording = false;
    S.rotating = false;
    log('error', 'rotate-error', 'Part 전환 실패', { error: S.error });
    toast(friendlyError(error), 'error', 8000);
  } finally {
    send();
  }
}

export async function createSessionArtifacts() {
  const parts = S.parts;
  if (!parts.length) return null;

  const outputs = [];
  const commands = [];

  for (const p of parts) {
    const v = p.files.find(f => f.kind === 'video');
    const a = p.files.find(f => f.kind === 'audio');

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
    '@echo off',
    'chcp 65001 >nul',
    'echo ========================================================',
    'echo   SOOP 원본 녹화 무손실 병합 스크립트',
    'echo ========================================================',
    '',
    ...commands.flatMap((cmd, index) => [
      `echo [Part ${index + 1}/${commands.length}] 병합 진행 중...`,
      cmd,
      'if errorlevel 1 ( echo [오류] ffmpeg 병합 실패 & pause & exit /b 1 )',
      ''
    ]),
    'echo --------------------------------------------------------',
    'echo 모든 Part의 무손실 MP4 생성이 완료되었습니다!',
    'echo --------------------------------------------------------',
    'pause',
    ''
  ].join('\r\n');

  const scriptHandle = await S.directory.getFileHandle(scriptName, { create: true });
  const writable = await scriptHandle.createWritable({ keepExistingData: false });
  await writable.write(new TextEncoder().encode(script));
  await writable.close();

  S.mergeScript = scriptName;
  S.mergedFilename = outputs.join(', ');

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

export function queue(r, data, part) {
  r.pending++;
  S.pendingBytes += data.byteLength;
  S.peakPendingBytes = Math.max(S.peakPendingBytes, S.pendingBytes);

  r.chain = r.chain
    .then(() => r.writable.write(data))
    .then(
      () => {
        S.fragmentStats.written++;
        r.writtenChunks++;
        if (part) {
          part.writtenChunks++;
        }
      },
      e => {
        r.error = String(e?.stack || e);
        S.error = r.error;
        S.recording = false;
        S.fragmentStats.failed++;
        log('error', 'write-error', `Buffer ${r.id} 쓰기 실패`, { error: r.error });
      }
    )
    .finally(() => {
      r.pending--;
      S.pendingBytes = Math.max(0, S.pendingBytes - data.byteLength);
    });
}

export function writeFragment(r, data, info, bs) {
  const target = S.activeByKind.get(kind(r));
  if (!target?.writable) {
    S.fragmentStats.failed++;
    log('error', 'no-writer', '활성 파일 writer가 없습니다.', {
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
    toast(`디스크 쓰기 지연: ${mb(S.pendingBytes)} MiB 대기`, 'warn', 5000);
  }
  if (S.pendingBytes > 536870912) {
    toast('쓰기 지연 초과로 녹화를 중지합니다.', 'error', 8000);
    stop();
  }
  if (S.chunks <= 10 || S.chunks % 20 === 0) {
    send();
  }
}

export async function start(dir) {
  if (!S.canStart) {
    throw new Error('아직 초기화 세그먼트가 준비되지 않았습니다.');
  }
  S.starting = true;
  S.error = null;
  send();

  const opened = [];
  const stamp = localStamp();
  const baseName = `${broadcastName()}_${stamp}`;

  // 루트 폴더 내에 방송 세션 전용 하위 폴더 자동 생성
  const sessionDir = await dir.getDirectoryHandle(baseName, { create: true });

  S.rootDirectory = dir;
  S.directory = sessionDir;
  S.stamp = stamp;
  S.baseName = baseName;
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
      const suffix = kind(r) === 'video' ? '영상' : kind(r) === 'audio' ? '음성' : `트랙${r.id}`;
      const label = activeRecords().find(x => kind(x) === 'video')?.initMeta?.label || 'unknown';
      const name = `${S.baseName}_part001_${label}_${suffix}.${ext(r)}`;
      const fh = await sessionDir.getFileHandle(name, { create: true });
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
      reason: 'user-start',
      generation: Math.max(...opened.map(r => r.generation)),
      label: opened.find(r => kind(r) === 'video')?.initMeta?.label || 'unknown',
      startedAt: iso(),
      endedAt: null,
      bytes: S.bytes,
      chunks: 0,
      writtenChunks: 0,
      files: opened.map(r => ({ name: r.filename, kind: kind(r), mime: r.mime })),
      status: 'recording'
    });

    S.bytes = opened.reduce((n, r) => n + r.init.byteLength, 0);
    S.parts[0].bytes = S.bytes;
    S.chunks = 0;
    S.startedAt = Date.now();
    S.recording = true;

    log('info', 'started', '디스크 실시간 녹화 시작', {
      files: opened.map(r => r.filename)
    });
  } catch (e) {
    for (const r of opened) {
      try {
        await r.writable.abort();
      } catch (_) {}
      r.writable = null;
    }
    S.error = String(e?.stack || e);
    log('error', 'start-error', '시작 실패', { error: S.error });
    throw e;
  } finally {
    S.starting = false;
    send();
  }
}

export async function stop() {
  if (!S.recording || S.stopping) return;

  S.recording = false;
  S.stopping = true;
  send();

  try {
    const files = await closeActiveWriters();
    const part = S.parts.at(-1);
    if (part) {
      part.endedAt = iso();
      part.status = 'closed';
      part.files = files;
    }

    const merge = await createSessionArtifacts();
    S.completedAt = iso();

    log('info', 'stopped', '파일 쓰기 완료 및 무손실 병합 스크립트 생성', { files, merge });
    const missing = [...S.fragmentStats.missing].filter(([, m]) => m.confirmed).length;
    toast(
      `녹화 완료 (${mb(S.bytes)} MiB, Part ${S.parts.length}개)\n${merge.scriptName} 실행 시 MP4가 생성됩니다.`,
      'ok',
      8000
    );
  } catch (e) {
    S.error = String(e?.stack || e);
    log('error', 'stop-error', '파일 닫기 실패', { error: S.error });
    toast(friendlyError(e), 'error', 8000);
  } finally {
    S.stopping = false;
    S.startedAt = null;
    readiness(true);
  }
}
