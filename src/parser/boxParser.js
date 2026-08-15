/**
 * [2] MP4 / ISO BMFF 바이너리 파서 유틸리티 (Binary Parser)
 */

export function boxes(u8) {
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
    out.push({ type: 'parse-error', error: String(e) });
  }
  return out;
}

export function hashBytes(u8) {
  let h = 2166136261;
  for (const b of u8) {
    h ^= b;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function children(u8, start, end) {
  const out = [];
  let p = start;

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

export function initMeta(u8, mime) {
  let width = null;
  let height = null;
  const top = children(u8, 0, u8.byteLength);
  const moov = top.find(b => b.type === 'moov');

  if (moov) {
    for (const trak of children(u8, moov.start + 8, moov.end).filter(b => b.type === 'trak')) {
      for (const b of children(u8, trak.start + 8, trak.end)) {
        if (b.type === 'tkhd' && b.size >= 16) {
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
    label: width && height ? `${width}x${height}` : mime.includes('audio') ? 'audio' : 'unknown'
  };
}

export const has = (bs, name) => bs.some(b => b.type === name);
