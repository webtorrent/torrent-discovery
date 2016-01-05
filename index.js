module.exports = Discovery

var debug = require('debug')('torrent-discovery')
var DHT = require('bittorrent-dht/client') // empty object in browser
var EventEmitter = require('events').EventEmitter
var extend = require('xtend/mutable')
var inherits = require('inherits')
var parallel = require('run-parallel')
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
  self.infoHashBuffer = null
  self.torrent = null

  self._externalDHT = typeof self.dht === 'object'
  self._performedDHTLookup = false

  if (!self.peerId) throw new Error('peerId required')
  if (!process.browser && !self.port) throw new Error('port required')

  if (self.dht) self._createDHT(self.dhtPort)
}

Discovery.prototype.setTorrent = function (torrent) {
  var self = this

  if (!self.infoHash && (typeof torrent === 'string' || Buffer.isBuffer(torrent))) {
    self.infoHash = typeof torrent === 'string'
      ? torrent
      : torrent.toString('hex')
  } else if (!self.torrent && torrent && torrent.infoHash) {
    self.torrent = torrent
    self.infoHash = typeof torrent.infoHash === 'string'
      ? torrent.infoHash
      : torrent.infoHash.toString('hex')
  } else {
    return
  }
  self.infoHashBuffer = new Buffer(self.infoHash, 'hex')

  debug('setTorrent %s', self.infoHash)

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

Discovery.prototype.updatePort = function (port) {
  var self = this
  if (port === self.port) return
  self.port = port

  if (self.dht && self.infoHash) {
    self._performedDHTLookup = false
    self._dhtLookupAndAnnounce()
  }

  if (self.tracker && self.tracker !== true) {
    self.tracker.stop()
    self.tracker.destroy(function () {
      self._createTracker()
    })
  }
}

Discovery.prototype.stop = function (cb) {
  var self = this
  var tasks = []

  if (self.tracker && self.tracker !== true) {
    self.tracker.stop()
    tasks.push(function (cb) {
      self.tracker.destroy(cb)
    })
  }

  if (!self._externalDHT && self.dht && self.dht !== true) {
    tasks.push(function (cb) {
      self.dht.destroy(cb)
    })
  }

  parallel(tasks, cb)
}

Discovery.prototype._createDHT = function (port) {
  var self = this
  if (!self._externalDHT) self.dht = new DHT()
  reemit(self.dht, self, ['error', 'warning'])
  self.dht.on('peer', function (peer, infoHash) {
    if (infoHash.toString('hex') === self.infoHash) self.emit('peer', peer.host + ':' + peer.port)
  })
  if (!self._externalDHT) self.dht.listen(port)
}

Discovery.prototype._createTracker = function () {
  var self = this
  if (!self.tracker) return

  var torrent = self.torrent
    ? extend({ announce: [] }, self.torrent)
    : { infoHash: self.infoHash, announce: [] }

  if (self.announce) torrent.announce = torrent.announce.concat(self.announce)

  var trackerOpts = {
    rtcConfig: self.rtcConfig,
    wrtc: self.wrtc
  }

  self.tracker = new Tracker(self.peerId, self.port, torrent, trackerOpts)
  reemit(self.tracker, self, ['peer', 'warning', 'error'])
  self.tracker.on('update', function (data) {
    self.emit('trackerAnnounce', data)
  })
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
