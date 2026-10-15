// Shared by the server page and the client PrioritizedCommittees, so it lives outside both.
// Short enough that the whole set of committees can be scanned without a viewport-tall card each. On a narrow
// screen the buttons wrap onto several lines, so the card grows to fit them rather than clipping them off.
export const committeeCardClassName = [
    'bg-surface-raised p-2 h-[calc(26*var(--gap))] flex items-stretch gap-4 rounded-inner overflow-hidden',
    'max-mobile:h-auto max-mobile:min-h-[calc(26*var(--gap))]',
].join(' ')

export const committeeCardBodyClassName = 'flex-[1_1_auto] min-w-0 h-full'
