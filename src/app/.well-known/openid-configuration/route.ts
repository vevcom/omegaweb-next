import { providerRoute } from '@/app/api/oidc/provider'
import { discoveryDocument } from '@/services/auth/oidc/discovery'
import { NextResponse } from 'next/server'

export const GET = providerRoute(() => NextResponse.json(discoveryDocument(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
}))
