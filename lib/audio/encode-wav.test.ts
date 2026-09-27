import { describe, expect, it } from "vitest";
import { encodeMonoWav } from "@/lib/audio/encode-wav";

function ascii(view: DataView, offset: number, length: number) {
  return String.fromCharCode(
    ...Array.from({ length }, (_, index) => view.getUint8(offset + index)),
  );
}

describe("encodeMonoWav", () => {
  it("writes a 24 kHz mono 16-bit PCM header", () => {
    const view = new DataView(encodeMonoWav(new Float32Array(10), 24_000));
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(24_000);
    expect(view.getUint32(28, true)).toBe(48_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(20);
    expect(view.getUint32(4, true)).toBe(36 + 20);
    expect(view.byteLength).toBe(44 + 20);
  });

  it("scales samples to the full signed range and clamps overshoot", () => {
    const view = new DataView(
      encodeMonoWav(
        new Float32Array([0, 1, -1, 2, -2, 0.5, Number.NaN]),
        8_000,
      ),
    );
    const read = (index: number) => view.getInt16(44 + index * 2, true);
    expect(read(0)).toBe(0);
    expect(read(1)).toBe(32_767);
    expect(read(2)).toBe(-32_768);
    expect(read(3)).toBe(32_767);
    expect(read(4)).toBe(-32_768);
    expect(read(5)).toBe(16_384);
    expect(read(6)).toBe(0);
  });

  it("refuses a sample rate that is not a positive integer", () => {
    expect(() => encodeMonoWav(new Float32Array(1), 0)).toThrow(RangeError);
    expect(() => encodeMonoWav(new Float32Array(1), 22_050.5)).toThrow(
      RangeError,
    );
  });
});
