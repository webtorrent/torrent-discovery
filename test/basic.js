var Discovery = require('../')
var DHT = require('bittorrent-dht')
var randombytes = require('randombytes')
var test = require('tape')
var common = require('./common')

common.wrapTest(test, 'initialize with dht', function (t, ipv6) {
  t.plan(1)
  var dht = new DHT({ipv6: ipv6})
  var discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht: ipv6 ? false : dht,
    dht6: ipv6 ? dht : false
  })
  discovery.destroy(function () {
    dht.destroy(function () {
      t.pass()
    })
  })
})

common.wrapTest(test, 'initialize with default dht', function (t, ipv6) {
  t.plan(1)
  var discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht: !ipv6,
    dht6: ipv6
  })
  discovery.destroy(function () {
    t.pass()
  })
})

common.wrapTest(test, 'initialize without dht', function (t, ipv6) {
  t.plan(2)
  var discovery = new Discovery({
    infoHash: randombytes(20),
    peerId: randombytes(20),
    port: 6000,
    dht: false,
    dht6: false
  })
  t.equal(discovery.dht, null)
  discovery.destroy(function () {
    t.pass()
  })
})

test('use ipv4 and ipv6 together', function (t) {
  t.plan(3)

  var dhtv4 = new DHT({ipv6: false})
  var dhtv6 = new DHT({ipv6: true})

  var infoHash = randombytes(20)

  var discovery = new Discovery({
    infoHash: infoHash,
    peerId: randombytes(20),
    port: 6000,
    dht: dhtv4,
    dht6: dhtv6
  })

  discovery.once('peer', function (addr) {
    t.equal(addr, '[::1]:8000')
  })
  dhtv4.emit('peer', { host: '::1', port: '8000' }, infoHash)

  discovery.once('peer', function (addr) {
    t.equal(addr, '1.2.3.4:8000')
  })
  dhtv6.emit('peer', { host: '1.2.3.4', port: '8000' }, infoHash)

  discovery.destroy(function () {
    t.pass()
    dhtv4.destroy()
    dhtv6.destroy()
  })
})

