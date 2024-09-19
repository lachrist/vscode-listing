import vscode from "./vscode.mjs";
import { toLatexListing } from "html-to-latex-listing";
import { makeRe } from "minimatch";
import { writeFile } from "node:fs/promises";
import { normalize, sep } from "node:path";
import { save } from "./file.mjs";

/**
 * @type {(
 *   globs: string[],
 * ) => (path: string) => boolean}
 */
const compileMatch = (globs) => {
  const regexps = globs.map((glob) => makeRe(glob));
  return (path) => regexps.some((regexp) => regexp && regexp.test(path));
};

/**
 * @type {(
 *   path: string,
 * ) => string}
 */
const normalizeDirectoryPath = (path1) => {
  const path2 = normalize(path1).split(sep).join("/");
  return path2.endsWith("/") ? path2 : `${path2}/`;
};

/**
 * @type {(
 *   path: string,
 * ) => string}
 */
const normalizeFilePath = (path1) => normalize(path1).split(sep).join("/");

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
  if (config["enable-html"] || config["enable-latex"]) {
    const options = {
      source: normalizeDirectoryPath(config["source-directory"]),
      html_output: normalizeDirectoryPath(config["html-output-directory"]),
      latex_output: normalizeDirectoryPath(config["latex-output-directory"]),
      save_html: config["enable-html"],
      save_latex: config["enable-latex"],
      ignore: compileMatch(config["ignore-pattern-list"]),
    };
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) =>
        generateListing(document, options),
      ),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("listing.copyAsLatex", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor == null) {
        vscode.window.showErrorMessage(
          "No active editor to save latex listing.",
        );
      } else {
        const html = await getSyntaxHighlighting(editor.document);
        if (html !== null) {
          vscode.env.clipboard.writeText(toLatexListing(html));
          vscode.window.showInformationMessage(
            "Latex listing copied to clipboard.",
          );
        }
      }
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("listing.copyAsHtml", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor == null) {
        vscode.window.showErrorMessage(
          "No active editor to save latex listing.",
        );
      } else {
        const html = await getSyntaxHighlighting(editor.document);
        if (html !== null) {
          vscode.env.clipboard.writeText(html);
          vscode.window.showInformationMessage(
            "HTML listing copied to clipboard.",
          );
        }
      }
    }),
  );
};

/**
 * @type {(
 *   document: import("vscode").TextDocument,
 *   options: {
 *     source: string,
 *     html_output: string,
 *     latex_output: string,
 *     save_html: boolean,
 *     save_latex: boolean,
 *     ignore: (path: string) => boolean,
 *   },
 * ) => Promise<void>}
 */
const generateListing = async (
  document,
  { source, html_output, latex_output, save_html, save_latex, ignore },
) => {
  const pair = toWorkspaceRelativePath(normalizeFilePath(document.fileName));
  if (pair === null) {
    return undefined;
  }
  const { root, path: from_root_path } = pair;
  if (!from_root_path.startsWith(source)) {
    return undefined;
  }
  const from_source_path = from_root_path.slice(source.length);
  if (ignore(from_source_path)) {
    return undefined;
  }
  await vscode.window.showTextDocument(document);
  const editor = vscode.window.activeTextEditor;
  if (editor == null || editor.document !== document) {
    vscode.window.showErrorMessage("Could not focus on saved document.");
    return undefined;
  }
  editor.selection = new vscode.Selection(
    new vscode.Position(0, 0),
    new vscode.Position(document.lineCount, 0),
  );
  const html = await getSyntaxHighlighting(document);
  if (html === null) {
    return undefined;
  }
  if (save_html) {
    const path = `${root}${html_output}${from_source_path}.html`;
    const failure = await save(path, html);
    if (failure != null) {
      vscode.window.showErrorMessage(failure);
    } else {
      vscode.window.showInformationMessage(`HTML Listing saved to: ${path}`);
    }
  }
  if (save_latex) {
    const path = `${root}${latex_output}${from_source_path}.tex`;
    const failure = await save(path, toLatexListing(html));
    if (failure != null) {
      vscode.window.showErrorMessage(failure);
    } else {
      vscode.window.showInformationMessage(`Latex Listing saved to: ${path}`);
    }
  }
};

/**
 * @type {(
 *   document: import("vscode").TextDocument,
 * ) => Promise<string | null>}
 */
const getSyntaxHighlighting = async (document) => {
  const editor = vscode.window.activeTextEditor;
  if (editor == null) {
    vscode.window.showErrorMessage("No active editor to extract listing.");
    return null;
  }
  if (editor.document !== document) {
    vscode.window.showErrorMessage("Wrong active document to extract listing.");
    return null;
  }
  await vscode.commands.executeCommand(
    "editor.action.clipboardCopyWithSyntaxHighlightingAction",
  );
  // Dirty hack to wait for the clipboard to be filled.
  // There is no related event listener to my knowledge.
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
  if (
    (await vscode.env.clipboard.readText()) !==
    document.getText(editor.selection)
  ) {
    vscode.window.showErrorMessage("Mismatch between clipbaord and selection.");
    return null;
  }
  const temporary = await vscode.workspace.openTextDocument({
    content: "",
    language: "html",
  });
  await vscode.window.showTextDocument(temporary);
  await vscode.commands.executeCommand("editor.action.pasteAs", {
    id: "html",
  });
  const success = await new Promise((resolve) => {
    const disposable = vscode.workspace.onDidChangeTextDocument((event) => {
      disposable.dispose();
      resolve(event.document === temporary);
    });
  });
  if (!success) {
    vscode.window.showErrorMessage(
      "Could not paste html listing in temporary document.",
    );
    return null;
  }
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
