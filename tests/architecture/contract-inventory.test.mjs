import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
const root = new URL('../../', import.meta.url)
const inventory = JSON.parse(readFileSync(new URL('docs/tool-contracts.json', root), 'utf8'))
test('the deduplicated contract inventory records ownership, authority, evidence, retries and test pointers', () => {
  const names = new Set()
  for (const tool of inventory.tools) {
    assert.match(tool.name, /^tool_/)
    assert.equal(names.has(tool.name), false, tool.name); names.add(tool.name)
    for (const field of ['responsibility','service_owner','inputs','resources','resource_parts','authority','effect','completion_condition','evidence','retry_semantics','used_by_workflows','contract_test_status']) assert.ok(tool[field], `${tool.name}: ${field}`)
    assert.ok(tool.result_states.length); assert.ok(existsSync(new URL(tool.source, root)))
    for (const file of tool.contract_tests) assert.ok(existsSync(new URL(file, root)), file)
  }
})
