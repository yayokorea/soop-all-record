/**
 * [5] MSE (MediaSource, SourceBuffer) 후킹 엔진 (MSE Hook Engine)
 */

import { page, S, log, bus, snap, compactBuffers } from '../config/state.js';
import { boxes, initMeta, has } from '../parser/boxParser.js';
import { fragmentInfo, observeFragment } from '../parser/fragmentTracker.js';
import { kind, rotatePart, writeFragment } from './diskWriter.js';

export function view(input) {
  if (input instanceof page.ArrayBuffer) {
    return new page.Uint8Array(input);
  }
  if (page.ArrayBuffer.isView(input)) {
    return new page.Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  return null;
}

export function copy(input) {
  const src = view(input);
  if (!src) return null;
  const dst = new page.Uint8Array(src.byteLength);
  dst.set(src);
  return dst;
}

export function record(sb) {
  let r = S.byObject.get(sb);
  if (!r) {
    r = {
      id: S.nextId++,
      generation: 0,
      mime: 'unknown',
      init: null,
      initBoxes: [],
      initMeta: null,
      firstHex: '',
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
  } else if (!S.buffers.has(r.id)) {
    S.buffers.set(r.id, r);
  }
  compactBuffers([r]);
  return r;
}

export let controlButtonUpdater = () => {};
export function setControlButtonUpdater(fn) {
  controlButtonUpdater = fn;
}

export function updateControlButton() {
  controlButtonUpdater();
}

export function send() {
  updateControlButton();
  bus.postMessage({ type: 'snapshot', snapshot: snap() });
}

export function readiness(immediate = false) {
  clearTimeout(S.readyTimer);

  const check = () => {
    const active = [...S.activeByKind.values()].filter(r => r.init);
    const allWithInit = [...S.buffers.values()].filter(r => r.init);
    
    log(
      'info',
      'readiness',
      S.canStart ? '녹화 시작 가능' : '초기화 세그먼트 대기',
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

export function setupMseHooks() {
  const originalAdd = page.MediaSource.prototype.addSourceBuffer;
  const originalAppend = page.SourceBuffer.prototype.appendBuffer;

  page.MediaSource.prototype.addSourceBuffer = function (mime) {
    let generation = S.mediaSources.get(this);
    if (!generation) {
      generation = S.nextGeneration++;
      S.mediaSources.set(this, generation);
      if (generation > 1) {
        S.reconnects++;
        log('warn', 'media-source-generation', `새 MediaSource generation ${generation} 감지`, {});
      }
    }

    const sb = originalAdd.call(this, mime);
    const r = record(sb);
    r.mime = String(mime || 'unknown');
    r.generation = generation;

    log('info', 'buffer-created', `Buffer ${r.id} 생성`, { mime: r.mime, generation });
    readiness();
    return sb;
  };

  page.SourceBuffer.prototype.appendBuffer = function (input) {
    try {
      const inputView = view(input);
      if (inputView) {
        const r = record(this);
        const bs = boxes(inputView);
        r.observedBytes += inputView.byteLength;
        r.observedChunks++;
        r.lastBoxes = bs;

        if (has(bs, 'ftyp') && has(bs, 'moov')) {
          const data = copy(inputView);
          const previous = r.initMeta;
          const newMeta = initMeta(data, r.mime);
          const previousActive = S.activeByKind.get(kind(r));

          r.init = data;
          r.initBoxes = bs;
          r.initMeta = newMeta;
          r.firstHex = Array.from(data.slice(0, 32))
            .map(v => v.toString(16).padStart(2, '0'))
            .join('');
          S.activeByKind.set(kind(r), r);
          compactBuffers([r]);

          log('info', 'init-cached', `Buffer ${r.id} init 캐시`, {
            bytes: data.byteLength,
            meta: newMeta,
            generation: r.generation
          });
          readiness();

          if (S.recording) {
            const current = S.parts.at(-1);
            const changed =
              (previous && previous.fingerprint !== newMeta.fingerprint) ||
              (previousActive &&
                previousActive !== r &&
                previousActive.initMeta?.fingerprint !== newMeta.fingerprint);
            const reason =
              current && r.generation > current.generation
                ? 'reconnect'
                : changed
                  ? 'quality-change'
                  : null;

            if (reason) {
              if (reason === 'quality-change') {
                S.qualityChanges++;
              }
              rotatePart(reason);
            }
          }
        } else if (S.recording && (has(bs, 'moof') || has(bs, 'mdat'))) {
          const data = copy(inputView);
          const info = fragmentInfo(data);
          observeFragment(info, r.generation, `${kind(r)}#${r.id}`);

          if (S.rotating) {
            S.transitionQueue.push({ record: r, data, info, boxes: bs });
            S.transitionBytes += data.byteLength;
          } else {
            writeFragment(r, data, info, bs);
          }
        }
      }
    } catch (e) {
      S.error = String(e?.stack || e);
      log('error', 'hook-error', 'appendBuffer 후킹 오류', { error: S.error });
    }
    return originalAppend.call(this, input);
  };
}
