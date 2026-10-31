import { Children, isValidElement, type ReactNode } from "react";

/** Supply labels before a portal opens, including items in groups/fragments. */
export function readSelectItems(children: ReactNode): {
  value: string;
  label: ReactNode;
}[] {
  const items: { value: string; label: ReactNode }[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: unknown; children?: ReactNode }>(child))
      return;
    if (typeof child.props.value === "string") {
      items.push({ value: child.props.value, label: child.props.children });
    } else if (child.props.children) {
      items.push(...readSelectItems(child.props.children));
    }
  });
  return items;
}
