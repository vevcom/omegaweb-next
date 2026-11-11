import '@pn-server-only'
import { MailServerRefusal } from './client'
import { createHash } from 'crypto'
import type { MailServerClient } from './client'

/**
 * How the mail of an alias reaches the people behind it besides its mailbox. The mailbox owns the
 * alias's address, and the server lets an address be a mailbox or a list, not both. So the mailbox
 * runs a Sieve script: it keeps the mail, and sends a copy to a list on a domain of its own, which
 * hands it on to each address the alias reaches. One list, since the server lets a script of a
 * mailbox send a message on once.
 *
 * The copy says at its top that the mail came to the alias, who sent it, by name and address, and
 * where to answer it as the alias, in the mailbox. Writing that into the mail breaks the sender's
 * signature, so the copy goes out from the alias, signed by the server, and answers to it go to
 * the sender.
 *
 * The sender's name is theirs to choose, so it is only used where it is harmless: in the notice
 * unless it holds a character HTML reads as markup, and as the name the copy is from unless it
 * holds a quote, a backslash or a letter outside ASCII, which the server would write into the
 * header as it is. The address stands in for it otherwise. The letters of {@link HEADER_SPELLINGS}
 * are spelled out in ASCII for the header first, so most Norwegian names are shown there.
 */

/**
 * How the letters outside ASCII that names here most often hold are written in the name a copy is
 * from. The notice in the mail keeps the name as it is.
 */
const HEADER_SPELLINGS: [letter: string, spelling: string][] = [
    ['æ', 'ae'], ['ø', 'oe'], ['å', 'aa'], ['Æ', 'Ae'], ['Ø', 'Oe'], ['Å', 'Aa'],
    ['é', 'e'], ['è', 'e'], ['ö', 'o'], ['ä', 'a'], ['ü', 'u'], ['É', 'E'], ['Ö', 'O'], ['Ä', 'A'], ['Ü', 'U'],
]
/** Sieve has no way to replace every occurrence, so each letter is replaced this many times at most. */
const SPELLINGS_PER_LETTER = 3

/**
 * The lines of the script that spell the letters of {@link HEADER_SPELLINGS} out in the variable
 * `plain`. They are matched byte for byte, since the server otherwise takes Å for å.
 */
function headerSpellingLines(): string {
    return HEADER_SPELLINGS.flatMap(([letter, spelling]) =>
        Array.from({ length: SPELLINGS_PER_LETTER }, () =>
            `if string :comparator "i;octet" :matches "\${plain}" "*${letter}*" { set "plain" "\${1}${spelling}\${2}"; }`
        )
    ).join('\n')
}

const SCRIPT_NAME_PREFIX = 'omegaweb-forward-'

export type MailboxForwarding = {
    /** The group account of the mailbox on the server. */
    accountId: string,
    aliasAddress: string,
    /** The list the copies go to, or null for an alias that reaches no one. */
    forwardTo: string | null,
}

/** The domain the forwarding lists are on. No mail arrives for it from outside, so it needs no DNS. */
export function forwardingDomainOf(webmailDomain: string): string {
    return `forward.${webmailDomain}`
}

/**
 * The address of the list that forwards an alias's mail. It carries the alias's domain, joined with
 * `--`, which no local part holds (see mail/alias/schemas.ts), so two aliases never share a list.
 */
export function forwardingAddressOf(aliasAddress: string, webmailDomain: string): string {
    const at = aliasAddress.lastIndexOf('@')
    const localPart = aliasAddress.slice(0, at).toLowerCase()
    const domain = aliasAddress.slice(at + 1).toLowerCase()
    return `${localPart}--${domain}@${forwardingDomainOf(webmailDomain)}`
}

