import test from 'node:test'
import assert from 'node:assert/strict'
import { loadUI } from '../load-ui.mjs'
const loader = loadUI()
const { tool_record_backup_release, tool_complete_backup_release } = await import('../../src/tool/tool_record_backup_release.ts')
const { createBackupCapability } = await import('../../src/capability/tool_capability_backup.ts')
loader.deregister()
test('browser key release persists a one-use fence and rejects replay after interruption or completion', () => {
  const oldWindow = globalThis.window, oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const values = new Map()
  globalThis.window = {}
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } })
  try {
    tool_record_backup_release('owner', 'original-proof', '/member-backup', 'unlock')
    let saved = JSON.parse([...values.values()][0])
    assert.equal(saved.state, 'indeterminate'); assert.equal(saved.operationId, 'original-proof')
    assert.throws(() => tool_record_backup_release('owner', 'original-proof', '/different-scope', 'unlock'), error => error.state === 'indeterminate')
    tool_complete_backup_release('owner', 'original-proof', 'bound-file-digest')
    saved = JSON.parse([...values.values()][0]); assert.equal(saved.state, 'completed'); assert.equal(saved.evidenceReference, 'bound-file-digest')
    assert.throws(() => tool_record_backup_release('owner', 'original-proof', '/member-backup', 'unlock'), error => error.state === 'indeterminate')
    let calls = 0
    globalThis.localStorage.setItem = () => { throw new Error('durability unavailable') }
    const capability = createBackupCapability(async () => { calls++; return {} })
    assert.throws(() => capability.release('/member-backup', { onli_id: 'owner' }, {}, 'new-proof'), /durability unavailable/)
    assert.equal(calls, 0)
  } finally {
    globalThis.window = oldWindow
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage); else delete globalThis.localStorage
  }
})
