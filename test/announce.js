import DHT from 'bittorrent-dht'
import Discovery from '../index.js'
import randombytes from 'randombytes'
import test from 'tape'

test('initialize with dht', t => {
  t.plan(5)
  const dht = new DHT({ bootstrap: false })
  const discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht,
    intervalMs: 1000
  })

  const _dhtAnnounce = discovery._dhtAnnounce
  let num = 0
  discovery._dhtAnnounce = () => {
    num += 1
    t.pass('called once after 1000ms')
    _dhtAnnounce.call(discovery)
    if (num === 4) {
      discovery.destroy(() => {
        dht.destroy(() => {
          t.pass()
        })
      })
    }
  }
})
