import { describe, expect, it } from "vitest";
import { isPublicAddress, safeSourceUrl } from "./safe-download";
describe("external asset addresses", () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.2",
    "172.16.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "255.255.255.255",
    "100.64.0.1",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
    "not-an-ip",
  ])
    it(`rejects ${ip}`, () => expect(isPublicAddress(ip)).toBe(false));
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])
    it(`allows public ${ip}`, () => expect(isPublicAddress(ip)).toBe(true));
  for (const url of [
    "http://example.com/file.png",
    "file:///etc/passwd",
    "https://user:password@example.com/image",
    "https://example.com:8443/image",
    "https://localhost/image",
    "https://x.localhost/image",
    "https://2130706433/image",
    "https://0x7f000001/image",
    "https://[::ffff:127.0.0.1]/image",
  ])
    it(`rejects unsafe URL ${url}`, () =>
      expect(() => safeSourceUrl(url)).toThrow());
  it("preserves a signed query only for transfer and removes fragments", () => {
    expect(
      safeSourceUrl(
        "https://cdn.example.com/file.png?signature=temporary#private",
      ).href,
    ).toBe("https://cdn.example.com/file.png?signature=temporary");
  });
});
