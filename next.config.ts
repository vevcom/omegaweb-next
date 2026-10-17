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
            // The body is read before any login check, so this bounds what an anonymous request can make
            // the server hold. The largest requests are an image batch (maxImageBatchSizeMb in the image
            // subservice, 60mb) and a new ombul (a 10mb pdf and a cover image of up to 50mb), plus the form
            // around them.
            bodySizeLimit: '70mb',
        },
    },
    turbopack: {},
}

export default nextConfig
