/**
 * A block that stands where content is on its way. It has no size of its own: `className` gives it
 * the size of what it stands for, since a fallback smaller than its section moves the page when
 * the section arrives. `h-lh` is one line of the text size it is given. Its colour is the text
 * colour of the surface it stands on, faded, so it follows any surface.
 */
export default function Skeleton({ className }: { className: string }) {
    return (
        <div aria-hidden className={`
            rounded-inner bg-current/10 animate-pulse
            ${className}
        `} />
    )
}
