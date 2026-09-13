import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "sim",
    include: ["test/**/*.test.ts"],
    environment: "node",
    // The fifty-Wave replay fixture (M1-16) is ~110,000 ticks and is digested
    // every tick, so replaying it three times takes several seconds.
    testTimeout: 30_000,
  },
});
