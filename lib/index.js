/**
 * @type {(
 *   context: import("vscode").ExtensionContext,
 * ) => Promise<void>}
 */
const activate = async (context) => {
  const { activate } = await import("./index.mjs");
  return activate(context);
};

/**
 * @type {() => Promise<void>}
 */
const deactivate = async () => {
  const { deactivate } = await import("./index.mjs");
  return deactivate();
};

module.exports = {
  activate,
  deactivate,
};
