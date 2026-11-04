export default async function teardown() {
  await fetch("http://127.0.0.1:38173/__test_shutdown", { method: "POST" });
}
