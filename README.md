# vscode-listing

VSCode extension for generating LaTex and HTML listings using the syntax
highlighting of your favorite editor. Save your raw listings in `listing/src`
and watch `listing/out` for generated listings.

![Demo GIF](https://github.com/lachrist/vscode-listing/blob/main/demo.gif?raw=true)

Recommended way to include LaTex listings:

```latex
\documentclass{article}
\usepackage{xcolor}
\usepackage{fancyvrb}
\usepackage{ulem} % for underline decoration
\begin{document}
% Don't forget to specify the regular latex command separators!
\VerbatimInput[commandchars=\\\{\}]{listing/foo.tex}
\end{document}
```

## Features

- Automatic generation of HTML/LaTex listings on save.
- Commands for copying listing of selected text to clipboard.
  - `Listing: Copy as HTML Listing`
  - `Listing: Copy as LaTex Listing`
- Temporary theme switching, handy if you want your listing in a light theme but
  prefer editing with dark themes.
