'use strict'

// Shared state so tests can inspect/control the passport mock
const state = {
  registeredStrategies: [],
  authenticate: (...args) => undefined
}

const passportMock = {
  use: (strategy) => {
    state.registeredStrategies.push(strategy)
  },
  authenticate: (...args) => state.authenticate(...args),
  serializeUser: (fn) => {
    state.serializeUser = fn
  },
  deserializeUser: (fn) => {
    state.deserializeUser = fn
  },
  initialize: () => (req, res, next) => next(),
  session: () => (req, res, next) => next(),
  _state: state
}

module.exports = passportMock
