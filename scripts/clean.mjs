import { rm } from "node:fs/promises";
// Fixed paths only: never delete source, credentials, Vercel linkage, or dependencies.
for (const path of [".next", "coverage", "tsconfig.tsbuildinfo"]) {
  await rm(new URL(`../${path}`, import.meta.url), {
    recursive: true,
    force: true,
  });
}
