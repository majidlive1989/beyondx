import { createHash } from "node:crypto";

export interface FileInspection {
  mimeType: string;
  kind: "IMAGE" | "FILE";
  extension: string;
  width: number | null;
  height: number | null;
  checksumSha256: string;
}

export function inspectFile(data: Uint8Array): FileInspection | null {
  const buffer = Buffer.from(data);
  const checksumSha256 = createHash("sha256").update(buffer).digest("hex");

  if (isPng(buffer)) {
    return {
      mimeType: "image/png",
      kind: "IMAGE",
      extension: "png",
      width: buffer.length >= 24 ? buffer.readUInt32BE(16) : null,
      height: buffer.length >= 24 ? buffer.readUInt32BE(20) : null,
      checksumSha256,
    };
  }

  if (isJpeg(buffer)) {
    const dimensions = readJpegDimensions(buffer);
    return {
      mimeType: "image/jpeg",
      kind: "IMAGE",
      extension: "jpg",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      checksumSha256,
    };
  }

  if (isGif(buffer)) {
    return {
      mimeType: "image/gif",
      kind: "IMAGE",
      extension: "gif",
      width: buffer.length >= 10 ? buffer.readUInt16LE(6) : null,
      height: buffer.length >= 10 ? buffer.readUInt16LE(8) : null,
      checksumSha256,
    };
  }

  if (isWebp(buffer)) {
    const dimensions = readWebpDimensions(buffer);
    return {
      mimeType: "image/webp",
      kind: "IMAGE",
      extension: "webp",
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      checksumSha256,
    };
  }

  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return {
      mimeType: "application/pdf",
      kind: "FILE",
      extension: "pdf",
      width: null,
      height: null,
      checksumSha256,
    };
  }

  return null;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isGif(buffer: Buffer): boolean {
  if (buffer.length < 6) return false;
  const signature = buffer.subarray(0, 6).toString("ascii");
  return signature === "GIF87a" || signature === "GIF89a";
}

function isWebp(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === undefined) return null;
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buffer.length) return null;
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null;
  const chunk = buffer.subarray(12, 16).toString("ascii");

  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + readUInt24LE(buffer, 24),
      height: 1 + readUInt24LE(buffer, 27),
    };
  }

  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const b1 = buffer[21] ?? 0;
    const b2 = buffer[22] ?? 0;
    const b3 = buffer[23] ?? 0;
    const b4 = buffer[24] ?? 0;
    return {
      width: 1 + (((b2 & 0x3f) << 8) | b1),
      height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
    };
  }

  if (
    chunk === "VP8 " &&
    buffer.length >= 30 &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  return null;
}

function readUInt24LE(buffer: Buffer, offset: number): number {
  return (buffer[offset] ?? 0) | ((buffer[offset + 1] ?? 0) << 8) | ((buffer[offset + 2] ?? 0) << 16);
}
