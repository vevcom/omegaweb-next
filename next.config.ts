import { staticSecurityHeaders } from './src/lib/securityHeaders'
import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    output: 'standalone',
    poweredByHeader: false,
    // The content security policy is set per request in src/proxy.ts, since it carries a nonce.
    headers: async () => [{ source: '/:path*', headers: staticSecurityHeaders }],
    sassOptions: {
        includePaths: [path.join(__dirname, 'src/styles')],
    },
    webpack: (config) => {
        // fix error with react-pdf use of canvas -if using webpack
        config.resolve.alias.canvas = false
        return config
    },
    experimental: {
        serverActions: {
            bodySizeLimit: '1000mb',
        },
    },
    turbopack: {},
}

export default nextConfig
