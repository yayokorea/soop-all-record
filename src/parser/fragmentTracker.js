/**
 * 미디어 조각(Fragment) 무결성 및 타임라인 불연속성 추적기
 */

import { children } from './boxParser.js';
import { S } from '../config/state.js';

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
  S.fragmentStats = {
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
  };
}

export function observeFragment(info, generation) {
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
            type: 'backward',
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
        st.timeline.set(t.trackId, { base: t.baseTime, deltas: [] });
      }
    }
  }
}
