import { readdirSync, readFileSync, existsSync, realpathSync } from 'node:fs'
import { dirname, resolve, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = realpathSync(fileURLToPath(new URL('..', import.meta.url)))
const files = []
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isSymbolicLink()) throw new Error(`Package contains a symlink: ${path}`)
    if (entry.isDirectory()) walk(path); else files.push(path)
  }
}
for (const name of ['src', 'server', 'tests', 'public', 'scripts']) walk(resolve(root, name))
const errors = []
for (const file of files.filter(f => ['.ts', '.tsx', '.js', '.mjs'].includes(extname(f)))) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), match[1].split('?')[0])
    if (!target.startsWith(root + sep)) { errors.push(`${file}: import escapes checkout: ${match[1]}`); continue }
    if (![target, ...['.ts', '.tsx', '.js', '.mjs', '.css', '/index.ts', '/index.tsx'].map(ext => target + ext)].some(existsSync)) errors.push(`${file}: missing import ${match[1]}`)
  }
}
for (const name of ['phantom-ad.png', 'ad-hand.jpg']) if (!existsSync(resolve(root, 'public', name))) errors.push(`Missing asset ${name}`)
if (errors.length) throw new Error(errors.join('\n'))
console.log(`Standalone imports and local wallet assets verified (${files.length} files).`)
