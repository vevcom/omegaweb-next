export const navIconClassName = `
    group/navicon relative w-full h-12 shrink-0 flex items-center justify-start px-2 bg-transparent no-underline
    hover:no-underline
`

const activeColor = 'group-hover/navicon:text-primary group-aria-[current=page]/navicon:text-primary'

export const navIconIconClassName = `
    size-5! shrink-0 ml-0.5 text-base-content transition-colors duration-300 ease-[ease]
    ${activeColor}
`

// Matches the duration of the sidebar's width transition in the root layout.
export const navIconLabelClassName = `
    whitespace-nowrap overflow-hidden ml-2 text-base-content opacity-0 transition-[opacity,color] duration-300 ease-[ease]
    group-data-[expanded=true]/sidebar:opacity-100
    ${activeColor}
`

export const dividerClassName = 'shrink-0 m-0 border-0 border-t border-base-300'
