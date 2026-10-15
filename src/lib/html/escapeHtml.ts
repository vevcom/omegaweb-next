const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}

/**
 * Escapes text for a place that takes html, such as a mail body written as a string. Text that
 * React renders needs none of this - React escapes it.
 */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, character => htmlEscapes[character])
