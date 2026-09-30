import { expect, it } from "vitest"
import { loadWithFallback } from "./lazyModule"
it("shows the recovery module when an updated app chunk is unavailable", async () => {
  const recovery = { default: "reload screen" }
  expect(
    await loadWithFallback(
      () =>
        Promise.reject(
          new TypeError("Failed to fetch dynamically imported module"),
        ),
      recovery,
    ),
  ).toEqual(recovery)
})
it("keeps the loaded module on success", async () => {
  expect(
    await loadWithFallback(() => Promise.resolve({ default: "team" }), {
      default: "reload screen",
    }),
  ).toEqual({ default: "team" })
})
