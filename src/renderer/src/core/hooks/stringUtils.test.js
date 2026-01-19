import { describe, it, expect } from 'vitest'
import toCapitalized from './stringUtils'

describe('stringUtils', () => {
  describe('toCapitalized', () => {
    it('capitalizes first letter of a string', () => {
      expect(toCapitalized('hello')).toBe('Hello')
      expect(toCapitalized('world')).toBe('World')
    })

    it('handles already capitalized strings', () => {
      expect(toCapitalized('Hello')).toBe('Hello')
      expect(toCapitalized('WORLD')).toBe('WORLD')
    })

    it('handles empty strings', () => {
      expect(toCapitalized('')).toBe('')
    })

    it('handles single character', () => {
      expect(toCapitalized('a')).toBe('A')
      expect(toCapitalized('A')).toBe('A')
    })

    it('handles numbers by converting to string', () => {
      expect(toCapitalized(123)).toBe('123')
      expect(toCapitalized(0)).toBe('0')
    })

    it('handles special characters', () => {
      expect(toCapitalized('!hello')).toBe('!hello')
      expect(toCapitalized(' hello')).toBe(' hello')
    })
  })
})
