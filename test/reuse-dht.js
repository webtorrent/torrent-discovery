const Discovery = require('../')
const DHT = require('bittorrent-dht')
const randombytes = require('randombytes')
const test = require('tape')

test('re-use dht, verify that peers are filtered', t => {
  t.plan(5)
  const infoHash1 = randombytes(20)
  const infoHash2 = randombytes(20)

  const dht = new DHT()
  const discovery = new Discovery({
    infoHash: infoHash1,
    peerId: randombytes(20),
    port: 6000,
    dht
  })

  discovery.once('peer', (addr, source) => {
    t.equal(addr, '1.2.3.4:8000')
    t.equal(source, 'dht')
  })
  dht.emit('peer', { host: '1.2.3.4', port: '8000' }, infoHash1)

  // Only peers for `infoHash1` should get emitted, none from `infoHash2`
  discovery.once('peer', (addr, source) => {
    t.equal(addr, '4.5.6.7:8000')
    t.equal(source, 'dht')

    discovery.destroy(() => {
      dht.destroy(() => {
        t.pass()
      })
    })
  })
  dht.emit('peer', { host: '2.3.4.5', port: '8000' }, infoHash2) // discovery should not emit this peer
  dht.emit('peer', { host: '3.4.5.6', port: '8000' }, infoHash2) // discovery should not emit this peer
  dht.emit('peer', { host: '4.5.6.7', port: '8000' }, infoHash1)
})
