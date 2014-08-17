var hat = require('hat')
var portfinder = require('portfinder')
var Swarm = require('../')
var test = require('tape')

var infoHash = 'd2474e86c95b19b8bcfdb92bc12c9d44667cfa36'
var peerId1 = '-WW0001-' + hat(48)
var peerId2 = '-WW0001-' + hat(48)

test('reconnect when peer disconnects', function (t) {
  t.plan(10)

  var swarm1 = new Swarm(infoHash, peerId1)
  portfinder.getPort(function (err, port) {
    if (err) throw err
    swarm1.listen(port)

    swarm1.on('listening', function () {
      var swarm2 = new Swarm(infoHash, peerId2)

      var time1 = 0
      swarm1.on('wire', function (wire) {
        if (time1 === 0) {
          t.ok(wire, 'Peer joined via listening port')
          t.equal(swarm1.wires.length, 1)

          // at some point in future, end wire and prevent reconnect by
          // using `destroy`
          setTimeout(function () {
            wire.destroy()
          }, 100)

        } else if (time1 === 1) {
          t.ok(wire, 'Remote peer reconnected')
          t.equal(swarm1.wires.length, 1)

        } else {
          throw new Error('too many wire events (1)')
        }
        time1 += 1
      })

      var time2 = 0
      swarm2.on('wire', function (wire) {
        if (time2 === 0) {
          t.ok(wire, 'Joined swarm, got wire')
          t.equal(swarm2.wires.length, 1)

          wire.on('end', function () {
            t.pass('Wire ended by remote peer')
            t.equal(swarm1.wires.length, 0)
          })

        } else if (time2 === 1) {
          t.ok(wire, 'Reconnected to remote peer')
          t.equal(swarm2.wires.length, 1)

          swarm1.destroy()
          swarm2.destroy()

        } else {
          throw new Error('too many wire events (2)')
        }
        time2 += 1
      })

      swarm2.add('127.0.0.1:' + swarm1.port)
    })
  })
})

