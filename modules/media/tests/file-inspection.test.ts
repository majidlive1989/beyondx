import { describe, expect, it } from "vitest";
import { inspectFile } from "../src/infrastructure/file-inspection.js";

describe("media file inspection", () => {
  it("detects PNG signature and dimensions", () => {
    const png = Buffer.alloc(24);
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(png, 0);
    png.writeUInt32BE(640, 16);
    png.writeUInt32BE(480, 20);

    const result = inspectFile(png);
    expect(result).toMatchObject({
      mimeType: "image/png",
      kind: "IMAGE",
      extension: "png",
      width: 640,
      height: 480,
    });
    expect(result?.checksumSha256).toHaveLength(64);
  });

  it("rejects unknown signatures", () => {
    expect(inspectFile(Buffer.from("not-a-supported-file"))).toBeNull();
  });
});
