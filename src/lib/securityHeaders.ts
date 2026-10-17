/**
 * The security headers of the site: the content security policy and the browser features pages may
 * use. To let the pages use a new third party, add it to `thirdParties` below; to let them use a new
 * browser feature, add it to `browserFeatures`. The headers are built from those two.
 *
 * The content security policy carries a fresh nonce per request, so the proxy (src/proxy.ts) sets it
 * on every page. The other headers are the same for every response, so next.config.ts sets them.
 *
 * Imported by next.config.ts, so this file uses no path aliases.
 */

/**
 * What the pages are allowed to use a third party for. Every field is a list of origins (scheme and
 * host, `https://*.example.com` wildcards allowed). Leave out what the third party is not used for.
 */
type ThirdParty = {
    /** What the site uses it for, for whoever maintains this list. */
    usedFor: string
    /** Origins its scripts are loaded from. Only add when the pages load a script from it. */
    scripts?: string[]
    /** Origins the pages embed in iframes. */
    frames?: string[]
    /** Origins the pages load images from. */
    images?: string[]
    /** Origins the pages fetch from (fetch, XHR, websockets). */
    requests?: string[]
    /** Origins the pages load stylesheets from. */
    styles?: string[]
    /** Origins the pages load fonts from. */
    fonts?: string[]
}

/**
 * Every third party the pages load from or embed. Nothing else is allowed: a page that loads from an
 * origin not listed here is blocked by the browser, and the blocked load shows in its console.
 */
const thirdParties = {
    stripe: {
        usedFor: 'Card payments: the Payment Element, its iframes and its API. ' +
            'See https://docs.stripe.com/security/guide#content-security-policy',
        scripts: ['https://js.stripe.com', 'https://*.js.stripe.com'],
        frames: ['https://js.stripe.com', 'https://*.js.stripe.com', 'https://hooks.stripe.com'],
        images: ['https://*.stripe.com'],
        requests: ['https://api.stripe.com'],
    },
    mazeMap: {
        usedFor: 'Embedded campus maps (src/app/_components/MazeMap)',
        frames: ['https://use.mazemap.com'],
    },
    openStreetMap: {
        usedFor: 'Embedded maps of event locations (src/lib/maps/locationMap.ts)',
        frames: ['https://www.openstreetmap.org'],
    },
} satisfies Record<string, ThirdParty>

/**
 * The browser features pages may use (the Permissions-Policy header). A feature not listed here is
 * off. `self` means pages of this site; a quoted origin means iframes from it, such as Stripe's.
 */
const browserFeatures = {
    // The QR scanners for lockers and OmegaId.
    camera: ['self'],
    // Wallets such as Apple Pay in Stripe's Payment Element.
    payment: ['self', '"https://js.stripe.com"'],
    microphone: [],
    geolocation: [],
} satisfies Record<string, string[]>

/**
 * Where the pages' own resources come from, beyond the site itself. These are about how the app is
 * built rather than about any third party, so they rarely change.
 */
const ownSources = {
    // data: for blur placeholders of images, blob: for previews of files chosen for upload.
    images: ['data:', 'blob:'],
    // The icon fonts are inlined by the bundler.
    fonts: ['data:'],
    // The service worker, and the pdf.js worker, which may start from a blob.
    workers: ['blob:'],
}

const SELF = "'self'"

/**
 * The content security policy of a page. Scripts run only when they carry the nonce of the request, or
 * were loaded by one that does ('strict-dynamic'), so an injected script cannot run even if it gets past
 * the html sanitizer. Next.js reads the nonce from this header on the request and puts it on its own
 * scripts, which only works for pages rendered per request - every page is, since the root layout reads
 * the session.
 *
 * Styles stay 'unsafe-inline': React writes style attributes, and a nonce would not cover those.
 */
export function contentSecurityPolicy(nonce: string, { development }: { development: boolean }): string {
    const directives: Record<string, string[]> = {
        'default-src': [SELF],
        // React needs eval in development for its debugging features, never in production.
        'script-src': [
            SELF,
            `'nonce-${nonce}'`,
            "'strict-dynamic'",
            ...originsFor('scripts'),
            ...(development ? ["'unsafe-eval'"] : []),
        ],
        'style-src': [SELF, "'unsafe-inline'", ...originsFor('styles')],
        'img-src': [SELF, ...ownSources.images, ...originsFor('images')],
        'font-src': [SELF, ...ownSources.fonts, ...originsFor('fonts')],
        // ws: for hot reloading in development.
        'connect-src': [SELF, ...originsFor('requests'), ...(development ? ['ws:'] : [])],
        'frame-src': originsFor('frames'),
        'worker-src': [SELF, ...ownSources.workers],
        'manifest-src': [SELF],
        'object-src': ["'none'"],
        'base-uri': [SELF],
        'form-action': [SELF],
        'frame-ancestors': ["'none'"],
    }

    return Object.entries(directives)
        .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
        .join('; ')
}

/**
 * Headers sent with every response, static files and /store included.
 */
export const staticSecurityHeaders = [
    // Browsers ignore this over plain http, so local and CI runs over http are unaffected. No
    // includeSubDomains: other services may live under the same domain.
    { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // For browsers that do not read frame-ancestors in the content security policy.
    { key: 'X-Frame-Options', value: 'DENY' },
    {
        key: 'Permissions-Policy',
        value: Object.entries(browserFeatures)
            .map(([feature, allowed]) => `${feature}=(${allowed.join(' ')})`)
            .join(', '),
    },
]

/** The origins of every third party that is used for the given purpose. */
function originsFor(purpose: Exclude<keyof ThirdParty, 'usedFor'>): string[] {
    return Object.values<ThirdParty>(thirdParties).flatMap(thirdParty => thirdParty[purpose] ?? [])
}
