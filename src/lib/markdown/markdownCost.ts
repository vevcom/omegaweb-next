/**
 * What a markdown may hold before it is parsed, counted in one pass over the text, where the parser's time grows
 * faster than the markdown: in the lines of one block and in how deep one line nests. The limits lower what a
 * render can cost and do not bound it, since markdown within them can still take more than a minute.
 */
export type MarkdownLimits = {
    /** Characters in all. */
    length: number,
    /** Lines in all. */
    lines: number,
    /** Lines of one block: lines with no blank line between them, such as a paragraph or a tight list. */
    linesInBlock: number,
    /**
     * How deep a line with a marker of a list or a quote nests: its markers, such as `> - > a`, and one for every
     * two columns of whitespace among them, since a list nests by indentation. A line with no marker opens
     * nothing, so indented code is not counted.
     */
    depth: number,
    /** Markers of lists and quotes before the text of one line. */
    markersOnLine: number,
}

// A row of three or more `-`, `*` or `_`, which may have spaces between them, is a rule and not a list.
const thematicBreak = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/

// A fence of backticks has no backtick after it. A fence closes on one of the same kind at least as long.
const openingFence = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/
const closingFence = /^ {0,3}(`{3,}|~{3,})[ \t]*$/

/** Why a markdown costs more to render than the limits let it, said to whoever wrote it, or null when it does not. */
export function costlyMarkdownIssue(markdown: string, limits: MarkdownLimits): string | null {
    if (markdown.length > limits.length) {
        return `Teksten er for lang: den kan ha høyst ${limits.length} tegn. Del den opp i flere avsnitt.`
    }
    const lines = markdown.split(/\r\n|\r|\n/)
    if (lines.length > limits.lines) {
        return `Teksten har for mange linjer: den kan ha høyst ${limits.lines}. Del den opp i flere avsnitt.`
    }
    let linesInBlock = 0
    let openFence: string | undefined
    for (const line of lines) {
        if (/^[ \t]*$/.test(line)) {
            linesInBlock = 0
            continue
        }
        if (++linesInBlock > limits.linesInBlock) {
            return `Et avsnitt, en liste eller et sitat har for mange linjer: høyst ${limits.linesInBlock}. `
                + 'Del det opp i flere avsnitt, eller avslutt listen og begynn en ny.'
        }
        // What a fenced code block holds is its text, and opens no list or quote.
        if (openFence) {
            const closing = closingFence.exec(line)?.[1]
            if (closing?.startsWith(openFence)) openFence = undefined
            continue
        }
        openFence = openingFence.exec(line)?.[1]
        if (openFence || thematicBreak.test(line)) continue
        const { indentation, markers } = containerPrefix(line)
        if (markers && (markers + Math.floor(indentation / 2) > limits.depth || markers > limits.markersOnLine)) {
            return 'En liste eller et sitat ligger for dypt inne i andre lister og sitater. '
                + 'Gjør det grunnere, for eksempel ved å flytte det ut ett nivå.'
        }
    }
    return null
}

/** The whitespace and the markers of lists and quotes a line starts with, which say how deep it nests. */
function containerPrefix(line: string) {
    let indentation = 0
    let markers = 0
    let position = 0
    while (position < line.length) {
        const character = line[position]
        if (character === ' ') {
            indentation++
            position++
        } else if (character === '\t') {
            indentation += 4 - indentation % 4
            position++
        } else if (character === '>') {
            markers++
            position++
        } else {
            const marker = /^(?:[-*+]|\d{1,9}[.)])(?=[ \t]|$)/.exec(line.slice(position, position + 11))
            if (!marker) break
            markers++
            position += marker[0].length
        }
    }
    return { indentation, markers }
}
