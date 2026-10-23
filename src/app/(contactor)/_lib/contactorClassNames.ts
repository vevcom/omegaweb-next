export const bandClassName = 'w-screen ml-[calc(50%-50vw)]'

export const innerClassName = 'w-full max-w-(--contactor-max-width) mx-auto px-(--contactor-page-padding)'

export const badgeClassName = 'block mb-6 text-s font-semibold tracking-[0.2em] uppercase'

export const sectionHeadingClassName = 'text-xxl leading-[1.15]'

export const buttonClassName = `
    inline-flex items-center gap-2 py-4 px-8 rounded-[calc(var(--rounding)/2)] text-m font-semibold leading-none
    transition-colors duration-300
    hover:no-underline
    [&_svg]:size-[0.9em] [&_svg]:text-inherit
`

// A CmsLink sizes its box for a small inline link and positions the anchor absolutely under its
// editor. These make the anchor the box, as a button or as plain text; colours come with the use.
export const cmsLinkButtonClassName = `
    inline-flex! h-auto! min-w-0!
    [&>a]:static [&>a]:m-0 [&>a]:inline-flex [&>a]:items-center [&>a]:gap-2 [&>a]:py-4 [&>a]:px-8
    [&>a]:rounded-[calc(var(--rounding)/2)] [&>a]:text-m [&>a]:font-semibold [&>a]:leading-none [&>a]:transition-colors
    [&>a]:duration-300
    [&>a:hover]:no-underline
    [&>a_svg]:size-[0.9em] [&>a_svg]:text-inherit
`

export const cmsLinkTextClassName = `
    inline-flex! h-auto! min-w-0!
    [&>a]:static [&>a]:m-0 [&>a]:p-0 [&>a]:bg-transparent [&>a]:transition-colors [&>a]:duration-300
    [&>a:hover]:bg-transparent
`

export const navyCmsLinkClassName = `
    [&>a]:bg-contactor-navy [&>a]:text-white
    [&>a:hover]:bg-contactor-navy-dark [&>a:hover]:text-white
`
