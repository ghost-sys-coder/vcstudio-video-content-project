import { describe, expect, it } from "vitest";
import { formatBytes } from "@/lib/format/bytes";

describe("formatBytes", () => {
  it("formats each magnitude with a readable unit", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(25 * 1024 * 1024)).toBe("25 MB");
    expect(formatBytes(512 * 1024 * 1024)).toBe("512 MB");
    expect(formatBytes(4 * 1024 * 1024 * 1024)).toBe("4 GB");
  });

  it("keeps one decimal only for small values, where it carries information", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(15 * 1024 + 512)).toBe("16 KB");
  });

  it("degrades safely rather than printing NaN", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});
