module.exports = Discovery

var debug = require('debug')('bittorrent-discovery')
var DHT = require('bittorrent-dht/client')
var EventEmitter = require('events').EventEmitter
var extend = require('extend.js')
var inherits = require('inherits')
var Tracker = require('bittorrent-tracker/client')

inherits(Discovery, EventEmitter)

function Discovery (opts) {
  var self = this
  if (!(self instanceof Discovery)) return new Discovery(opts)
  EventEmitter.call(self)
  if (!opts) opts = {}

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

Discovery.prototype._onPeer = function (addr) {
  var self = this
  self.emit('peer', addr)
}

Discovery.prototype._dhtLookupAndAnnounce = function () {
  var self = this
  debug('lookup')
  self.dht.lookup(self.infoHash, function (err) {
    if (err || !self.port) return
    debug('dhtAnnounce')
    self.dht.announce(self.infoHash, self.port, function () {
      self.emit('dhtAnnounce')
    })
  })
}

Discovery.prototype._createDHT = function (port) {
  var self = this
  if (self.dht === false) return

  if (self.dht) {
    self.externalDHT = true
  } else {
    self.dht = new DHT()
    self.dht.on('error', function (err) {
      self.emit('error', err)
    })
    self.dht.listen(port)
  }
  self.dht.on('peer', self._onPeer.bind(self))
}

Discovery.prototype._createTracker = function () {
  var self = this
  if (self.tracker === false) return

  var torrent = self.torrent || {
    infoHash: self.infoHash,
    announce: self.announce
  }

  self.tracker = new Tracker(self.peerId, self.port, torrent)
  self.tracker.on('peer', self._onPeer.bind(self))
  self.tracker.on('error', function (err) {
    // trackers are optional, so errors like an inaccessible tracker, etc. are not fatal
    self.emit('warning', err)
  })
  self.tracker.start()
}

Discovery.prototype.setTorrent = function (torrent) {
  var self = this
  debug('setTorrent %s', torrent)

  if (torrent && torrent.infoHash) {
    if (self.torrent) return
    self.torrent = torrent
    self.infoHash = torrent.infoHash
  } else {
    if (self.infoHash) return
    self.infoHash = torrent
  }

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

Discovery.prototype.stop = function () {
  var self = this
  if (self.tracker) self.tracker.stop()
  if (self.dht && !self.externalDHT) self.dht.destroy()
}
