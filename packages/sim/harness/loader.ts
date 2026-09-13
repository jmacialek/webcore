/**
 * Resolve hook for running the harness straight from source with Node's
 * built-in type stripping (`node --import ./harness/loader.ts ...`).
 *
 * The package writes NodeNext-style `./x.js` specifiers that point at `.ts`
 * sources; Node strips types but never rewrites specifiers, so a path-like
 * `.js` specifier that does not exist on disk is retried as `.ts`.
 */
import { registerHooks } from "node:module";

function isModuleNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ERR_MODULE_NOT_FOUND";
}

function isPathLike(specifier: string): boolean {
  return specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("file:");
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error: unknown) {
      if (isModuleNotFound(error) && isPathLike(specifier) && specifier.endsWith(".js")) {
        return nextResolve(`${specifier.slice(0, -".js".length)}.ts`, context);
      }
      throw error;
    }
  },
});
