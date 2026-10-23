export const navIconClassName = `
    group/navicon relative w-full h-12 shrink-0 flex items-center justify-start px-2 bg-transparent no-underline
    hover:no-underline
`

const activeColor = 'group-hover/navicon:text-accent-blue group-aria-[current=page]/navicon:text-accent-blue'

export const navIconIconClassName = `
    size-5! shrink-0 ml-0.5 text-text transition-colors duration-300 ease-[ease]
    [&_path]:text-inherit
    ${activeColor}
`

// Matches the duration of the sidebar's width transition in the root layout.
export const navIconLabelClassName = `
    whitespace-nowrap overflow-hidden ml-2 text-text opacity-0 transition-[opacity,color] duration-300 ease-[ease]
    group-data-[expanded=true]/sidebar:opacity-100
    ${activeColor}
`

export const dividerClassName = 'shrink-0 m-0 border-0 border-t border-surface-hover'
