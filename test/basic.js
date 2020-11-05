const Discovery = require('../')
const DHT = require('bittorrent-dht')
const randombytes = require('randombytes')
const test = require('tape')

test('initialize with dht', t => {
  t.plan(1)
  const dht = new DHT()
  const discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht
  })
  discovery.destroy(() => {
    dht.destroy(() => {
      t.pass()
    })
  })
})

test('initialize with default dht and lsd', t => {
  t.plan(3)
  const discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000
  })
  t.ok(discovery.dht)
  t.ok(discovery.lsd)
  discovery.destroy(() => {
    t.pass()
  })
})

test('initialize without dht', t => {
  t.plan(2)
  const discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht: false
  })
  t.equal(discovery.dht, null)
  discovery.destroy(() => {
    t.pass()
  })
})

test('initialize without lsd', t => {
  t.plan(2)
  const discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    lsd: false
  })
  t.equal(discovery.lsd, null)
  discovery.destroy(() => {
    t.pass()
  })
})
