import type { ComponentProps } from "react";

export default function MockNextLink(
  props: ComponentProps<"a"> & { prefetch?: boolean },
) {
  const anchorProps = { ...props };
  delete anchorProps.prefetch;
  return <a {...anchorProps} />;
}
