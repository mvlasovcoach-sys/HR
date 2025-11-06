import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const entryModule = 'assets/js/entries/corporate.entry.js';
const modules = new Map();

function toModuleId(absPath) {
  return path.relative(rootDir, absPath).replace(/\\/g, '/');
}

function resolveSource(source, fromFile) {
  if (source.startsWith('.')) {
    const resolved = path.resolve(path.dirname(fromFile), source);
    const withExt = fs.existsSync(resolved) ? resolved : fs.existsSync(`${resolved}.js`) ? `${resolved}.js` : resolved;
    return toModuleId(withExt);
  }
  // assume relative to root for absolute like /assets
  const absolute = path.resolve(rootDir, source.replace(/^\.\//, ''));
  return toModuleId(absolute);
}

function transformModule(relPath) {
  if (modules.has(relPath)) return;
  const absPath = path.resolve(rootDir, relPath);
  let code = fs.readFileSync(absPath, 'utf-8');
  const importStatements = [];

  const namedImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"\\]+)['"];?/g;
  code = code.replace(namedImportRegex, (match, specifiers, source) => {
    const resolved = resolveSource(source, absPath);
    transformModule(resolved);
    importStatements.push(resolved);
    const cleaned = specifiers.split(',').map(part => part.trim()).filter(Boolean).join(', ');
    return `const { ${cleaned} } = require('${resolved}');`;
  });

  const defaultImportRegex = /import\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"\\]+)['"];?/g;
  code = code.replace(defaultImportRegex, (match, identifier, source) => {
    const resolved = resolveSource(source, absPath);
    transformModule(resolved);
    importStatements.push(resolved);
    return `const ${identifier} = require('${resolved}').default ?? require('${resolved}');`;
  });

  const namespaceImportRegex = /import\s+\*\s+as\s+([A-Za-z0-9_$]+)\s+from\s+['"]([^'"\\]+)['"];?/g;
  code = code.replace(namespaceImportRegex, (match, identifier, source) => {
    const resolved = resolveSource(source, absPath);
    transformModule(resolved);
    importStatements.push(resolved);
    return `const ${identifier} = require('${resolved}');`;
  });

  const sideEffectImportRegex = /import\s+['"]([^'"\\]+)['"];?/g;
  code = code.replace(sideEffectImportRegex, (match, source) => {
    const resolved = resolveSource(source, absPath);
    transformModule(resolved);
    importStatements.push(resolved);
    return `require('${resolved}');`;
  });

  code = code.replace(/import\.meta\.url/g, 'module.importMetaUrl');

  const exportAssignments = [];

  code = code.replace(/export\s+async\s+function\s+([A-Za-z0-9_$]+)\s*\(/g, (match, name) => {
    exportAssignments.push(`exports.${name} = ${name};`);
    return `async function ${name}(`;
  });

  code = code.replace(/export\s+function\s+([A-Za-z0-9_$]+)\s*\(/g, (match, name) => {
    exportAssignments.push(`exports.${name} = ${name};`);
    return `function ${name}(`;
  });

  code = code.replace(/export\s+(const|let|var)\s+([^;]+);/g, (match, kind, declaration) => {
    const names = declaration.split(',').map(part => part.split('=')[0].trim()).filter(Boolean);
    names.forEach(name => {
      exportAssignments.push(`exports.${name} = ${name};`);
    });
    return `${kind} ${declaration};`;
  });

  code = code.replace(/export\s*\{\s*([^}]+)\s*\};?/g, (match, specifiers) => {
    const parts = specifiers.split(',').map(part => part.trim()).filter(Boolean);
    parts.forEach(part => {
      if (!part) return;
      if (part.includes(' as ')) {
        const [original, alias] = part.split(/\s+as\s+/);
        exportAssignments.push(`exports.${alias.trim()} = ${original.trim()};`);
      } else {
        exportAssignments.push(`exports.${part} = ${part};`);
      }
    });
    return '';
  });

  code = code.replace(/export\s+default\s+function\s+([A-Za-z0-9_$]+)\s*\(/g, (match, name) => {
    exportAssignments.push(`module.exports.default = ${name};`);
    return `function ${name}(`;
  });

  code = code.replace(/export\s+default\s+/g, () => {
    exportAssignments.push('module.exports.default = __defaultExport;');
    return 'const __defaultExport = ';
  });

  const finalCode = `${code}\n${exportAssignments.join('\n')}`;
  modules.set(relPath, finalCode);
}

transformModule(entryModule);

const lines = [];
lines.push('(function(){');
lines.push('  const modules = {');
const entries = Array.from(modules.entries());
entries.forEach(([id, code], index) => {
  const trimmed = code.trimEnd();
  const indented = trimmed.split('\n').map(line => `      ${line}`).join('\n');
  const suffix = index === entries.length - 1 ? '' : ',';
  lines.push(`    '${id}': function(require, module, exports) {`);
  lines.push(indented);
  lines.push(`    }${suffix}`);
});
lines.push('  };');
lines.push('  const cache = {};');
lines.push('  function require(id) {');
lines.push('    if (cache[id]) { return cache[id].exports; }');
lines.push('    const module = { exports: {}, id };');
lines.push('    module.importMetaUrl = new URL(id, document.baseURI).href;');
lines.push('    cache[id] = module;');
lines.push('    modules[id](require, module, module.exports);');
lines.push('    return module.exports;');
lines.push('  }');
lines.push(`  require('${entryModule}');`);
lines.push('})();');

const outputPath = path.resolve(rootDir, 'assets/build/corporate.bundle.js');
fs.writeFileSync(outputPath, lines.join('\n'));
