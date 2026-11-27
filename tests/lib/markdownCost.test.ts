import { costlyMarkdownIssue } from '@/lib/markdown/markdownCost'
import { paragraphMarkdownLimits as limits } from '@/services/cms/paragraphs/constants'
import { describe, expect, test } from '@jest/globals'

const lines = (count: number, line: (index: number) => string) => Array.from({ length: count }, (_, index) => line(index))
// Blank lines between, so the lines are many blocks of one line each.
const separateLines = (count: number) => lines(count, index => (index % 2 ? '' : 'a')).join('\n')
const oneBlock = (count: number) => lines(count, () => 'a').join('\n')

// Each limit of a paragraph's markdown lets through what is at its figure and refuses what is one over it.
describe('the limits of a paragraph\'s markdown', () => {
    test.each<[string, string, string]>([
        ['length', 'a'.repeat(limits.length), 'a'.repeat(limits.length + 1)],
        ['lines', separateLines(limits.lines), separateLines(limits.lines + 1)],
        ['lines in one block', oneBlock(limits.linesInBlock), oneBlock(limits.linesInBlock + 1)],
        ['depth by indentation', `${' '.repeat(2 * (limits.depth - 1))}- a`, `${' '.repeat(2 * limits.depth)}- a`],
        ['markers on one line', `${'>'.repeat(limits.markersOnLine)} a`, `${'>'.repeat(limits.markersOnLine + 1)} a`],
    ])('%s: at the figure passes, over it is refused', (_name, atTheFigure, overIt) => {
        expect(costlyMarkdownIssue(atTheFigure, limits)).toBeNull()
        expect(costlyMarkdownIssue(overIt, limits)).toEqual(expect.any(String))
    })

    test('a rule of dashes with spaces between is not a list, however many', () => {
        expect(costlyMarkdownIssue(`tekst\n\n${'- '.repeat(40)}-\n\ntekst`, limits)).toBeNull()
    })

    test('a line with no marker of a list or a quote opens nothing, however far it is indented', () => {
        expect(costlyMarkdownIssue(`kode:\n\n${' '.repeat(4 * limits.depth)}x = 1`, limits)).toBeNull()
    })

    test('what a fenced code block holds opens nothing, and the fence closes on its own kind', () => {
        const quoted = `${'> '.repeat(limits.markersOnLine + 1)}svar`
        expect(costlyMarkdownIssue(`\`\`\`\n${quoted}\n\`\`\``, limits)).toBeNull()
        expect(costlyMarkdownIssue(`~~~~\n\`\`\`\n${quoted}\n~~~~`, limits)).toBeNull()
        expect(costlyMarkdownIssue(`\`\`\`\nkode\n\`\`\`\n\n${quoted}`, limits)).toEqual(expect.any(String))
        expect(costlyMarkdownIssue(`\`\`\` a\`b\n${quoted}`, limits)).toEqual(expect.any(String))
    })

    test('a tab indents to the next fourth column', () => {
        expect(costlyMarkdownIssue(`${'\t'.repeat(7)}- a`, limits)).toBeNull()
        expect(costlyMarkdownIssue(`${'\t'.repeat(8)}- a`, limits)).toEqual(expect.any(String))
    })
})

// What an honest author writes in one long paragraph, which every limit must let through.
const sentence = 'Omega har egen hytte som brødre og systre kan booke, og her står det mer om hvordan det gjøres.'
const prose = `${sentence} Les **vilkårene** før du booker, og se [kalenderen](https://omega.ntnu.no/cabin/book) for `
    + `ledige helger. ${sentence} *Husk* å vaske etter deg.`
// How the editor writes a list ten deep, each level indented by the width of its parent's marker.
const nestedList = (indent: string, marker: string) => lines(10, depth => `${indent.repeat(depth)}${marker} nivå`)
    .join('\n')
const json = (depth: number): string => (depth ? `{\n${'    '.repeat(depth)}"a": ${json(depth - 1)}\n}` : '1')
const honest: Record<string, string> = {
    '300 paragraphs of prose': lines(300, index => `${prose} (${index + 1})`).join('\n\n'),
    'a list of 500 items': lines(500, index => `- Punkt ${index + 1}: ${sentence}`).join('\n'),
    'lists nested ten deep, bulleted': lines(20, () => nestedList('  ', '-')).join('\n\n'),
    'lists nested ten deep, numbered': lines(20, () => nestedList('   ', '1.')).join('\n\n'),
    'a list of 300 names, each bold with a link': lines(300, index => `- **Navn Navnesen ${index}**, `
        + `[profil](https://omega.ntnu.no/users/navn_navnesen_${index})`).join('\n'),
    'a quote four deep, as an e-mail thread pasted in': lines(20, () => `> > > > ${sentence}`).join('\n\n'),
    'a list in three quotes': lines(20, () => `> > > - ${sentence}`).join('\n\n'),
    'a code block of JSON nested eight deep': `\`\`\`\n${json(8)}\n\`\`\``,
    'a quote in a quote in a quote': lines(30, () => `> ${sentence}\n>\n> > ${sentence}\n> >\n> > > ${sentence}`)
        .join('\n\n'),
    'a code block of 300 lines indented eight spaces':
        `\`\`\`\n${lines(300, index => `        line_${index} = value[${index}] * 2`).join('\n')}\n\`\`\``,
    'a long row of dashes as a rule': `${sentence}\n\n${'-'.repeat(2_000)}\n\n${sentence}`,
    'text pasted with long lines': lines(20, () => `${sentence} `.repeat(40).trim()).join('\n\n'),
    'text pasted with its line breaks': lines(45, () => lines(30, () => sentence.slice(0, 70)).join('\n')).join('\n\n'),
}

describe('an honest long paragraph', () => {
    test.each(Object.entries(honest))('%s passes the limits', (_name, markdown) => {
        expect(costlyMarkdownIssue(markdown, limits)).toBeNull()
    })
})
