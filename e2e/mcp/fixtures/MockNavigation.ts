export function useRouter() {
  return {
    refresh() {
      localStorage.setItem("fixture-refresh", "true");
    },
    push() {},
    replace(path: string) {
      localStorage.setItem("fixture-redirect", path);
    },
  };
}
