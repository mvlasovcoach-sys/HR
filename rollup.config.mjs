import path from 'node:path';
import { fileURLToPath } from 'node:url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const entries = [
  'analytics',
  'corporate',
  'demo',
  'devices',
  'engagement',
  'summary'
];

export default {
  input: Object.fromEntries(
    entries.map(name => [
      name,
      path.resolve(__dirname, `assets/js/entries/${name}.entry.js`)
    ])
  ),
  output: {
    dir: path.resolve(__dirname, 'assets/build'),
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].bundle.js',
    chunkFileNames: 'chunks/[name]-[hash].js',
    assetFileNames: '[name]-[hash][extname]'
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
    })
  ]
};
