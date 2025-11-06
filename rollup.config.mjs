import path from 'node:path';
import { fileURLToPath } from 'node:url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  input: path.resolve(__dirname, 'assets/js/entries/corporate.entry.js'),
  output: {
    file: path.resolve(__dirname, 'assets/build/corporate.bundle.js'),
    format: 'iife',
    sourcemap: true,
    name: 'CorporateBundle'
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
