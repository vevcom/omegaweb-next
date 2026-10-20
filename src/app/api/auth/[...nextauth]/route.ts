import { authOptions } from '@/auth/nextAuth/authOptions'
import NextAuth from 'next-auth'

// next-auth v4 types the handler as any
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
