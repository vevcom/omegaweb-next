export const navIconClassName = [
    'relative w-full h-12 shrink-0 flex items-center justify-start px-3 rounded-inner text-text bg-transparent no-underline',
    'transition-[background,color] duration-300 ease-[ease] hover:bg-accent-blue hover:text-text-inv hover:no-underline',
].join(' ')

export const navIconIconClassName = 'w-4! h-4! shrink-0 ml-1'

export const navIconLabelClassName = [
    'whitespace-nowrap overflow-hidden opacity-0 max-w-0 ml-0',
    'transition-[opacity,max-width,margin-left] duration-300 ease-[ease]',
    'group-data-[expanded=true]/sidebar:opacity-100 group-data-[expanded=true]/sidebar:max-w-[160px]',
    'group-data-[expanded=true]/sidebar:ml-2',
].join(' ')
