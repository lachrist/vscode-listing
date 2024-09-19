const activate = async (context) => {
  const { activate } = await import("./lib/index.mjs");
  return activate(context);
};

const deactivate = async () => {
  const { deactivate } = await import("./lib/index.mjs");
  return deactivate();
};

module.exports = {
  activate,
  deactivate,
};
