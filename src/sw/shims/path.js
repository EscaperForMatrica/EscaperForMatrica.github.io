// node:path (posix) для service worker
export const sep = '/';
export function normalize(p) {
  const abs = p.startsWith('/');
  const out = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return (abs ? '/' : '') + out.join('/');
}
export function join(...parts) {
  return normalize(parts.filter(Boolean).join('/')) || '.';
}
export function resolve(...parts) {
  let p = '';
  for (const part of parts) {
    if (!part) continue;
    p = part.startsWith('/') ? part : `${p}/${part}`;
  }
  return normalize(p.startsWith('/') ? p : `/${p}`) || '/';
}
export function dirname(p) {
  const n = normalize(p);
  const i = n.lastIndexOf('/');
  return i <= 0 ? (n.startsWith('/') ? '/' : '.') : n.slice(0, i);
}
export function basename(p, ext) {
  const b = normalize(p).split('/').pop() || '';
  return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
}
export function extname(p) {
  const b = basename(p);
  const i = b.lastIndexOf('.');
  return i > 0 ? b.slice(i) : '';
}
export function relative(from, to) {
  const a = resolve(from).split('/').filter(Boolean);
  const b = resolve(to).split('/').filter(Boolean);
  while (a.length && b.length && a[0] === b[0]) {
    a.shift();
    b.shift();
  }
  return [...a.map(() => '..'), ...b].join('/');
}
export const isAbsolute = (p) => p.startsWith('/');
export const posix = { sep, normalize, join, resolve, dirname, basename, extname, relative, isAbsolute };
export default { ...posix, posix };
