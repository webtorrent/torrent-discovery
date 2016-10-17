module.exports = Discovery

var debug = require('debug')('torrent-discovery')
var DHT = require('bittorrent-dht/client') // empty object in browser
var EventEmitter = require('events').EventEmitter
var extend = require('xtend')
var inherits = require('inherits')
var parallel = require('run-parallel')
var net = require('net')
var Tracker = require('bittorrent-tracker/client')

inherits(Discovery, EventEmitter)

function Discovery (opts) {
  var self = this
  if (!(self instanceof Discovery)) return new Discovery(opts)
  EventEmitter.call(self)

  if (!opts.peerId) throw new Error('Option `peerId` is required')
  if (!opts.infoHash) throw new Error('Option `infoHash` is required')
  if (!process.browser && !opts.port) throw new Error('Option `port` is required')

  self.peerId = typeof opts.peerId === 'string'
    ? opts.peerId
    : opts.peerId.toString('hex')
  self.infoHash = typeof opts.infoHash === 'string'
    ? opts.infoHash
    : opts.infoHash.toString('hex')
  self._port = opts.port // torrent port

  self.destroyed = false

  self._announce = opts.announce || []
  self._intervalMs = opts.intervalMs || (15 * 60 * 1000)
  self._trackerOpts = null
  self._dhtAnnouncing = false
  self._dht6Announcing = false
  self._dhtTimeout = false
  self._internalDHT = false // is the DHT created internally?
  self._internalDHT6 = false
  self.dhtPort = null
  self.dht = null
  self.dht6 = null

  self._onWarning = function (err) {
    self.emit('warning', err)
  }
  self._onError = function (err) {
    self.emit('error', err)
  }
  self._onDHTPeer = function (peer, infoHash) {
    if (infoHash.toString('hex') !== self.infoHash) return

    var host = peer.host
    if (net.isIPv6(peer.host)) {
      host = '[' + peer.host + ']'
    }
    var addr = host + ':' + peer.port
    debug('DHT peer: ' + addr)
    self.emit('peer', addr)
  }
  self._onTrackerPeer = function (peer) {
    debug('Tracker peer: ' + peer)
    self.emit('peer', peer)
  }
  self._onTrackerAnnounce = function () {
    self.emit('trackerAnnounce')
  }

  if (opts.tracker === false) {
    self.tracker = null
  } else if (opts.tracker && typeof opts.tracker === 'object') {
    self._trackerOpts = extend(opts.tracker)
    self.tracker = self._createTracker()
  } else {
    self.tracker = self._createTracker()
  }

  initDHT('dht')
  initDHT('dht6')

  function initDHT (field) {
    if (opts[field] === false || typeof DHT !== 'function') {
      self[field] = null
    } else if (opts[field] && typeof opts[field].addNode === 'function') {
      self[field] = opts[field]
    } else if (opts[field] && typeof opts[field] === 'object') {
      self[field] = createDHT(opts.dhtPort, field, opts[field])
    } else {
      self[field] = createDHT(opts.dhtPort, field)
    }

    if (self[field]) {
      self[field].on('peer', self._onDHTPeer)
      self._dhtAnnounce(self[field])
    }
  }

  function createDHT (port, field, opts) {
    if (!opts) { opts = {} }
    opts.ipv6 = field === 'dht6'
    var dht = new DHT(opts)
    dht.on('warning', self._onWarning)
    dht.on('error', self._onError)
    dht.listen(port)

    self[field === 'dht6' ? '_internalDHT6' : '_internalDHT'] = true
    return dht
  }
}

Discovery.prototype.updatePort = function (port, ipv6) {
  var self = this
  if (port === self._port) return
  self._port = port

  if (self.dht) { self._dhtAnnounce(self.dht) }
  if (self.dht6) { self._dhtAnnounce(self.dht6) }

  if (self.tracker) {
    self.tracker.stop()
    self.tracker.destroy(function () {
      self.tracker = self._createTracker()
    })
  }
}

Discovery.prototype.complete = function (opts) {
  if (this.tracker) {
    this.tracker.complete(opts)
  }
}

Discovery.prototype.destroy = function (cb) {
  var self = this
  if (self.destroyed) return
  self.destroyed = true

  clearTimeout(self._dhtTimeout)

  var tasks = []

  if (self.tracker) {
    self.tracker.stop()
    self.tracker.removeListener('warning', self._onWarning)
    self.tracker.removeListener('error', self._onError)
    self.tracker.removeListener('peer', self._onTrackerPeer)
    self.tracker.removeListener('update', self._onTrackerAnnounce)
    tasks.push(function (cb) {
      self.tracker.destroy(cb)
    })
  }

  if (self.dht) {
    self.dht.removeListener('peer', self._onDHTPeer)
  }
  if (self.dht6) {
    self.dht6.removeListener('peer', self._onDHTPeer)
  }

  if (self._internalDHT) {
    self._cleanupDHT(self.dht, tasks)
  }
  if (self._internalDHT6) {
    self._cleanupDHT(self.dht6, tasks)
  }

  parallel(tasks, cb)

  // cleanup
  self.dht = null
  self.dht6 = null
  self.tracker = null
  self._announce = null
}

Discovery.prototype._cleanupDHT = function (dht, tasks) {
  dht.removeListener('warning', this._onWarning)
  dht.removeListener('error', this._onError)
  tasks.push(function (cb) {
    dht.destroy(cb)
  })
}

Discovery.prototype._createTracker = function () {
  var opts = extend(this._trackerOpts, {
    infoHash: this.infoHash,
    announce: this._announce,
    peerId: this.peerId,
    port: this._port
  })

  var tracker = new Tracker(opts)
  tracker.on('warning', this._onWarning)
  tracker.on('error', this._onError)
  tracker.on('peer', this._onTrackerPeer)
  tracker.on('update', this._onTrackerAnnounce)
  tracker.setInterval(this._intervalMs)
  tracker.start()
  return tracker
}

Discovery.prototype._dhtAnnounce = function (dht) {
  var self = this
  var field = '_dhtAnnouncing' + (dht.ipv6 ? '6' : '')
  if (self[field]) return
  debug('dht (IPv6: ' + dht.ipv6 + ') announce')

  self[field] = true
  clearTimeout(self._dhtTimeout)

  dht.announce(self.infoHash, self._port, function (err) {
    self[field] = false
    debug('dht (IPv6: ' + dht.ipv6 + ') announce complete')

    if (err) self.emit('warning', err)
    self.emit('dhtAnnounce', dht)

    if (!self.destroyed) {
      self._dhtTimeout = setTimeout(function () {
        self._dhtAnnounce(dht)
      }, getRandomTimeout())
      if (self._dhtTimeout.unref) self._dhtTimeout.unref()
    }
  })

  // Returns timeout interval, with some random jitter
  function getRandomTimeout () {
    return self._intervalMs + Math.floor(Math.random() * self._intervalMs / 5)
  }
}
