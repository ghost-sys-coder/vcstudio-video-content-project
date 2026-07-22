import type { SVGProps } from "react";

export function InstagramMarkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24" {...props}>
      <rect
        height="17"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
        width="17"
        x="3.5"
        y="3.5"
      />
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.5" cy="6.7" fill="currentColor" r="1.1" />
    </svg>
  );
}
