/**
 * 미디어 조각(Fragment) 무결성 및 타임라인 불연속성 추적기
 */

import { children } from './boxParser.js';
import { S, createFragmentStats } from '../config/state.js';

const SEEN_LIMIT_PER_STREAM = 512;
const SEEN_LIMIT_PER_GENERATION = 1024;
const MISSING_LIMIT_PER_GENERATION = 512;
const MISSING_DETAIL_LIMIT = 200;
const STREAM_LIMIT = 16;
const GENERATION_LIMIT = 8;
const DISCONTINUITY_DETAIL_LIMIT = 200;
const MAX_TRACKED_GAP = 256;
const CONFIRM_DISTANCE = 8;

export function fragmentInfo(u8) {
  const info = { sequence: null, tracks: [] };
  const top = children(u8, 0, u8.byteLength);
  const moof = top.find(b => b.type === 'moof');
  if (!moof) return info;

  for (const b of children(u8, moof.start + 8, moof.end)) {
    if (b.type === 'mfhd' && b.start + 16 <= b.end) {
      info.sequence = new DataView(u8.buffer, u8.byteOffset + b.start + 12, 4).getUint32(0);
    }

    if (b.type === 'traf') {
      const t = { trackId: null, baseTime: null, sampleCount: null };
      for (const c of children(u8, b.start + 8, b.end)) {
        const v = new DataView(u8.buffer, u8.byteOffset + c.start, c.size);
        if (c.type === 'tfhd' && c.size >= 16) {
          t.trackId = v.getUint32(12);
        }
        if (c.type === 'tfdt' && c.size >= 16) {
          const ver = u8[c.start + 8];
          t.baseTime =
            ver === 1 && c.size >= 20
              ? v.getUint32(12) * 4294967296 + v.getUint32(16)
              : v.getUint32(12);
        }
        if (c.type === 'trun' && c.size >= 16) {
          t.sampleCount = v.getUint32(12);
        }
      }
      info.tracks.push(t);
    }
  }
  return info;
}

export function resetFragmentStats() {
  S.fragmentStats = createFragmentStats();
}

function trimMap(map, limit) {
  while (map.size > limit) {
    map.delete(map.keys().next().value);
  }
}

function addDiscontinuity(st, detail) {
  st.discontinuityCount++;
  st.discontinuities.push(detail);
  if (st.discontinuities.length > DISCONTINUITY_DETAIL_LIMIT) {
    st.discontinuities.shift();
  }
}

function streamStats(st, generation, stream) {
  const key = `g${generation}:${stream}`;
  let stats = st.streams.get(key);
  if (!stats) {
    stats = { key, generation, stream, seen: new Map(), timeline: new Map() };
    st.streams.set(key, stats);
    while (st.streams.size > STREAM_LIMIT) {
      st.streams.delete(st.streams.keys().next().value);
    }
  }
  return stats;
}

function generationStats(st, generation) {
  const key = `g${generation}`;
  let stats = st.generations.get(key);
  if (!stats) {
    stats = { key, generation, highest: null, seen: new Map(), missing: new Map() };
    st.generations.set(key, stats);
    while (st.generations.size > GENERATION_LIMIT) {
      const oldestKey = st.generations.keys().next().value;
      const oldest = st.generations.get(oldestKey);
      for (const detail of oldest.missing.values()) {
        confirmMissing(st, detail);
      }
      st.generations.delete(oldestKey);
    }
  }
  return stats;
}

function confirmMissing(st, detail) {
  if (detail.confirmed) return;
  detail.confirmed = true;
  st.missingPendingCount = Math.max(0, st.missingPendingCount - 1);
  st.missingCount++;
}

function rememberMissing(st, generation, number, detectedAt, detectedBy) {
  const key = `${generation.key}:${number}`;
  const detail = {
    number,
    generation: generation.generation,
    detectedBy,
    detectedAt,
    confirmed: false
  };
  generation.missing.set(number, detail);
  st.missing.set(key, detail);
  st.missingPendingCount++;
  trimMap(st.missing, MISSING_DETAIL_LIMIT);

  while (generation.missing.size > MISSING_LIMIT_PER_GENERATION) {
    const oldestNumber = generation.missing.keys().next().value;
    const oldest = generation.missing.get(oldestNumber);
    confirmMissing(st, oldest);
    generation.missing.delete(oldestNumber);
  }
}

export function observeFragment(info, generation, stream = 'unknown') {
  const st = S.fragmentStats;
  const seq = info.sequence;
  const currentStream = streamStats(st, generation, stream);
  const currentGeneration = generationStats(st, generation);
  st.observed++;
  let duplicate = false;

  if (seq != null) {
    duplicate = currentStream.seen.has(seq);
    if (duplicate) {
      st.duplicates++;
    } else {
      currentStream.seen.set(seq, true);
      trimMap(currentStream.seen, SEEN_LIMIT_PER_STREAM);
    }

    // mfhd sequence는 영상·음성이 공유할 수 있으므로 누락은 generation 전체의 합집합으로 판정한다.
    if (!currentGeneration.seen.has(seq)) {
      currentGeneration.seen.set(seq, true);
      trimMap(currentGeneration.seen, SEEN_LIMIT_PER_GENERATION);

      const missing = currentGeneration.missing.get(seq);
      if (missing) {
        currentGeneration.missing.delete(seq);
        st.missing.delete(`${currentGeneration.key}:${seq}`);
        if (missing.confirmed) {
          st.missingCount = Math.max(0, st.missingCount - 1);
        } else {
          st.missingPendingCount = Math.max(0, st.missingPendingCount - 1);
        }
        st.late++;
      }

      if (currentGeneration.highest != null && seq > currentGeneration.highest + 1) {
        const gap = seq - currentGeneration.highest - 1;
        if (gap <= MAX_TRACKED_GAP) {
          for (let n = currentGeneration.highest + 1; n < seq; n++) {
            rememberMissing(st, currentGeneration, n, seq, stream);
          }
        } else {
          st.untrackedGapSequences += gap;
          addDiscontinuity(st, {
            stream,
            type: 'sequence-jump',
            from: currentGeneration.highest,
            to: seq,
            gap,
            sequence: seq
          });
        }
      }

      if (currentGeneration.highest == null || seq > currentGeneration.highest) {
        currentGeneration.highest = seq;
        st.highest = seq;
      }

      for (const detail of currentGeneration.missing.values()) {
        if (currentGeneration.highest - detail.number >= CONFIRM_DISTANCE) {
          confirmMissing(st, detail);
        }
      }
    }
  }

  if (duplicate) return;

  for (const t of info.tracks) {
    if (t.trackId != null && t.baseTime != null) {
      const prev = currentStream.timeline.get(t.trackId);
      if (prev) {
        const delta = t.baseTime - prev.base;
        const history = prev.deltas;

        if (delta <= 0) {
          addDiscontinuity(st, {
            stream,
            trackId: t.trackId,
            type: 'backward',
            from: prev.base,
            to: t.baseTime,
            sequence: seq
          });
        } else {
          const sorted = history.slice().sort((a, b) => a - b);
          const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;

          if (median && delta > median * 3) {
            addDiscontinuity(st, {
              stream,
              trackId: t.trackId,
              type: 'gap',
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
        currentStream.timeline.set(t.trackId, { base: t.baseTime, deltas: [] });
      }
    }
  }
}
