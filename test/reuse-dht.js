var Discovery = require('../')
var DHT = require('bittorrent-dht')
var randombytes = require('randombytes')
var test = require('tape')
var common = require('./common')

common.wrapTest(test, 're-use dht, verify that peers are filtered', function (t, ipv6) {
  t.plan(3)
  var infoHash1 = randombytes(20)
  var infoHash2 = randombytes(20)

  var dht = new DHT({ipv6: ipv6})
  var discovery = new Discovery({
    infoHash: infoHash1,
    peerId: randombytes(20),
    port: 6000,
    dht: ipv6 ? false : dht,
    dht6: ipv6 ? dht : false
  })

  discovery.once('peer', function (addr) {
    t.equal(addr, ipv6 ? '[::1]:8000' : '1.2.3.4:8000')
  })
  dht.emit('peer', { host: ipv6 ? '::1' : '1.2.3.4', port: '8000' }, infoHash1)

  // Only peers for `infoHash1` should get emitted, none from `infoHash2`
  discovery.once('peer', function (addr) {
    t.equal(addr, ipv6 ? '[::4]:8000' : '4.5.6.7:8000')

    discovery.destroy(function () {
      dht.destroy(function () {
        t.pass()
      })
    })
  })
  dht.emit('peer', { host: ipv6 ? '::2' : '2.3.4.5', port: '8000' }, infoHash2) // discovery should not emit this peer
  dht.emit('peer', { host: ipv6 ? '::3' : '3.4.5.6', port: '8000' }, infoHash2) // discovery should not emit this peer
  dht.emit('peer', { host: ipv6 ? '::4' : '4.5.6.7', port: '8000' }, infoHash1)
})
