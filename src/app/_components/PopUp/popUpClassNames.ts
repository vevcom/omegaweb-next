export const popUpClassNames = {
    popUp: `
        fixed top-0 left-0 z-8 bg-[rgba(0,0,0,0.55)]
        mobile:w-screen mobile:h-screen mobile:backdrop-blur-[2px]
        max-mobile:bottom-0
    `,
    main: `
        flex flex-col w-min max-h-[95svh] p-3 z-9 rounded-round bg-surface-base
        mobile:absolute mobile:top-1/2 mobile:left-1/2 mobile:-translate-x-1/2 mobile:-translate-y-1/2
        mobile:min-w-[calc(320px+1.5rem)]
        max-mobile:w-[100svw] max-mobile:translate-y-[calc(100svh-100%)] max-mobile:rounded-b-none
    `,
    header: 'flex items-center gap-4 mb-4',
    overflow: 'min-h-0 overflow-x-visible overflow-y-auto',
}
