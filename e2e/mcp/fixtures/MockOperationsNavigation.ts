export function useRouter() {
  return {
    refresh() {
      const count = Number(localStorage.getItem("operationsRefreshCount") ?? 0);
      localStorage.setItem("operationsRefreshCount", String(count + 1));
    },
    push(href: string) {
      window.history.pushState(null, "", href);
    },
  };
}
export function usePathname() {
  return "/app/usage";
}
export function useSearchParams() {
  return new URLSearchParams(window.location.search);
}
