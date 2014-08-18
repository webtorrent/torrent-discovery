module.exports = Discovery

var debug = require('debug')('bittorrent-discovery')
var DHT = require('bittorrent-dht/client')
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var inherits = require('inherits')
var reemit = require('re-emitter')
var Tracker = require('bittorrent-tracker/client')

inherits(Discovery, EventEmitter)

function Discovery (opts) {
  var self = this
  if (!(self instanceof Discovery)) return new Discovery(opts)
  EventEmitter.call(self)
  if (!opts) opts = {}

  self._performedDHTLookup = false

  extend(self, {
    announce: [],
    dht: true,
    externalDHT: false,
    tracker: true,
    port: null // torrent port
  }, opts)

  if (!self.peerId) throw new Error('peerId required')
  if (!self.port) throw new Error('port required')

  self._createDHT(opts.dhtPort)
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

  if (self.tracker && self.tracker !== true) {
    // If tracker exists, then it was created with just infoHash. Set torrent length
    // so client can report correct information about uploads.
    self.tracker.torrentLength = torrent.length
  } else {
    self._createTracker()
  }

  if (self.dht) {
    if (self.dht.ready) self._dhtLookupAndAnnounce()
    else self.dht.on('ready', self._dhtLookupAndAnnounce.bind(self))
  }
}

Discovery.prototype.stop = function (cb) {
  var self = this
  if (self.tracker && self.tracker.stop) self.tracker.stop()
  if (!self.externalDHT && self.dht && self.dht.destroy) self.dht.destroy(cb)
  else process.nextTick(function () { cb(null) })
}

Discovery.prototype._createDHT = function (port) {
  var self = this
  if (!self.dht) return

  if (self.dht) {
    self.externalDHT = true
    reemit(self.dht, self, ['peer', 'error', 'warning'])
  } else {
    self.dht = new DHT()
    reemit(self.dht, self, ['peer', 'error', 'warning'])
    self.dht.listen(port)
  }
}

Discovery.prototype._createTracker = function () {
  var self = this
  if (!self.tracker) return

  var torrent = self.torrent || {
    infoHash: self.infoHash,
    announce: self.announce
  }

  self.tracker = new Tracker(self.peerId, self.port, torrent)
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
