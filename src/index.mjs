import vscode from "../ext/vscode.mjs";
import { toLatexListing } from "html-to-latex-listing";
import {
  compileMatch,
  getErrorMessage,
  normalizeDirectoryPath,
  normalizeFilePath,
  save,
  stripExtension,
  wait,
} from "./util.mjs";

/**
 * @type {(
 *   path: string,
 * ) => { root: string, path: string } | null}
 */
const toWorkspaceRelativePath = (path) => {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders == null) {
    return null;
  } else {
    for (const folder of workspaceFolders) {
      const directory = normalizeDirectoryPath(folder.uri.fsPath);
      if (path.startsWith(directory)) {
        return {
          root: directory,
          path: path.slice(directory.length),
        };
      }
    }
    return null;
  }
};

/**
 * @type {(
 *   context: import("vscode").ExtensionContext,
 * ) => void}
 */
export const activate = (context) => {
  /** @type {import("./config").Config} */
  const config = /** @type {any} */ (
    vscode.workspace.getConfiguration("listing")
  );
  const theme = config["switch-theme"] ? config["theme"] : null;
  if (config["save-html"] || config["save-latex"]) {
    const options = {
      theme,
      source_directory: normalizeDirectoryPath(config["source-directory"]),
      output_directory: normalizeDirectoryPath(config["output-directory"]),
      save_html: config["save-html"],
      save_latex: config["save-latex"],
      ignore: compileMatch(config["ignore-pattern-list"]),
    };
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument(async (document) => {
        try {
          for (const path of await generateListing(document, options)) {
            vscode.window.showInformationMessage(`Listing saved to: ${path}`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(getErrorMessage(error));
        }
      }),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("listing.copyAsLatex", async () => {
      try {
        await copyAsLatex(theme);
        vscode.window.showInformationMessage(
          "Latex listing copied to clipboard.",
        );
      } catch (error) {
        vscode.window.showErrorMessage(getErrorMessage(error));
      }
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("listing.copyAsHtml", async () => {
      try {
        await copyAsHtml(theme);
        vscode.window.showInformationMessage(
          "Latex listing copied to clipboard.",
        );
      } catch (error) {
        vscode.window.showErrorMessage(getErrorMessage(error));
      }
    }),
  );
};

/**
 * @type {(
 *   theme: string | null,
 * ) => Promise<void>}
 */
const copyAsLatex = async (theme) => {
  const editor = vscode.window.activeTextEditor;
  if (editor == null) {
    throw new Error("No active editor to save LaTex listing.");
  }
  const html = await getThemeSyntaxHighlight(editor.document, theme);
  vscode.env.clipboard.writeText(toLatexListing(html));
};

/**
 * @type {(
 *   theme: string | null,
 * ) => Promise<void>}
 */
const copyAsHtml = async (theme) => {
  const editor = vscode.window.activeTextEditor;
  if (editor == null) {
    throw new Error("No active editor to save HTML listing.");
  }
  const html = await getThemeSyntaxHighlight(editor.document, theme);
  vscode.env.clipboard.writeText(html);
};

/**
 * @type {(
 *   document: import("vscode").TextDocument,
 *   options: {
 *     theme: string | null,
 *     source_directory: string,
 *     output_directory: string,
 *     ignore: (path: string) => boolean,
 *     save_html: boolean,
 *     save_latex: boolean,
 *   },
 * ) => Promise<string[]>}
 */
const generateListing = async (
  document,
  { theme, source_directory, output_directory, save_html, save_latex, ignore },
) => {
  const pair = toWorkspaceRelativePath(normalizeFilePath(document.fileName));
  if (pair === null) {
    return [];
  }
  const { root, path: from_root_path } = pair;
  if (!from_root_path.startsWith(source_directory)) {
    return [];
  }
  const from_source_path = from_root_path.slice(source_directory.length);
  if (ignore(from_source_path)) {
    return [];
  }
  await vscode.window.showTextDocument(document);
  const editor = vscode.window.activeTextEditor;
  if (editor == null || editor.document !== document) {
    throw new Error("Could not focus on saved document.");
  }
  editor.selection = new vscode.Selection(
    new vscode.Position(0, 0),
    new vscode.Position(document.lineCount, 0),
  );
  const html = await getThemeSyntaxHighlight(document, theme);
  /** @type {string[]} */
  const paths = [];
  if (save_html) {
    const path = `${root}${output_directory}${stripExtension(from_source_path)}.html`;
    paths.push(path);
    await save(path, html);
  }
  if (save_latex) {
    const path = `${root}${output_directory}${stripExtension(from_source_path)}.tex`;
    paths.push(path);
    await save(path, toLatexListing(html));
  }
  return paths;
};

/**
 * @type {(
 *   theme: string | null,
 * ) => Promise<string>}
 */
const switchTheme = async (theme) => {
  const old_theme = vscode.workspace
    .getConfiguration()
    .get("workbench.colorTheme");
  if (old_theme === theme) {
    return old_theme;
  }
  await new Promise((resolve, reject) => {
    const disposable = vscode.window.onDidChangeActiveColorTheme((event) => {
      disposable.dispose();
      const new_theme = vscode.workspace
        .getConfiguration()
        .get("workbench.colorTheme");
      if (new_theme !== theme) {
        reject(new Error("Could not switch theme."));
      } else {
        resolve(null);
      }
    });
    vscode.workspace
      .getConfiguration()
      .update("workbench.colorTheme", theme, vscode.ConfigurationTarget.Global);
  });
  return old_theme;
};

/**
 * @type {(
 *   document: import("vscode").TextDocument,
 *   theme: string | null,
 * ) => Promise<string>}
 */
const getThemeSyntaxHighlight = async (document, theme) => {
  if (theme == null) {
    return await getSyntaxHighlight(document);
  } else {
    const backup = await switchTheme(theme);
    try {
      return await getSyntaxHighlight(document);
    } finally {
      await switchTheme(backup);
    }
  }
};

/**
 * @type {(
 *   document: import("vscode").TextDocument,
 * ) => Promise<string>}
 */
const getSyntaxHighlight = async (document) => {
  const editor = vscode.window.activeTextEditor;
  if (editor == null) {
    throw new Error("No active editor for extracting listing.");
  }
  if (editor.document !== document) {
    throw new Error("Wrong active document for extracting listing.");
  }
  const target = document.getText(editor.selection);
  if (target == "") {
    throw new Error("Cannot extract listing from empty selection.");
  }
  await vscode.commands.executeCommand(
    "editor.action.clipboardCopyWithSyntaxHighlightingAction",
  );
  if (
    !(await wait(
      async () => (await vscode.env.clipboard.readText()) === target,
      100,
      10,
    ))
  ) {
    throw new Error("Could not copy listing to clipboard.");
  }
  const temporary = await vscode.workspace.openTextDocument({
    content: "",
    language: "html",
  });
  await vscode.window.showTextDocument(temporary);
  await vscode.commands.executeCommand("editor.action.pasteAs", {
    id: "html",
  });
  await new Promise((resolve, reject) => {
    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      disposable.dispose();
      if (event.document !== temporary) {
        reject(
          new Error("Could not paste HTML listing in temporary document."),
        );
      } else {
        resolve(undefined);
      }
    });
  });
  const content = temporary.getText();
  await vscode.commands.executeCommand(
    "workbench.action.revertAndCloseActiveEditor",
  );
  return content;
};

/**
 * @type {() => void}
 */
export const deactivate = () => {};
