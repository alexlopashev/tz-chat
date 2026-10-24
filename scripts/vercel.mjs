import { spawnSync } from "node:child_process";

// Vercel supplies cache-dir, which npm no longer accepts. Preserve its cache
// location using the supported option, including for nested npm commands.
const env = { ...process.env };
const cacheKey = Object.keys(env).find(
  (key) => key.toLowerCase() === "npm_config_cache",
);
for (const key of Object.keys(env)) {
  if (key.toLowerCase() !== "npm_config_cache_dir") continue;
  if (!cacheKey && env[key]) env.npm_config_cache = env[key];
  delete env[key];
}

function run(command, args) {
  const result = spawnSync(command, args, { env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

switch (process.argv[2]) {
  case "install":
    run("npx", ["--yes", "--package=npm@12.2.1", "npm", "ci"]);
    break;
  case "build":
    // Normalize the deployed configuration before checking the entire project.
    // Keep vercel.json in the formatting gate; source files still fail on drift.
    run("npm", ["exec", "--", "prettier", "--write", "vercel.json"]);
    run("npm", ["run", "verify"]);
    run("npm", ["run", "build"]);
    break;
  default:
    throw new Error("Usage: node scripts/vercel.mjs <install|build>");
}
