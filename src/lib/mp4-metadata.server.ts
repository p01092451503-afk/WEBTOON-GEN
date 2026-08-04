export type VideoMetadata = {
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  resolution: string | null;
};
const typeAt = (bytes: Uint8Array, offset: number) =>
  String.fromCharCode(
    bytes[offset] ?? 0,
    bytes[offset + 1] ?? 0,
    bytes[offset + 2] ?? 0,
    bytes[offset + 3] ?? 0,
  );
const u32 = (view: DataView, offset: number) => view.getUint32(offset, false);
function boxes(bytes: Uint8Array, start = 0, end = bytes.length) {
  const result: Array<{ type: string; body: number; end: number }> = [];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = start; offset + 8 <= end; ) {
    const size = u32(view, offset);
    if (size < 8 || offset + size > end) break;
    result.push({ type: typeAt(bytes, offset + 4), body: offset + 8, end: offset + size });
    offset += size;
  }
  return result;
}

export function readMp4Metadata(bytes: Uint8Array): VideoMetadata {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const moov = boxes(bytes).find((box) => box.type === "moov");
  let durationSeconds: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  if (moov) {
    const children = boxes(bytes, moov.body, moov.end);
    const mvhd = children.find((box) => box.type === "mvhd");
    if (mvhd) {
      const version = bytes[mvhd.body];
      const timescaleOffset = mvhd.body + (version === 1 ? 20 : 12);
      const durationOffset = mvhd.body + (version === 1 ? 24 : 16);
      const timescale = u32(view, timescaleOffset);
      const duration =
        version === 1
          ? Number(view.getBigUint64(durationOffset, false))
          : u32(view, durationOffset);
      if (timescale > 0) durationSeconds = Math.round((duration / timescale) * 100) / 100;
    }
    for (const trak of children.filter((box) => box.type === "trak")) {
      const tkhd = boxes(bytes, trak.body, trak.end).find((box) => box.type === "tkhd");
      if (!tkhd) continue;
      const w = u32(view, tkhd.end - 8) / 65536;
      const h = u32(view, tkhd.end - 4) / 65536;
      if (w > 0 && h > 0) {
        width = Math.round(w);
        height = Math.round(h);
        break;
      }
    }
  }
  const edge = Math.max(width ?? 0, height ?? 0);
  const resolution = edge >= 1800 ? "1080p" : edge >= 1200 ? "720p" : edge > 0 ? "480p" : null;
  return { width, height, durationSeconds, resolution };
}
