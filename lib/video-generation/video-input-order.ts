/** Keyframe order is a protocol guarantee; reference ordering stays user-defined. */
export function orderedVideoInputs<T extends { role: string }>(
  mode: string,
  inputs: readonly T[],
): T[] {
  return mode === "image_to_video"
    ? [
        ...inputs.filter((input) => input.role === "first_frame"),
        ...inputs.filter((input) => input.role === "last_frame"),
      ]
    : [...inputs];
}
