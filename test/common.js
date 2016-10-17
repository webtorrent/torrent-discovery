exports.wrapTest = function (test, str, func) {
  test('ipv4 ' + str, function (t) {
    func(t, false)
    if (t._plan) {
      t.plan(t._plan + 1)
    }

    t.test('ipv6 ' + str, function (newT) {
      func(newT, true)
    })
  })
}
