// Module-resolution hooks that teach bare Node the "@/..." path alias from
// tsconfig.json, so library modules can be unit-tested without Next.
//
// Next and tsc both understand "@/lib/db"; `node --test` does not, so any
// module using the alias was previously untestable. Rather than rewrite source
// imports to suit the test runner, the runner is taught the alias.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const ROOT = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CANDIDATES = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

// next/server is exported under bundler-only resolution conditions, so bare
// Node cannot load it. Route handlers that import it would otherwise be
// impossible to unit-test at all. See next-server-shim.mjs for what it covers.
const SHIMS = new Map([["next/server", "tests/helpers/next-server-shim.mjs"]]);

export async function resolve(specifier, context, next) {
  const shim = SHIMS.get(specifier);
  if (shim) {
    return { url: pathToFileURL(join(ROOT, shim)).href, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const base = join(ROOT, specifier.slice(2));
    for (const ext of CANDIDATES) {
      const candidate = base + ext;
      if (ext !== "" && existsSync(candidate)) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }
    // Fall through to the default resolver so the real error names the
    // specifier that could not be found, rather than a rewritten path.
  }
  return next(specifier, context);
}
