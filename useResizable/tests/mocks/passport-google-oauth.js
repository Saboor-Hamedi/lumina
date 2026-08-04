'use strict'

const state = {
  strategies: [],
  instances: []
}

class OAuth2Strategy {
  constructor(credentials, verifyCallback) {
    this.credentials = credentials
    this.verifyCallback = verifyCallback
    this.name = 'google'
    state.strategies.push({ credentials, verifyCallback })
    state.instances.push(this)
  }
}

module.exports = {
  OAuth2Strategy,
  _state: state
}