/** A string as Sieve takes it between double quotes. */
function sieveQuoted(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function htmlEscaped(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The script of an alias's mailbox. The mail is filed into the inbox first, as it arrived, and
 * only then rewritten for the copy. A `keep` there is not enough: the server drops it once the
 * script sends the mail on.
 */
export function forwardingScript({ aliasAddress, forwardTo, webmailOrigin }: {
    aliasAddress: string,
    forwardTo: string | null,
    webmailOrigin: string,
}): string {
    if (forwardTo === null) return 'keep;\n'

    const alias = sieveQuoted(aliasAddress)
    const htmlAlias = sieveQuoted(htmlEscaped(aliasAddress))
    const htmlOrigin = sieveQuoted(htmlEscaped(webmailOrigin))
    // ${who} is the script's variable, filled in for each mail, so it is escaped here.
    const textNotice = `Denne e-posten kom til ${alias} fra \${who}. `
        + `Svar som ${alias} fra postkassen: ${sieveQuoted(webmailOrigin)}`
    const htmlNotice = `<p style=\\"padding:8px;background:#eee\\">Denne e-posten kom til ${htmlAlias} fra \${who}. `
        + `<a href=\\"${htmlOrigin}\\">Svar som ${htmlAlias} fra postkassen</a>.</p>`
    return `require ["fileinto", "mime", "foreverypart", "replace", "variables", "editheader", "regex",
    "vnd.stalwart.expressions"];
fileinto "INBOX";
set "sender" "";
if address :matches "From" "*" { set "sender" "\${1}"; }
let "name" "header.from.name";
set "who" "\${sender}";
if not anyof (
    string :is "\${name}" "",
    string :is "\${name}" "\${sender}",
    string :matches "\${name}" ["*<*", "*>*", "*&*"]
) {
    set "who" "\${name} (\${sender})";
}
set "plain" "\${name}";
${headerSpellingLines()}
set "display" "\${sender}";
if not anyof (string :is "\${plain}" "", string :regex "\${plain}" "[^ !#-\\\\[\\\\]-~]") { set "display" "\${plain}"; }
foreverypart {
    if not header :mime :contains "Content-Disposition" "attachment" {
        if header :mime :subtype :is "Content-Type" "plain" {
            let "text" "body.text";
            replace "${textNotice}

\${text}";
        } elsif header :mime :subtype :is "Content-Type" "html" {
            let "html" "body.html";
            replace :mime "Content-Type: text/html; charset=utf-8

${htmlNotice}
\${html}";
        }
    }
}
deleteheader "From";
addheader "From" "\\"\${display} via ${alias}\\" <${alias}>";
addheader "Reply-To" "\${sender}";
redirect "${sieveQuoted(forwardTo)}";
`
}

/** The name a script is stored under: it carries a hash of the content, so a name tells whether a script is current. */
function scriptNameOf(content: string): string {
    return `${SCRIPT_NAME_PREFIX}${createHash('sha256').update(content).digest('hex').slice(0, 16)}`
}

/**
 * Makes the active script of every mailbox the one that forwards its alias's mail. A mailbox whose
 * active script already has the wanted name is left alone. Scripts of ours that are no longer
 * wanted are destroyed. One a member made is left, and stops running when ours takes its place. A
 * mailbox the server refuses a script for keeps what it had, and the others go on.
 *
 * @returns how many mailboxes were given a script, and what the server refused.
 */
export async function syncForwardingScripts(
    client: MailServerClient,
    mailboxes: MailboxForwarding[],
    webmailOrigin: string,
): Promise<{ changed: number, refused: string[] }> {
    const existing = await client.sieveScripts(mailboxes.map(mailbox => mailbox.accountId))
    let changed = 0
    const refused: string[] = []
    for (const { accountId, aliasAddress, forwardTo } of mailboxes) {
        const content = forwardingScript({ aliasAddress, forwardTo, webmailOrigin })
        const name = scriptNameOf(content)
        const scripts = existing.get(accountId) ?? []
        if (scripts.some(script => script.isActive && script.name === name)) continue

        // Ours that are not running go first, since one of them may hold the wanted name. The one
        // that is running can only go once the new one has taken its place.
        const ours = scripts.filter(script => script.name.startsWith(SCRIPT_NAME_PREFIX))
        try {
            await client.destroySieveScripts(accountId, ours.filter(script => !script.isActive).map(script => script.id))
            await client.setActiveSieveScript(accountId, name, content)
            await client.destroySieveScripts(accountId, ours.filter(script => script.isActive).map(script => script.id))
            changed += 1
        } catch (error) {
            if (!(error instanceof MailServerRefusal)) throw error
            refused.push(`${error.message}, the mailbox of ${aliasAddress}`)
        }
    }
    return { changed, refused }
}
