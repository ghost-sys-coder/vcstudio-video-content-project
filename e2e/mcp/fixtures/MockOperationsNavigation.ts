export function useRouter() {
  return {
    refresh() {},
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
