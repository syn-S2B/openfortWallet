import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { loadUI } from './load-ui.mjs'

const loader = loadUI()
const { default: WalletTools } = await import('../src/WalletTools.tsx')
loader.deregister()

test('mainnet receive and transaction links never label real funds as Sepolia', async () => {
  const hash = `0x${'a'.repeat(64)}`
  const wallet = { address: `0x${'1'.repeat(40)}`, chain_id: 1 }
  const personal = { balances: { usdc: 10_000_000n, eth: 0n }, activity: [], edit() {}, newTransfer: () => true,
    loadIncoming: async () => {}, submission: { status: 'confirmed', hash, amount: '1', asset: 'USDC' }, showOutcome: true }
  let root
  const button = label => root.root.findAllByType('button').find(b => b.children.some(c => c === label))
  try {
    await act(async () => { root = create(React.createElement(WalletTools, { wallet, personal, hidden: false, busy: false })) })
    assert.match(JSON.stringify(root.toJSON()), /Real USDC · Ethereum mainnet/)
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /Sepolia|Test tokens/)
    await act(async () => { button('Receive').props.onClick() })
    assert.equal(root.root.findAllByType('a')[0].props.href, `https://eth.blockscout.com/address/${wallet.address}`)
    assert.match(JSON.stringify(root.toJSON()), /Ethereum mainnet/)
    await act(async () => { root.root.findAllByType('button').find(b => b.children.includes('← ')).props.onClick() })
    await act(async () => { button('Send').props.onClick() })
    assert.equal(root.root.findByProps({ className: 'wallet-transaction-link' }).props.href, `https://eth.blockscout.com/tx/${hash}`)
  } finally { await act(async () => { root?.unmount() }) }
})
