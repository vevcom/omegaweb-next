import { providerRoute } from '@/app/api/oidc/provider'
import { jwks } from '@/services/auth/oidc/tokens'
import { NextResponse } from 'next/server'

export const GET = providerRoute(() => NextResponse.json(jwks(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
}))
