import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { QRCodeSVG } from 'qrcode.react'
import { loadUI } from './load-ui.mjs'

const loader = loadUI()
const { default: WalletTools } = await import('../src/WalletTools.tsx')
loader.deregister()

const address = '0x1111111111111111111111111111111111111111'
const personal = overrides => ({
  balances: { usdc: 25_000_000n, eth: 1_000_000_000_000_000n },
  activity: [], busy: false, loading: false, edit() {}, refresh: async () => {},
  ...overrides,
})
const button = (root, label) => root.root.findAllByType('button').find(node => node.children.includes(label))

for (const [chain_id, name, explorer] of [
  [1, 'Ethereum mainnet', 'https://eth.blockscout.com'],
  [11155111, 'Ethereum Sepolia', 'https://eth-sepolia.blockscout.com'],
]) {
  test(`Receive opens the exact address, chain QR, copy action and explorer on ${name}`, async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const copied = []
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { copied.push(text) } } } })
    let root
    try {
      await act(async () => { root = create(React.createElement(WalletTools, { wallet: { address, chain_id }, personal: personal(), hidden: false, busy: false })) })
      assert.equal(button(root, 'Receive').props.disabled, false)
      await act(async () => { button(root, 'Receive').props.onClick() })
      assert.equal(root.root.findByProps({ 'aria-label': 'Wallet address' }).children.join(''), address)
      assert.equal(root.root.findByType(QRCodeSVG).props.value, `ethereum:${address}@${chain_id}`)
      const link = root.root.findByType('a')
      assert.equal(link.props.href, `${explorer}/address/${address}`)
      assert.equal(link.props.target, '_blank')
      await act(async () => { button(root, 'Copy address').props.onClick() })
      assert.deepEqual(copied, [address])
      assert.ok(button(root, 'Address copied ✓'))
      await act(async () => { button(root, '← ').props.onClick() })
      assert.ok(button(root, 'Send'))
      assert.ok(button(root, 'Activity'))
    } finally {
      await act(async () => { root?.unmount() })
      if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
      else delete globalThis.navigator
    }
  })

  test(`Activity opens sent and received transaction links on ${name}`, async () => {
    const activity = [
      { hash: `0x${'a'.repeat(64)}`, direction: 'sent', asset: 'USDC', amount: '1', status: 'confirmed', timestamp: '2026-10-01T12:00:00Z' },
      { hash: `0x${'b'.repeat(64)}`, direction: 'received', asset: 'ETH', amount: '0.01', status: 'confirmed', timestamp: '2026-10-01T12:00:00Z' },
    ]
    let root, refreshes = 0
    try {
      const props = { wallet: { address, chain_id }, personal: personal({ activity, refresh: async () => { refreshes++ } }), hidden: false, busy: false }
      await act(async () => { root = create(React.createElement(WalletTools, props)) })
      assert.equal(button(root, 'Activity').props.disabled, false)
      await act(async () => { button(root, 'Activity').props.onClick() })
      const links = root.root.findAllByType('a')
      assert.deepEqual(links.map(link => link.props.href), [...activity.map(item => `${explorer}/tx/${item.hash}`), `${explorer}/address/${address}`])
      assert.ok(links.every(link => link.props.target === '_blank' && link.props.rel === 'noreferrer'))
      assert.match(links[0].props['aria-label'], /sent USDC/)
      assert.match(links[1].props['aria-label'], /received ETH/)
      await act(async () => { root.root.findByProps({ 'aria-label': 'Refresh wallet balances and activity' }).props.onClick() })
      assert.equal(refreshes, 1)
      await act(async () => { root.update(React.createElement(WalletTools, { ...props, hidden: true })) })
      assert.deepEqual(root.root.findAllByType('strong').map(node => node.children.join('')), ['•••• USDC', '•••• ETH'])
    } finally { await act(async () => { root?.unmount() }) }
  })
}

test('wallet actions stay disabled when disconnected, unsupported or busy', async () => {
  for (const [wallet, busy, walletBusy] of [
    [null, false, false],
    [{ address, chain_id: 999999 }, false, false],
    [{ address, chain_id: 1 }, true, false],
    [{ address, chain_id: 1 }, false, true],
  ]) {
    let root
    try {
      await act(async () => { root = create(React.createElement(WalletTools, { wallet, personal: personal({ busy: walletBusy }), hidden: false, busy })) })
      for (const label of ['Receive', 'Send', 'Activity']) assert.equal(button(root, label).props.disabled, true, label)
      if (!wallet) assert.match(JSON.stringify(root.toJSON()), /Sign in to use Receive, Send, and Activity/)
    } finally { await act(async () => { root?.unmount() }) }
  }
})

test('Activity distinguishes loading, empty history and failure, retaining the explorer fallback', async () => {
  let root
  const props = { wallet: { address, chain_id: 1 }, personal: personal({ loading: true }), hidden: false, busy: false }
  try {
    await act(async () => { root = create(React.createElement(WalletTools, props)) })
    await act(async () => { button(root, 'Activity').props.onClick() })
    assert.match(JSON.stringify(root.toJSON()), /Loading activity/)
    await act(async () => { root.update(React.createElement(WalletTools, { ...props, personal: personal() })) })
    assert.match(JSON.stringify(root.toJSON()), /No recent transfers found/)
    await act(async () => { root.update(React.createElement(WalletTools, { ...props, personal: personal({ activityError: 'Activity is unavailable. You can still check the explorer.' }) })) })
    assert.match(JSON.stringify(root.toJSON()), /Activity is unavailable/)
    assert.doesNotMatch(JSON.stringify(root.toJSON()), /No recent transfers found/)
    assert.equal(root.root.findByType('a').props.href, `https://eth.blockscout.com/address/${address}`)
  } finally { await act(async () => { root?.unmount() }) }
})
