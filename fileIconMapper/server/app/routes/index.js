'use strict'
var router = require('express').Router()
module.exports = router

router.use('/members', require('./members'))

// Make sure this is after all of
// the registered routes!
router.use(function (req, res, next) {
  var err = new Error('Not found.')
  err.status = 404
  next(err)
})
