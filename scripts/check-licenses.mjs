import { readFileSync } from 'node:fs'
const { packages } = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
// Review boundary, not legal advice; unknown license expressions require explicit review.
const reviewed = new Set(['MIT', 'ISC', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', '0BSD', 'MPL-2.0', 'BlueOak-1.0.0', '(MIT OR Apache-2.0)'])
const errors = Object.entries(packages).filter(([name, pkg]) => name && !reviewed.has(pkg.license)).map(([name, pkg]) => `${name}: ${pkg.license ?? 'missing license'}`)
if (errors.length) throw new Error(`Dependency license review required:\n${errors.join('\n')}`)
console.log(`Dependency license metadata checked (${Object.keys(packages).length - 1} locked packages).`)
