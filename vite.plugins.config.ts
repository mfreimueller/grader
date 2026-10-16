import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { copyFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Builds the plugins that ship with Grader into build/plugins/<plugin id>/, the layout the app and a user's
 * plugin folder share: plugin.json next to a static page. Add a plugin by repeating the config for its folder.
 */
const PLUGIN_ID = 'at.mfreimueller.studentpicker';
const SOURCE = path.resolve(__dirname, 'plugins/studentpicker');
const OUTPUT = path.resolve(__dirname, 'build/plugins', PLUGIN_ID);

export default defineConfig({
  root: SOURCE,
  // Relative urls: the page is served from grdr-plugin://<id>/, wherever that is mapped to on disk.
  base: './',
  plugins: [
    vue(),
    {
      name: 'copy-plugin-manifest',
      closeBundle() {
        copyFileSync(path.join(SOURCE, 'plugin.json'), path.join(OUTPUT, 'plugin.json'));
      },
    },
  ],
  build: {
    outDir: OUTPUT,
    emptyOutDir: true,
  },
});
