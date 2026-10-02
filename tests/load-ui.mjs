import { registerHooks } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import ts from 'typescript'

// Node test harness for the real TS/React components, with explicit I/O stubs.
export function loadUI(stubs = {}) {
  return registerHooks({
    resolve(specifier, context, next) {
      if (Object.hasOwn(stubs, specifier)) return { url: `fixture:${specifier}`, shortCircuit: true }
      if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
        const url = new URL(specifier, context.parentURL)
        for (const extension of ['.ts', '.tsx']) if (existsSync(new URL(url.href + extension))) return { url: url.href + extension, shortCircuit: true }
      }
      return next(specifier, context)
    },
    load(url, context, next) {
      if (url.startsWith('fixture:')) return { format: 'module', source: stubs[url.slice(8)], shortCircuit: true }
      if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true }
      if (/\/src\/.*\.tsx?(?:\?.*)?$/.test(url)) return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8').replaceAll('import.meta.env.DEV', 'false'), { fileName: new URL(url).pathname, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText, shortCircuit: true }
      return next(url, context)
    },
  })
}
