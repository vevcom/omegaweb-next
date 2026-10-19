/**
 * The push services of the browsers we support. The notification worker sends requests to every
 * subscription's push service URL, so a URL on any other host is refused.
 */
export const pushServiceDomains = [
    'fcm.googleapis.com',
    'push.services.mozilla.com',
    'push.apple.com',
    'notify.windows.com',
] as const

export const maxBrowserPushSubscriptionsPerUser = 10
