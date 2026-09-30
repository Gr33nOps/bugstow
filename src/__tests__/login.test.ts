import { describe, it, expect } from 'vitest'
import { displayLogin, isValidUsername, loginToEmail } from '../lib/login'

describe('usernames for people who join with an invite link', () => {
  it('turns a username into the login the server stores, and back', () => {
    expect(loginToEmail('  Dana ')).toBe('dana@bugstow.invalid')
    expect(displayLogin('dana@bugstow.invalid')).toBe('dana')
  })

  it('leaves real emails of older accounts alone', () => {
    expect(loginToEmail('Owner@Example.com')).toBe('owner@example.com')
    expect(displayLogin('owner@example.com')).toBe('owner@example.com')
    expect(displayLogin(null)).toBe('')
  })

  it('accepts simple usernames only', () => {
    for (const ok of ['dana', 'z.m', 'team-lead_2']) expect(isValidUsername(ok)).toBe(true)
    for (const bad of ['a', '', 'has space', '-dash-first', 'x'.repeat(40), 'emoji🙂']) expect(isValidUsername(bad)).toBe(false)
  })
})
