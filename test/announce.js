var DHT = require('bittorrent-dht')
var Discovery = require('../')
var randombytes = require('randombytes')
var test = require('tape')
var common = require('./common')

common.wrapTest(test, 'initialize with dht', function (t, ipv6) {
  t.plan(5)
  var dht = new DHT({ bootstrap: false, ipv6: ipv6 })
  var discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht: ipv6 ? false : dht,
    dht6: ipv6 ? dht : false,
    intervalMs: 1000
  })

  var _dhtAnnounce = discovery._dhtAnnounce
  var num = 0
  discovery._dhtAnnounce = function (dht) {
    num += 1
    t.pass('called once after 1000ms')
    _dhtAnnounce.call(discovery, dht)
    if (num === 4) {
      discovery.destroy(function () {
        dht.destroy(function () {
          t.pass()
        })
      })
    }
  }
})
