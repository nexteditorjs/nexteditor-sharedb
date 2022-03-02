// vite.config.js
const path = require('path')
const { defineConfig } = require('vite')

module.exports = defineConfig({
  server: {
    port: 4000,
    open: 'http://localhost:4000',
    proxy: {
      '/sharedb-demo': {
        target: 'ws://localhost:8080',
        ws: true,
      }
    }
  },
  build: {
    minify: 'terser',
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      name: 'nexteditor-sharedb',
      fileName: (format) => `index.${format}.js`
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      "external": ["@nexteditorjs/nexteditor-core"],
      output: {
        // Provide global variables to use in the UMD build
        // for externalized deps
        globals: {
          // vue: 'Vue'
        }
      }
    }
  }
})
