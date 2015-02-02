var Discovery = require('../')
var DHT = require('bittorrent-dht')
var hat = require('hat')
var test = require('tape')

test('initialize with dht', function (t) {
  var dht = new DHT()
  var discovery = new Discovery({
    peerId: hat(160),
    port: 6000,
    dht: dht
  })
  discovery.stop(function () {
    dht.destroy(function () {
      t.end()
    })
  })
})

test('initialize with default dht', function (t) {
  var discovery = new Discovery({
    peerId: hat(160),
    port: 6000
  })
  discovery.stop(function () {
    t.end()
  })
})

test('initialize without dht', function (t) {
  var discovery = new Discovery({
    peerId: hat(160),
    port: 6000,
    dht: false
  })
  discovery.stop(function () {
    t.end()
  })
})
