/**
 * The top of a site whose document scrolls, in an app installed on a phone, where the root layout lets the page
 * draw under the status bar. It takes the height of the top safe area and stays there in the site's background,
 * so neither the site's first bar nor what scrolls past it lies under the clock and the camera.
 */
export default function StatusBarStrip() {
    return <div aria-hidden className="sticky top-0 z-4 shrink-0 h-[env(safe-area-inset-top)] bg-base-100" />
}
