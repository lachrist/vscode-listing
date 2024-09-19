import { dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

/**
 * @type {(
 *   path: string,
 *   content: string,
 * ) => Promise<null | string>}
 */
export const save = async (path, content) => {
  // Get the directory part of the file path
  const directory = dirname(path);
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(path, content, "utf8");
    return null;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error.message;
    } else {
      return `Could not save file: ${path}`;
    }
  }
};
