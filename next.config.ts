import { staticSecurityHeaders } from './src/lib/securityHeaders'
import { readDomainConfig } from './src/lib/sites/domainConfigFile'
import path from 'path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    output: 'standalone',
    poweredByHeader: false,
    // The content security policy is set per request in src/proxy.ts, since it carries a nonce.
    headers: () => [{ source: '/:path*', headers: staticSecurityHeaders }],
    sassOptions: {
        includePaths: [path.join(__dirname, 'src/styles')],
    },
    // Next types the webpack config as any
    webpack: config => {
        // fix error with react-pdf use of canvas -if using webpack
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        config.resolve.alias.canvas = false
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
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
    // The dev server refuses requests from hosts other than its own, so it takes the hosts of
    // sites.json, read once at start like the app's own. Production has no such check to keep in step.
    allowedDevOrigins: readDomainConfig().allHostNames(),
}

export default nextConfig
