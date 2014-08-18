# bittorrent-discovery [![npm](https://img.shields.io/npm/v/bittorrent-discovery.svg)](https://npmjs.org/package/bittorrent-discovery) [![gittip](https://img.shields.io/gittip/feross.svg)](https://www.gittip.com/feross/)

### Discover BitTorrent peers via DHT and Trackers

This module bundles the [bittorrent-dht](https://github.com/feross/bittorrent-dht) and
[bittorrent-tracker](https://github.com/feross/bittorrent-tracker) modules and exposes
a single API for discovering peers via both methods.

This module is used by [WebTorrent](http://webtorrent.io).

### features

- simple API
- find peers in the DHT and from trackers
- automatically announces to the DHT and trackers
- can start finding peers with just an info hash, before full metadata is available

### install

```
npm install bittorrent-discovery
```

### api

#### `discovery = new Discovery(opts)`

Create a new peer discovery instance. Required options are:

```
{
  peerId: '', // as utf8 string or Buffer
  port: 0     // torrent client port
}
```

Optional options are:

```
{
  announce: [], // force list of announce urls to use (from magnet uri)
  dht: true,    // use dht? also, can optionally pass in global DHT instance to use
  tracker: true // use trackers?
}
```

**This module automatically handles announcing to the DHT, for maximum peer discovery.**

#### `discovery.setTorrent(infoHashOrTorrent)`

When you learn the infoHash (hex string) of the torrent, call this method to begin
searching for peers.

Later, when you get the full torrent metadata (parsed via [parse-torrent](https://github.com/feross/parse-torrent)), call this method again to ensure more accurate tracker stats
(because we now know the torrent length).

#### `discovery.stop()`

Destroy and cleanup the DHT and tracker instances.

### events

#### `discovery.on('peer', function (addr) {})`

Emitted whenever a new peer is discovered. `addr` is a string in the form
`12:34:56:78:4000`.

#### `discovery.on('dhtAnnounce', function () {}`

Emitted whenever an `announce` message has been sent to the DHT.

#### `discovery.on('warning', function (err) {})`

Emitted when there is a non-fatal DHT or tracker error, like an inaccessible tracker
server. Useful for logging. This is non-fatal.

#### `discovery.on('error', function (err) {})`

Emitted when there is a fatal, unrecoverable DHT or tracker error.

### license

MIT. Copyright (c) [Feross Aboukhadijeh](http://feross.org).

