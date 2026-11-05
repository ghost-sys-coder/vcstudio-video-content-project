export function useRouter() {
  return {
    push(href: string) {
      window.history.pushState(null, "", href);
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
  };
}
