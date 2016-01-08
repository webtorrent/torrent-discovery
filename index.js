module.exports = Discovery

var debug = require('debug')('torrent-discovery')
var DHT = require('bittorrent-dht/client') // empty object in browser
var EventEmitter = require('events').EventEmitter
var extend = require('xtend')
var inherits = require('inherits')
var parallel = require('run-parallel')
var reemit = require('re-emitter')
var Tracker = require('bittorrent-tracker/client')

inherits(Discovery, EventEmitter)

function Discovery (opts) {
  var self = this
  if (!(self instanceof Discovery)) return new Discovery(opts)
  EventEmitter.call(self)

  self.announce = opts.announce || []
  self.rtcConfig = opts.rtcConfig // browser only
  self.peerId = opts.peerId
  self.port = opts.port || 0 // torrent port
  self.tracker = opts.tracker !== false
  self.wrtc = opts.wrtc
  self.intervalMs = opts.intervalMs || 15 * 60 * 1000

  if (!self.peerId) throw new Error('peerId required')
  if (!process.browser && !self.port) throw new Error('port required')

  self.infoHash = null
  self.infoHashBuffer = null
  self.torrent = null

  self._dhtTimeout = false
  self._internalDHT = false // is the DHT created internally?
  self.dht = opts.dht === false
    ? false
    : opts.dht || createDHT()

  if (self.dht) {
    reemit(self.dht, self, ['error', 'warning'])
    self.dht.on('peer', onPeer)
  }

  function createDHT () {
    if (typeof DHT !== 'function') return false
    self._internalDHT = true
    var dht = new DHT()
    dht.listen(opts.dhtPort)
    return dht
  }

  function onPeer (peer, infoHash) {
    if (infoHash.toString('hex') !== self.infoHash) return
    self.emit('peer', peer.host + ':' + peer.port)
  }
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

  if (self.dht) self._dhtAnnounce()
}

Discovery.prototype.updatePort = function (port) {
  var self = this
  if (port === self.port) return
  self.port = port

  if (self.dht) self._dhtAnnounce()

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

  if (self._internalDHT) {
    tasks.push(function (cb) {
      self.dht.destroy(cb)
    })
  }

  parallel(tasks, cb)
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
  self.tracker.setInterval(self.intervalMs)
  self.tracker.on('update', onUpdate)
  self.tracker.start()

  function onUpdate (data) {
    self.emit('trackerAnnounce', data)
  }
}

Discovery.prototype._dhtAnnounce = function () {
  var self = this
  if (!self.port || !self.infoHash) return

  self.dht.announce(self.infoHash, self.port, function (err) {
    debug('dht announce complete')
    if (err) self.emit('warning', err)
    self.emit('dhtAnnounce')

    clearTimeout(self._dhtTimeout)
    self._dhtTimeout = setTimeout(function () {
      self._dhtAnnounce()
    }, getRandomTimeout())
    self._dhtTimeout.unref()
  })

  // Returns timeout interval, with some random jitter
  function getRandomTimeout () {
    return self.intervalMs + Math.floor(Math.random() * self.intervalMs / 5)
  }
}

