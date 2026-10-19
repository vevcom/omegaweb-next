import {
    createPushSubscriptionAction,
    destroyPushSubscriptionAction,
} from '@/services/notifications/pushSubscription/actions'

export type PushSupport = 'supported' | 'needsHomeScreen' | 'unsupported'

/** iPhones and iPads only offer push to sites that are added to the home screen. */
export function readPushSupport(): PushSupport {
    if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) {
        return 'supported'
    }
    const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
    const installed = window.matchMedia('(display-mode: standalone)').matches
    return appleMobile && !installed ? 'needsHomeScreen' : 'unsupported'
}

export async function readBrowserPushSubscription() {
    if (readPushSupport() !== 'supported') return null
    const registration = await navigator.serviceWorker.getRegistration()
    return registration ? await registration.pushManager.getSubscription() : null
}

export function usesServerKey(subscription: PushSubscription, vapidPublicKey: string) {
    const key = subscription.options.applicationServerKey
    return key !== null && base64Url(new Uint8Array(key)) === vapidPublicKey
}

export function savePushSubscription(userId: number, subscription: PushSubscription) {
    const { keys } = subscription.toJSON()
    return createPushSubscriptionAction({ params: { userId } }, {
        data: {
            pushServiceUrl: subscription.endpoint,
            publicKey: keys?.p256dh ?? '',
            authSecret: keys?.auth ?? '',
        },
    })
}

/** A subscription the server refuses is removed from the browser again. */
export async function subscribeBrowser(userId: number, vapidPublicKey: string) {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: fromBase64Url(vapidPublicKey),
    })
    const result = await savePushSubscription(userId, subscription)
    if (!result.success) {
        await subscription.unsubscribe()
    }
    return result
}

/** Signing out calls this first, while the session can still remove the subscription on the server. */
export async function removeBrowserPushSubscription() {
    const subscription = await readBrowserPushSubscription()
    if (!subscription) return

    await destroyPushSubscriptionAction({ params: { pushServiceUrl: subscription.endpoint } })
    await subscription.unsubscribe()
}

function fromBase64Url(text: string) {
    const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
    return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), character =>
        character.charCodeAt(0)
    )
}

function base64Url(bytes: Uint8Array) {
    return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
