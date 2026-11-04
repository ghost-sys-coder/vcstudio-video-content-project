import type { ComponentProps } from "react";

export default function MockNextLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
