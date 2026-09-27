/**
 * Encodes mono floating-point samples as a 16-bit PCM WAV file.
 *
 * Google replicates a voice from WAV and recommends 24 kHz mono 16-bit, while
 * browsers record WebM or MP4. The encoding is written out here rather than
 * pulled from a package because it is a fixed 44-byte header and a clamp.
 */
export function encodeMonoWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  if (!Number.isInteger(sampleRate) || sampleRate <= 0)
    throw new RangeError("The sample rate must be a positive integer.");

  const bytesPerSample = 2;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  let offset = 44;
  for (const sample of samples) {
    // A clipped sample is clamped rather than wrapped, which would turn a
    // loud peak into a full-scale click of the opposite sign.
    const clamped = Math.max(
      -1,
      Math.min(1, Number.isFinite(sample) ? sample : 0),
    );
    view.setInt16(
      offset,
      clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff),
      true,
    );
    offset += bytesPerSample;
  }
  return buffer;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1)
    view.setUint8(offset + index, text.charCodeAt(index));
}
