var Discovery = require('../')
var DHT = require('bittorrent-dht')
var hat = require('hat')
var test = require('tape')

test('re-use dht, verify that peers are filtered', function (t) {
  var infoHash1 = hat(160)
  var infoHash2 = hat(160)

  var dht = new DHT()
  var discovery = new Discovery({
    peerId: hat(160),
    port: 6000,
    dht: dht
  })
  discovery.setTorrent(infoHash1)

  discovery.once('peer', function (addr) {
    t.equal(addr, '1.2.3.4')
  })
  dht.emit('peer', '1.2.3.4', infoHash1)

  // Only peers for `infoHash1` should get emitted, none from `infoHash2`
  discovery.once('peer', function (addr) {
    t.equal(addr, '4.5.6.7')

    discovery.stop(function () {
      dht.destroy(function () {
        t.end()
      })
    })
  })
  dht.emit('peer', '2.3.4.5', infoHash2) // discovery should not emit this peer
  dht.emit('peer', '3.4.5.6', infoHash2) // discovery should not emit this peer
  dht.emit('peer', '4.5.6.7', infoHash1)
})
