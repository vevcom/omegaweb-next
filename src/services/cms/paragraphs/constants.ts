import type { MarkdownLimits } from '@/lib/markdown/markdownCost'

/**
 * What the markdown of a paragraph may hold. It lowers what a save can cost but does not bound it, which needs a time
 * budget, and lets a long honest paragraph through, such as 300 paragraphs of prose or lists nested ten deep.
 */
export const paragraphMarkdownLimits: MarkdownLimits = {
    length: 100_000,
    lines: 1_500,
    linesInBlock: 500,
    depth: 15,
    markersOnLine: 4,
}

/**
 * The most html a paragraph is rendered to. Prose makes about 1.3 times its markdown, and a long list of
 * one-letter items 3.3 times, so honest markdown stays far below it. What goes over it is a markdown made to grow,
 * such as one link definition used many times.
 */
export const maxContentHtmlLength = 1_000_000
