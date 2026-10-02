import test from 'node:test'
import assert from 'node:assert/strict'
import { checkArchitecture, dependencyViolation } from '../../scripts/check-architecture.mjs'
test('production source observes provider and architecture boundaries', () => assert.deepEqual(checkArchitecture().errors, []))
test('boundary checker rejects direct Adapter access and inverted orchestration dependencies', () => {
  for (const caller of ['workflow', 'journey', 'tool', 'surface']) assert.match(dependencyViolation(`src/${caller}/example.ts`, 'src/adapter/example.ts'), /privacy/)
  assert.equal(dependencyViolation('src/capability/example.ts', 'src/adapter/example.ts'), null)
  assert.match(dependencyViolation('src/tool/example.ts', 'src/workflow/example.ts'), /lower layer/)
  assert.match(dependencyViolation('src/surface/example.tsx', 'server/contracts.mjs'), /confidential/)
})
