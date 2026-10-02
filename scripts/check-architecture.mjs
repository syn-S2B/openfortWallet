import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import ts from 'typescript'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('..', import.meta.url))
export function dependencyViolation(source, target) {
  const sourceLayer = source.split('/')[1], targetLayer = target.split('/')[1]
  if (source.startsWith('src/') && target.startsWith('server/')) return 'browser imports confidential server code'
  if (targetLayer === 'adapter' && !['capability', 'adapter'].includes(sourceLayer)) return 'Adapter privacy violation'
  if (['workflow', 'journey', 'tool', 'resource', 'recipe', 'contracts'].includes(sourceLayer) && target.startsWith('src/') && /\.(tsx|css)$/.test(target)) return 'domain imports Surface'
  if (['tool', 'resource', 'recipe', 'contracts', 'adapter'].includes(sourceLayer) && ['journey', 'workflow'].includes(targetLayer)) return 'lower layer imports orchestration'
  if (sourceLayer === 'workflow' && targetLayer === 'journey') return 'Workflow imports Journey'
  return null
}
export function checkArchitecture(directory = root) {
  const errors = [], files = []
  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (/\.(ts|tsx|mjs)$/.test(path)) files.push(path)
    }
  }
  walk(resolve(directory, 'src')); walk(resolve(directory, 'server'))
  for (const file of files) {
    const name = relative(directory, file), source = readFileSync(file, 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const specifiers = []
    function visit(node) {
      if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) || (ts.isExportDeclaration(node) && !node.isTypeOnly)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text)
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text)
      if (ts.isCallExpression(node) && (ts.isIdentifier(node.expression) && node.expression.text === 'fetch') && !/\/adapter\//.test(name)) errors.push(`${name}: provider transport outside Adapter`)
      ts.forEachChild(node, visit)
    }
    visit(ast)
    for (const specifier of specifiers) {
      if (specifier === '@openfort/openfort-js' && name !== 'src/adapter/adapter_openfort.ts') errors.push(`${name}: provider SDK outside Adapter`)
      if (!specifier.startsWith('.')) continue
      const base = resolve(dirname(file), specifier.split('?')[0])
      const target = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`].find(existsSync)
      if (!target) continue
      const problem = dependencyViolation(name, relative(directory, target))
      if (problem) errors.push(`${name} -> ${relative(directory, target)}: ${problem}`)
    }
  }
  return { errors, count: files.length }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkArchitecture()
  if (result.errors.length) throw new Error(result.errors.join('\n'))
  console.log(`Architecture boundaries verified (${result.count} modules).`)
}
