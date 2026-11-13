import { staticSecurityHeaders } from './src/lib/securityHeaders'
import { readDomainConfig } from './src/lib/sites/domainConfigFile'
import path from 'path'
import type { NextConfig } from 'next'

/**
 * The most a request may carry. The body is read before any login check, so this bounds what an
 * anonymous request can make the server hold. The largest requests are an image batch
 * (maxImageBatchSizeMb in the image subservice, 60mb) and a new ombul (a pdf of up to 50mb and a cover image of
 * up to 50mb), plus the form around them.
 */
const maxRequestBodySize = '110mb'

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
            bodySizeLimit: maxRequestBodySize,
        },
        // The proxy runs in front of every request and Next keeps the body in memory for it, cut off at
        // 10mb by default. A cut off upload reaches the server action as a broken form ("Unexpected end
        // of form"), so the proxy has to let through all that a server action accepts.
        proxyClientMaxBodySize: maxRequestBodySize,
    },
    turbopack: {},
    // The dev server refuses requests from hosts other than its own, so it takes the hosts of
    // sites.json, read once at start like the app's own. Production has no such check to keep in step.
    allowedDevOrigins: readDomainConfig().allHostNames(),
}

export default nextConfig
