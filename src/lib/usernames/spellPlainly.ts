/** The letters outside a to z that usernames here most often hold, as they are spelled without them. */
const SPELLINGS: [letter: RegExp, spelling: string][] = [[/æ/g, 'ae'], [/ø/g, 'oe'], [/å/g, 'aa']]

/**
 * A username in lower case, with æ, ø and å spelled out and the marks of other letters apart from
 * them, so that leaving out what is not a to z keeps the letter and loses the mark. What a mail
 * address and a chat id, which take a to z alone, are made from.
 */
export function spellPlainly(username: string): string {
    return SPELLINGS
        .reduce((name, [letter, spelling]) => name.replace(letter, spelling), username.toLowerCase())
        .normalize('NFKD')
}
