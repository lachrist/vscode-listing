import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
/** @type {import("vscode")} */
const vscode = require("vscode");
export default vscode;
