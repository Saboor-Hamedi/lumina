import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const setupGoogleAuth = require('../../../../server/app/configure/authentication/google.js')
const passport = require('passport')
const { OAuth2Strategy } = require('passport-google-oauth')

describe('google authentication config', () => {
  let app
  let db
  let useSpy
  let authenticateSpy

  const setupEnv = (overrides = {}) => ({
    GOOGLE: {
      clientID: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackURL: 'http://localhost/auth/google/callback',
      ...overrides
    }
  })

  beforeEach(() => {
    useSpy = vi.spyOn(passport, 'use').mockImplementation(() => {})
    // authenticate returns express middleware; call next() to reach the
    // success handler that redirects to '/'
    authenticateSpy = vi
      .spyOn(passport, 'authenticate')
      .mockReturnValue((req, res, next) => next())

    app = {
      setValue: vi.fn(),
      getValue: vi.fn(() => setupEnv()),
      get: vi.fn()
    }

    db = {
      model: vi.fn(() => ({
        findOne: vi.fn(),
        create: vi.fn()
      }))
    }
  })

  afterEach(() => {
    useSpy.mockRestore()
    authenticateSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('registers a GoogleStrategy with passport', () => {
    setupGoogleAuth(app, db)

    expect(useSpy).toHaveBeenCalledTimes(1)
    expect(useSpy.mock.calls[0][0]).toBeInstanceOf(OAuth2Strategy)
  })

  it('passes Google OAuth credentials from the environment', () => {
    setupGoogleAuth(app, db)

    const strategy = useSpy.mock.calls[0][0]
    expect(strategy).toBeInstanceOf(OAuth2Strategy)
    expect(strategy._oauth2._clientId).toBe('test-client-id')
    expect(strategy._oauth2._clientSecret).toBe('test-client-secret')
    expect(strategy._callbackURL).toBe('http://localhost/auth/google/callback')
  })

  it('sets up the /auth/google route with profile and email scopes', () => {
    setupGoogleAuth(app, db)

    const route = app.get.mock.calls.find(([path]) => path === '/auth/google')
    expect(route).toBeDefined()
    expect(authenticateSpy).toHaveBeenCalledWith('google', {
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    })
  })

  it('sets up the /auth/google/callback route with failure redirect', () => {
    setupGoogleAuth(app, db)

    const route = app.get.mock.calls.find(([path]) => path === '/auth/google/callback')
    expect(route).toBeDefined()
    expect(authenticateSpy).toHaveBeenCalledWith('google', { failureRedirect: '/login' })
  })

  it('callback route redirects to home on success', () => {
    setupGoogleAuth(app, db)

    // Route is: app.get(path, passport.authenticate(...), successHandler)
    const route = app.get.mock.calls.find(([path]) => path === '/auth/google/callback')
    const successHandler = route[2] // redirects to '/'

    const res = { redirect: vi.fn() }
    successHandler({}, res)
    expect(res.redirect).toHaveBeenCalledWith('/')
  })
})
