export const navIconClassName = 'group/navicon relative w-full h-12 shrink-0 flex items-center justify-start px-3 bg-transparent no-underline hover:no-underline'

const activeColor = 'group-hover/navicon:text-accent-blue group-aria-[current=page]/navicon:text-accent-blue'

export const navIconIconClassName = [
    'size-4! shrink-0 ml-1 text-text transition-colors duration-300 ease-[ease] [&_path]:text-inherit',
    activeColor,
].join(' ')

export const navIconLabelClassName = [
    'whitespace-nowrap overflow-hidden opacity-0 max-w-0 ml-0 text-text transition-[opacity,max-width,margin-left,color] duration-300 ease-[ease] group-data-[expanded=true]/sidebar:opacity-100 group-data-[expanded=true]/sidebar:max-w-[160px] group-data-[expanded=true]/sidebar:ml-2',
    activeColor,
].join(' ')

export const dividerClassName = 'shrink-0 m-0 border-0 border-t border-surface-hover'
