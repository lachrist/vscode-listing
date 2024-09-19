import esbuild from "esbuild";

const external = /\/ext\/([^/]*)\.mjs$/gu;

esbuild
  .build({
    entryPoints: ["src/index.mjs"],
    bundle: true,
    outfile: "out/index.js",
    platform: "node",
    plugins: [
      {
        name: "external-resolved",
        setup: (build) => {
          build.onResolve({ filter: external }, ({ path }) => {
            const parts = external.exec(path);
            return { external: true, path: parts[1] };
          });
        },
      },
    ],
  })
  .catch(() => process.exit(1));
