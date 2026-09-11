/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/it-passport/",
  plugins: [react()],
  test: {
    include: ["src/**/*.test.ts", "tools/**/*.test.mjs"],
  },
});
