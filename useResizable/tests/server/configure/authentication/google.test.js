import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockStrategies, mockUse, mockAuthenticate, mockGoogleStrategy } = vi.hoisted(() => {
  const mockStrategies = []
  const mockUse = vi.fn()
  const mockAuthenticate = vi.fn()
  const mockGoogleStrategy = vi.fn(function (credentials, verifyCallback) {
    mockStrategies.push({ credentials, verifyCallback })
    this.name = 'google'
  })
  return { mockStrategies, mockUse, mockAuthenticate, mockGoogleStrategy }
})

vi.mock('passport', () => ({
  use: (...args) => mockUse(...args),
  authenticate: (...args) => mockAuthenticate(...args)
}))

vi.mock('passport-google-oauth', () => ({
  OAuth2Strategy: mockGoogleStrategy
}))

const setupGoogle = async () => {
  const { default: setupGoogleAuth } = await import(
    '../../../../server/app/configure/authentication/google.js'
  )
  return setupGoogleAuth
}

describe('google authentication config', () => {
  let app
  let db

  beforeEach(() => {
    mockStrategies.length = 0
    mockUse.mockReset()
    mockAuthenticate.mockReset()
    mockGoogleStrategy.mockClear()

    app = {
      setValue: vi.fn(),
      getValue: vi.fn(() => ({
        GOOGLE: {
          clientID: 'test-client-id',
          clientSecret: 'test-client-secret',
          callbackURL: 'http://localhost/auth/google/callback'
        }
      })),
      get: vi.fn()
    }

    db = {
      model: vi.fn(() => ({
        findOne: vi.fn(),
        create: vi.fn()
      }))
    }
  })

  it('registers a GoogleStrategy with passport', async () => {
    const setupGoogleAuth = await setupGoogle()
    setupGoogleAuth(app, db)

    expect(mockUse).toHaveBeenCalledTimes(1)
    expect(mockGoogleStrategy).toHaveBeenCalledTimes(1)
    expect(mockUse.mock.calls[0][0]).toBeInstanceOf(mockGoogleStrategy)
  })

  it('passes Google OAuth credentials from the environment', async () => {
    const setupGoogleAuth = await setupGoogle()
    setupGoogleAuth(app, db)

    expect(mockStrategies).toHaveLength(1)
    expect(mockStrategies[0].credentials).toEqual({
      clientID: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackURL: 'http://localhost/auth/google/callback'
    })
  })

  it('sets up the /auth/google route with profile and email scopes', async () => {
    const setupGoogleAuth = await setupGoogle()
    setupGoogleAuth(app, db)

    const route = app.get.mock.calls.find(([path]) => path === '/auth/google')
    expect(route).toBeDefined()
    expect(mockAuthenticate).toHaveBeenCalledWith('google', {
      scope: [
        'https://www.googleapis.com/auth/userinfo.profile',
        'https://www.googleapis.com/auth/userinfo.email'
      ]
    })
  })

  it('sets up the /auth/google/callback route with failure redirect', async () => {
    const setupGoogleAuth = await setupGoogle()
    setupGoogleAuth(app, db)

    const route = app.get.mock.calls.find(([path]) => path === '/auth/google/callback')
    expect(route).toBeDefined()
    expect(mockAuthenticate).toHaveBeenCalledWith('google', { failureRedirect: '/login' })
  })

  it('callback route redirects to home on success', async () => {
    const setupGoogleAuth = await setupGoogle()
    setupGoogleAuth(app, db)

    const callbackRoute = app.get.mock.calls.find(
      ([path]) => path === '/auth/google/callback'
    )[1]
    const res = { redirect: vi.fn() }
    callbackRoute({}, res)
    expect(res.redirect).toHaveBeenCalledWith('/')
  })

  describe('verifyCallback', () => {
    it('logs in an existing user found by google_id', async () => {
      const existingUser = { id: 1, google_id: 'google-1' }
      const findOne = vi.fn().mockResolvedValue(existingUser)
      const create = vi.fn()
      db.model = vi.fn(() => ({ findOne, create }))

      const setupGoogleAuth = await setupGoogle()
      setupGoogleAuth(app, db)

      const done = vi.fn()
      await mockStrategies[0].verifyCallback('token', 'refresh', { id: 'google-1' }, done)

      expect(findOne).toHaveBeenCalledWith({ where: { google_id: 'google-1' } })
      expect(create).not.toHaveBeenCalled()
      expect(done).toHaveBeenCalledWith(null, existingUser)
    })

    it('creates a new user when none matches', async () => {
      const newUser = { id: 2, google_id: 'google-2' }
      const findOne = vi.fn().mockResolvedValue(null)
      const create = vi.fn().mockResolvedValue(newUser)
      db.model = vi.fn(() => ({ findOne, create }))

      const setupGoogleAuth = await setupGoogle()
      setupGoogleAuth(app, db)

      const done = vi.fn()
      await mockStrategies[0].verifyCallback('token', 'refresh', { id: 'google-2' }, done)

      expect(create).toHaveBeenCalledWith({ google_id: 'google-2' })
      expect(done).toHaveBeenCalledWith(null, newUser)
    })

    it('passes database errors to done', async () => {
      const dbError = new Error('DB down')
      const findOne = vi.fn().mockRejectedValue(dbError)
      db.model = vi.fn(() => ({ findOne, create: vi.fn() }))

      const setupGoogleAuth = await setupGoogle()
      setupGoogleAuth(app, db)

      const done = vi.fn()
      await mockStrategies[0].verifyCallback('token', 'refresh', { id: 'google-3' }, done)

      expect(done).toHaveBeenCalledWith(dbError)
    })
  })
})
