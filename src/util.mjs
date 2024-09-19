import { mkdir, writeFile } from "node:fs/promises";
import { dirname, normalize, sep } from "node:path";
import { makeRe } from "minimatch";

/**
 * @type {(
 *   path: string,
 * ) => string}
 */
export const normalizeDirectoryPath = (path1) => {
  const path2 = normalize(path1).split(sep).join("/");
  return path2.endsWith("/") ? path2 : `${path2}/`;
};

/**
 * @type {(
 *   path: string,
 * ) => string}
 */
export const normalizeFilePath = (path1) =>
  normalize(path1).split(sep).join("/");

/**
 * @type {(
 *   globs: string[],
 * ) => (path: string) => boolean}
 */
export const compileMatch = (globs) => {
  const regexps = globs.map((glob) => makeRe(glob));
  return (path) => regexps.some((regexp) => regexp && regexp.test(path));
};

/**
 * @type {(
 *   error: unknown,
 * ) => string}
 */
export const getErrorMessage = (error) =>
  typeof error === "object" &&
  error !== null &&
  "message" in error &&
  typeof error.message === "string"
    ? error.message
    : "An unknown error occurred.";

/**
 * @type {(
 *   pull: () => Promise<boolean>,
 *   timeout: number,
 *   max_count: number,
 * ) => Promise<boolean>}
 */
export const wait = async (pull, timeout, max_count) => {
  let count = 0;
  while (count <= max_count) {
    await new Promise((resolve) => {
      setTimeout(resolve, timeout);
    });
    if (await pull()) {
      return true;
    }
    count += 1;
  }
  return false;
};

/**
 * @type {(
 *   path: string,
 *   content: string,
 * ) => Promise<undefined>}
 */
export const save = async (path, content) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
};
