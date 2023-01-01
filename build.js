const fs = require("fs");
const { build } = require("esbuild");
const { stylusLoader } = require("esbuild-stylus-loader");

const entryPoints = [];
const checkEntry = (path) => {
    if (fs.existsSync(path)) entryPoints.push(path);
};

checkEntry("src/index.tsx");
checkEntry("src/startup_script.ts");
checkEntry("src/index.styl");

build({
    entryPoints: [],
    target: "chrome91",
    bundle: true,
    sourcemap: process.argv.includes("--dev") ? "inline" : false,
    minify: !process.argv.includes("--dev"),
    outdir: ".",
    define: {
        DEBUG: process.argv.includes("--dev").toString(),
    },
    watch: process.argv.includes("--watch")
        ? {
              onRebuild(err, result) {
                  console.log("Rebuilding");
                  if (err) {
                      console.warn(err.message);
                  } else if (result) {
                      console.log("Build success");
                  }
              },
          }
        : undefined,
    plugins: [stylusLoader()],
}).then(() => {
    console.log("Build success");
});
