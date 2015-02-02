module.exports = Discovery

var debug = require('debug')('torrent-discovery')
var DHT = require('bittorrent-dht/client') // empty object in browser
var EventEmitter = require('events').EventEmitter
var extend = require('xtend/mutable')
var inherits = require('inherits')
var reemit = require('re-emitter')
var Tracker = require('bittorrent-tracker/client') // `webtorrent-tracker` in browser

inherits(Discovery, EventEmitter)

function Discovery (opts) {
  var self = this
  if (!(self instanceof Discovery)) return new Discovery(opts)
  EventEmitter.call(self)

  extend(self, {
    announce: [],
    dht: typeof DHT === 'function',
    rtcConfig: null, // browser only
    peerId: null,
    port: 0, // torrent port
    tracker: true
  }, opts)

  self._externalDHT = typeof self.dht === 'object'
  self._performedDHTLookup = false

  if (!self.peerId) throw new Error('peerId required')
  if (!process.browser && !self.port) throw new Error('port required')
  if (process.browser && (!self.announce || self.announce.length === 0))
    console.warn('Warning: must specify a tracker server to discover peers (required in browser because DHT is not implemented yet) (you can use wss://tracker.webtorrent.io)')

  if (self.dht) self._createDHT(self.dhtPort)
}

Discovery.prototype.setTorrent = function (torrent) {
  var self = this
  if (self.torrent) return

  if (torrent && torrent.infoHash) {
    self.torrent = torrent
    self.infoHash = torrent.infoHash
  } else {
    if (self.infoHash) return
    self.infoHash = torrent
  }
  debug('setTorrent %s', torrent)

  // If tracker exists, then it was created with just infoHash. Set torrent length
  // so client can report correct information about uploads.
  if (self.tracker && self.tracker !== true)
    self.tracker.torrentLength = torrent.length
  else
    self._createTracker()

  if (self.dht) {
    if (self.dht.ready) self._dhtLookupAndAnnounce()
    else self.dht.on('ready', self._dhtLookupAndAnnounce.bind(self))
  }
}

Discovery.prototype.stop = function (cb) {
  var self = this
  if (self.tracker && self.tracker.stop) self.tracker.stop()
  if (!self._externalDHT && self.dht && self.dht.destroy) self.dht.destroy(cb)
  else process.nextTick(function () { cb(null) })
}

Discovery.prototype._createDHT = function (port) {
  var self = this
  if (!self._externalDHT) self.dht = new DHT()
  reemit(self.dht, self, ['error', 'warning'])
  self.dht.on('peer', function (addr, infoHash) {
    if (infoHash === self.infoHash) self.emit('peer', addr)
  })
  if (!self._externalDHT) self.dht.listen(port)
}

Discovery.prototype._createTracker = function () {
  var self = this
  if (!self.tracker) return

  var torrent = self.torrent || {
    infoHash: self.infoHash,
    announce: self.announce
  }

  self.tracker = process.browser
    ? new Tracker(self.peerId, torrent, { rtcConfig: self.rtcConfig })
    : new Tracker(self.peerId, self.port, torrent)

  reemit(self.tracker, self, ['peer', 'warning', 'error'])
  self.tracker.start()
}

Discovery.prototype._dhtLookupAndAnnounce = function () {
  var self = this
  if (self._performedDHTLookup) return
  self._performedDHTLookup = true

  debug('lookup')
  self.dht.lookup(self.infoHash, function (err) {
    if (err || !self.port) return
    debug('dhtAnnounce')
    self.dht.announce(self.infoHash, self.port, function () {
      self.emit('dhtAnnounce')
    })
  })
}
