import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockUse } = vi.hoisted(() => ({ mockUse: vi.fn() }))
vi.mock('passport', () => ({ use: (...a) => mockUse(...a) }))
vi.mock('passport-google-oauth', () => ({ OAuth2Strategy: class {} }))
import setupGoogleAuth from '../../../../server/app/configure/authentication/google.js'

describe('probe', () => {
  beforeEach(() => mockUse.mockReset())
  it('checks require interception', () => {
    setupGoogleAuth(
      {
        getValue: () => ({ GOOGLE: { clientID: 'a', clientSecret: 'b', callbackURL: 'c' } }),
        get: () => {}
      },
      { model: () => ({ findOne: () => Promise.resolve(null), create: () => Promise.resolve({}) }) }
    )
    console.log('mockUse calls:', mockUse.mock.calls.length)
    expect(typeof setupGoogleAuth).toBe('function')
  })
})
