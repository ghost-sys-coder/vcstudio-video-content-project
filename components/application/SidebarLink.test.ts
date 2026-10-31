import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type Link from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const links: ComponentProps<typeof Link>[] = [];
  return { links, closeMobile: vi.fn(), changeDesktop: vi.fn() };
});
vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({
    setOpenMobile: mocks.closeMobile,
    setOpen: mocks.changeDesktop,
  }),
}));
vi.mock("next/link", () => ({
  default: (props: ComponentProps<typeof Link>) => {
    mocks.links.push(props);
    return null;
  },
}));
import { SidebarLink } from "./SidebarLink";

function renderLink(props: ComponentProps<typeof Link>) {
  renderToStaticMarkup(createElement(SidebarLink, props));
  const link = mocks.links.at(-1);
  if (!link?.onNavigate)
    throw new Error("The navigation handler was not forwarded.");
  return { ...link, navigate: link.onNavigate };
}
beforeEach(() => {
  mocks.closeMobile.mockReset();
  mocks.changeDesktop.mockReset();
  mocks.links.length = 0;
});

describe("sidebar navigation dismissal", () => {
  it.each(["/app", "/app/projects", "/app/social/posts"])(
    "closes the mobile drawer when navigating to %s",
    (href) => {
      const link = renderLink({ href });
      const event = { preventDefault: vi.fn() };
      link.navigate(event);
      expect(mocks.closeMobile).toHaveBeenCalledExactlyOnceWith(false);
      expect(mocks.changeDesktop).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    },
  );

  it("respects a cancelled navigation and keeps the drawer open", () => {
    const link = renderLink({
      href: "/app/projects",
      onNavigate: (event) => event.preventDefault(),
    });
    const event = { preventDefault: vi.fn() };
    link.navigate(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(mocks.closeMobile).not.toHaveBeenCalled();
  });

  it("lets the caller inspect navigation before dismissing the drawer", () => {
    const order: string[] = [];
    mocks.closeMobile.mockImplementation(() => order.push("close"));
    const link = renderLink({
      href: "/app/projects",
      onNavigate: () => order.push("navigate"),
    });
    link.navigate({ preventDefault: vi.fn() });
    expect(order).toEqual(["navigate", "close"]);
  });

  it("preserves props Next uses to distinguish native and cancelled clicks", () => {
    const onClick = vi.fn();
    const link = renderLink({
      href: "/app/projects",
      target: "_blank",
      download: "projects.txt",
      onClick,
    });
    expect(link).toMatchObject({
      href: "/app/projects",
      target: "_blank",
      download: "projects.txt",
      onClick,
    });
  });
});
