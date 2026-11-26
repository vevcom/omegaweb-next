import { authOptionsOn } from '@/auth/nextAuth/authOptionsOn'
import NextAuth from 'next-auth'
import type { NextRequest } from 'next/server'

type RouteContext = { params: Promise<{ nextauth: string[] }> }

function handler(request: NextRequest, context: RouteContext) {
    // next-auth v4 types the handler as any
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return NextAuth(request, context, authOptionsOn(request))
}

export { handler as GET, handler as POST }
