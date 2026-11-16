import { describe, expect, it } from 'vitest'
import { readGoogleConfig, readSupabaseConfig } from './config'

function jwtWithRole(role: string): string {
  const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256' })}.${encode({ role })}.signatur`
}

describe('readSupabaseConfig', () => {
  it('meldet «missing», wenn nichts eingetragen ist', () => {
    expect(readSupabaseConfig({})).toEqual({ kind: 'missing' })
    expect(
      readSupabaseConfig({ MAIN_VITE_SUPABASE_URL: '  ', MAIN_VITE_SUPABASE_KEY: '' })
    ).toEqual({ kind: 'missing' })
  })

  it('nimmt URL und Publishable Key an', () => {
    expect(
      readSupabaseConfig({
        MAIN_VITE_SUPABASE_URL: ' https://abc.supabase.co/ ',
        MAIN_VITE_SUPABASE_KEY: 'sb_publishable_123'
      })
    ).toEqual({
      kind: 'configured',
      config: { url: 'https://abc.supabase.co', key: 'sb_publishable_123' }
    })
  })

  it('nimmt einen alten anon Key (JWT) an', () => {
    const result = readSupabaseConfig({
      MAIN_VITE_SUPABASE_URL: 'https://abc.supabase.co',
      MAIN_VITE_SUPABASE_KEY: jwtWithRole('anon')
    })
    expect(result.kind).toBe('configured')
  })

  it('meldet, wenn nur einer der beiden Werte fehlt', () => {
    expect(readSupabaseConfig({ MAIN_VITE_SUPABASE_URL: 'https://abc.supabase.co' })).toMatchObject(
      { kind: 'invalid' }
    )
    expect(readSupabaseConfig({ MAIN_VITE_SUPABASE_KEY: 'sb_publishable_123' })).toMatchObject({
      kind: 'invalid'
    })
  })

  it('lehnt eine ungültige oder unverschlüsselte URL ab', () => {
    expect(
      readSupabaseConfig({ MAIN_VITE_SUPABASE_URL: 'kein-link', MAIN_VITE_SUPABASE_KEY: 'x' })
    ).toMatchObject({ kind: 'invalid' })
    expect(
      readSupabaseConfig({
        MAIN_VITE_SUPABASE_URL: 'http://abc.supabase.co',
        MAIN_VITE_SUPABASE_KEY: 'x'
      })
    ).toMatchObject({ kind: 'invalid' })
  })

  it('erlaubt http für ein lokales Supabase', () => {
    expect(
      readSupabaseConfig({
        MAIN_VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        MAIN_VITE_SUPABASE_KEY: 'sb_publishable_123'
      }).kind
    ).toBe('configured')
  })

  it('lehnt geheime Schlüssel ab', () => {
    expect(
      readSupabaseConfig({
        MAIN_VITE_SUPABASE_URL: 'https://abc.supabase.co',
        MAIN_VITE_SUPABASE_KEY: 'sb_secret_123'
      })
    ).toMatchObject({ kind: 'invalid' })
    expect(
      readSupabaseConfig({
        MAIN_VITE_SUPABASE_URL: 'https://abc.supabase.co',
        MAIN_VITE_SUPABASE_KEY: jwtWithRole('service_role')
      })
    ).toMatchObject({ kind: 'invalid' })
  })
})

describe('readGoogleConfig', () => {
  const id = '123-abc.apps.googleusercontent.com'

  it('meldet «missing», wenn nichts eingetragen ist', () => {
    expect(readGoogleConfig({})).toEqual({ kind: 'missing' })
  })

  it('nimmt Client-ID und Secret an', () => {
    expect(
      readGoogleConfig({
        MAIN_VITE_GOOGLE_CLIENT_ID: ` ${id} `,
        MAIN_VITE_GOOGLE_CLIENT_SECRET: 's'
      })
    ).toEqual({ kind: 'configured', config: { clientId: id, clientSecret: 's' } })
  })

  it('meldet fehlende oder falsche Werte', () => {
    expect(readGoogleConfig({ MAIN_VITE_GOOGLE_CLIENT_ID: id })).toMatchObject({ kind: 'invalid' })
    expect(readGoogleConfig({ MAIN_VITE_GOOGLE_CLIENT_SECRET: 's' })).toMatchObject({
      kind: 'invalid'
    })
    expect(
      readGoogleConfig({
        MAIN_VITE_GOOGLE_CLIENT_ID: 'falsch',
        MAIN_VITE_GOOGLE_CLIENT_SECRET: 's'
      })
    ).toMatchObject({ kind: 'invalid' })
  })
})
