const { build } = require('vite');
const path = require('path');

const dist = process.argv.indexOf('--dist') !== -1;
// const formats = dist ? ['umd'] : ['es'];
const outDir = 'dist';

const imports = [
  // {
  //   name: 'nexteditor-sharedb',
  //   entry: path.resolve(__dirname, 'src/index.ts'),
  //   outDir: `${outDir}`,
  // },
  {
    name: 'nexteditor-sharedb-messages',
    entry: path.resolve(__dirname, 'src/messages/index.ts'),
    outDir: `${outDir}/messages`,
  },
]

async function buildAll() {
  for (let item of imports) {
    await build({
      configFile: false,
      build: {
        outDir: item.outDir,
        minify: 'terser',
        sourcemap: true,
        lib: {
          entry: item.entry,
          name: item.name,
          fileName: (format) => `index.${format}.js`,
        },
        rollupOptions: {
          // make sure to externalize deps that shouldn't be bundled
          // into your library
          "external": [
            "@nexteditorjs/nexteditor-core",
            "lodash.isequal",
            "lodash.clonedeep",
            "ot-json1",
            "reconnecting-websocket",
            "rich-text",
            "sharedb",
          ],
          output: {
            // Provide global variables to use in the UMD build
            // for externalized deps
            globals: {
              // vue: 'Vue'
            }
          }
        }
      },
    })
  }
}

buildAll();
