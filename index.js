module.exports = Discovery

var debug = require('debug')('torrent-discovery')
var DHT = require('bittorrent-dht/client') // empty object in browser
var EventEmitter = require('events').EventEmitter
var extend = require('xtend/mutable')
var inherits = require('inherits')
var reemit = require('re-emitter')
var Tracker = require('bittorrent-tracker/client')

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
    tracker: true,
    wrtc: null
  }, opts)

  self.infoHash = null
  self.infoHashHex = null
  self.torrent = null

  self._externalDHT = typeof self.dht === 'object'
  self._performedDHTLookup = false

  if (!self.peerId) throw new Error('peerId required')
  if (!process.browser && !self.port) throw new Error('port required')

  if (self.dht) self._createDHT(self.dhtPort)
}

Discovery.prototype.setTorrent = function (torrent) {
  var self = this

  if (!self.infoHash && Buffer.isBuffer(torrent) || typeof torrent === 'string') {
    self.infoHash = typeof torrent === 'string'
      ? new Buffer(torrent, 'hex')
      : torrent
  } else if (!self.torrent && torrent && torrent.infoHash) {
    self.torrent = torrent
    self.infoHash = typeof torrent.infoHash === 'string'
      ? new Buffer(torrent.infoHash, 'hex')
      : torrent.infoHash
  } else {
    return
  }

  self.infoHashHex = self.infoHash.toString('hex')
  debug('setTorrent %s', self.infoHashHex)

  // If tracker exists, then it was created with just infoHash. Set torrent length
  // so client can report correct information about uploads.
  if (self.tracker && self.tracker !== true) {
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
  if (self.tracker) {
    if (self.tracker.stop) self.tracker.stop()
    if (self.tracker.destroy) self.tracker.destroy()
  }

  if (!self._externalDHT && self.dht && self.dht.destroy) self.dht.destroy(cb)
  else process.nextTick(function () { cb(null) })
}

Discovery.prototype._createDHT = function (port) {
  var self = this
  if (!self._externalDHT) self.dht = new DHT()
  reemit(self.dht, self, ['error', 'warning'])
  self.dht.on('peer', function (addr, infoHash) {
    if (infoHash === self.infoHashHex) self.emit('peer', addr)
  })
  if (!self._externalDHT) self.dht.listen(port)
}

Discovery.prototype._createTracker = function () {
  var self = this
  if (!self.tracker) return

  var torrent = self.torrent || {
    infoHash: self.infoHashHex,
    announce: self.announce
  }

  var trackerOpts = {
    rtcConfig: self.rtcConfig,
    wrtc: self.wrtc
  }

  self.tracker = new Tracker(self.peerId, self.port, torrent, trackerOpts)

  reemit(self.tracker, self, ['peer', 'warning', 'error'])
  self.tracker.start()
}

Discovery.prototype._dhtLookupAndAnnounce = function () {
  var self = this
  if (self._performedDHTLookup) return
  self._performedDHTLookup = true

  debug('dht lookup')
  self.dht.lookup(self.infoHash, function (err) {
    if (err || !self.port) return
    debug('dht announce')
    self.dht.announce(self.infoHash, self.port, function () {
      debug('dht announce complete')
      self.emit('dhtAnnounce')
    })
  })
}
