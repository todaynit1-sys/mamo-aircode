/* Build a static runtime allowlist without publishing editable sources. */
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const {minify: minifyJS} = require('terser');
const {minify: minifyHTML} = require('html-minifier-terser');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const published = new Map(), replacements = new Map(), bundles = [];
function safe(base, file) {
  if (!file || file.includes('\\') || file.split('/').includes('..')) throw Error('Invalid relative path: ' + file);
  const result = path.resolve(base, file);
  if (!result.startsWith(base + path.sep)) throw Error('Path leaves project: ' + file);
  return result;
}
async function read(file) { return fs.readFile(safe(root, file), 'utf8'); }
async function write(file, data) {
  const target = safe(output, file);
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, data);
  published.set(file, digest(data));
}
async function compress(source) {
  const result = await minifyJS(source, {
    compress: {passes: 2}, mangle: true, sourceMap: false,
    format: {comments: false}
  });
  if (!result.code) throw Error('Empty JavaScript');
  new vm.Script(result.code);
  return result.code;
}
const withoutQuery = value => value.replace(/^\.\//, '').split(/[?#]/)[0];
async function copy(file) {
  if (/\.(?:json|webmanifest)$/.test(file)) return write(file, JSON.stringify(JSON.parse(await read(file))));
  const data = await fs.readFile(safe(root, file));
  // Vendor files are already compressed; omit source-map trailers, retain license files.
  if (/\.(?:js|mjs)$/.test(file)) return write(file, data.toString('utf8').replace(/\/\/[#@]\s*sourceMappingURL=[^\r\n]*/g, ''));
  return write(file, data);
}
async function copyDirectory(directory, pattern) {
  async function visit(relative) {
    for (const entry of await fs.readdir(safe(root, relative), {withFileTypes: true})) {
      const name = relative + '/' + entry.name;
      if (entry.isSymbolicLink()) throw Error('Runtime asset is a symlink: ' + name);
      if (entry.isDirectory()) await visit(name);
      else if (pattern.test(name)) await copy(name);
    }
  }
  await visit(directory);
}
async function entryPage(entry) {
  let html = await read(entry.html);
  const tags = [...html.matchAll(/<script\b([^>]*?)src="([^"]+)"([^>]*)>\s*<\/script>/g)]
    .filter(m => !/^(?:https?:|\/\/)/.test(m[2]));
  const scripts = tags.map(m => withoutQuery(m[2]));
  if (JSON.stringify(scripts) !== JSON.stringify(entry.scripts)) throw Error('Unexpected script order: ' + entry.html);
  const source = (await Promise.all(scripts.map(read))).join('\n;\n');
  const bundle = await compress(source);
  const filename = 'assets/runtime/' + entry.name + '.' + digest(bundle).slice(0, 16) + '.min.js';
  await write(filename, bundle); bundles.push(filename);
  scripts.forEach(file => { if (!replacements.has(file)) replacements.set(file, filename); });
  tags.forEach((tag, i) => {
    const attrs = /\bdefer\b/.test(tag[1] + tag[3]) ? ' defer' : '';
    html = html.replace(tag[0], i === 0 ? '<script src="' + filename + '"' + attrs + '></script>' : '');
  });
  const styles = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)]
    .filter(m => !/^(?:https?:|\/\/)/.test(m[1]));
  if (JSON.stringify(styles.map(m => withoutQuery(m[1]))) !== JSON.stringify(entry.styles)) throw Error('Unexpected styles: ' + entry.html);
  for (const tag of styles) {
    const file = withoutQuery(tag[1]);
    if (!replacements.has(file)) {
      const packed = await minifyHTML('<style>' + await read(file) + '</style>', {minifyCSS: true});
      const css = packed.slice('<style>'.length, -'</style>'.length);
      const name = file.replace(/\.css$/, '.' + digest(css).slice(0, 16) + '.min.css');
      await write(name, css); replacements.set(file, name);
    }
    html = html.replace(tag[0], tag[0].replace(tag[1], replacements.get(file)));
  }
  html = await minifyHTML(html, {
    collapseWhitespace: true, conservativeCollapse: true, removeComments: true,
    minifyCSS: true, minifyJS: {mangle: false, compress: {passes: 2}, sourceMap: false, format: {comments: false}}
  });
  await write(entry.html, html);
  console.log(entry.html + ': ' + filename + ' (' + Buffer.byteLength(source) + ' -> ' + Buffer.byteLength(bundle) + ' bytes)');
}
async function build() {
  if (output !== path.resolve(root, 'dist') || path.dirname(output) !== root) throw Error('Unsafe output directory');
  const previous = await fs.lstat(output).catch(() => null);
  if (previous?.isSymbolicLink()) throw Error('Output must not be a symlink');
  await fs.rm(output, {recursive: true, force: true});
  await fs.mkdir(output, {recursive: true});
  const config = JSON.parse(await read('tools/production-assets.json'));
  for (const entry of config.entries) await entryPage(entry);
  for (const file of config.files) await copy(file);
  for (const directory of config.directories) await copyDirectory(directory.path, new RegExp(directory.pattern));
  let worker = await read('sw.js');
  const array = worker.match(new RegExp('(?:var|const)\\s+' + config.worker.shell + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  if (!array) throw Error('Missing service-worker shell');
  const oldPaths = [...array[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
  const shell = [...new Set([...oldPaths.map(value => {
    const replacement = replacements.get(withoutQuery(value));
    return replacement ? './' + replacement : value;
  }), ...bundles.map(file => './' + file)])];
  for (const value of shell) {
    if (value === './') continue;
    if (!published.has(withoutQuery(value))) throw Error('Missing offline runtime asset: ' + value);
  }
  worker = worker.replace(array[0], 'const ' + config.worker.shell + '=' + JSON.stringify(shell) + ';');
  const hash = digest(JSON.stringify([...published].sort())).slice(0, 16);
  const version = new RegExp('(?:var|const)\\s+' + config.worker.version + '\\s*=\\s*[\'"][^\'"]+[\'"];');
  if (!version.test(worker)) throw Error('Missing worker version');
  worker = worker.replace(version, 'const ' + config.worker.version + '=' + JSON.stringify(config.worker.prefix + hash) + ';');
  await write('sw.js', await compress(worker));
  console.log('Production output: ' + published.size + ' runtime files, no source maps or development files');
}
build().catch(error => {console.error(error); process.exitCode = 1;});
