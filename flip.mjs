import { readFile, writeFile } from "node:fs/promises";
import { argv, stderr } from "node:process";

/**
 * @type {(
 *   dir1: string,
 *   dir2: string,
 * ) => Promise<void>}
 */
const flip = async (dir1, dir2) => {
  await writeFile(
    new URL("package.json", import.meta.url),
    (await readFile(new URL("package.json", import.meta.url), "utf8")).replace(
      `"main": "./${dir1}/index.js"`,
      `"main": "./${dir2}/index.js"`,
    ),
    "utf8",
  );
};

/**
 * @type {(
 *   argv: string[],
 * ) => Promise<void>}
 */
const main = async (argv) => {
  if (argv.length !== 1) {
    stderr.write("Usage: publish.mjs <prod|test>\n");
  } else {
    const arg0 = argv[0];
    if (arg0 === "prod") {
      await flip("src", "out");
    } else if (arg0 === "test") {
      await flip("out", "src");
    } else {
      stderr.write("Usage: publish.mjs <prod|test>\n");
    }
  }
};

await main(argv.slice(2));
