/**
 * Teaches the node:test runner the `@/*` -> `src/*` path alias from
 * tsconfig.json.
 *
 * Without this, any module importing through the alias is unloadable outside
 * the Next.js bundler, which is why the server and sync layers had no tests at
 * all. Node resolves ESM specifiers literally, so the mapping and the implicit
 * file extension both have to be supplied here.
 */

import { existsSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SRC = resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src");
const EXTENSIONS = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];

export function resolve(specifier, context, nextResolve) {
  const base = aliasBase(specifier) ?? relativeBase(specifier, context);
  if (base === null) return nextResolve(specifier, context);

  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    if (existsSync(candidate)) {
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

/** `@/lib/foo` -> `<root>/src/lib/foo` */
function aliasBase(specifier) {
  return specifier.startsWith("@/")
    ? resolvePath(SRC, specifier.slice(2))
    : null;
}

/**
 * Extensionless relative imports (`./schema`) are valid TypeScript but not
 * valid ESM, and the codebase mixes them with the `.ts`-suffixed form.
 */
function relativeBase(specifier, context) {
  if (!specifier.startsWith("./") && !specifier.startsWith("../")) return null;
  if (/\.[a-z]+$/i.test(specifier)) return null;
  if (!context.parentURL?.startsWith("file:")) return null;

  return resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
}
