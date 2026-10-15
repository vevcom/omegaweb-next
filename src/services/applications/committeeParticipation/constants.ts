export const videoLinkDefaultText = 'Komitévideo'

/** The url a video link is created with, and what the link editor leaves behind when cleared. */
export const videoLinkUnsetUrl = './'

// Blank counts as unset too: the link editor stores an emptied url field as '', not as './'.
export const videoLinkIsSet = (videoLink: { url: string }) =>
    !['', videoLinkUnsetUrl, '/'].includes(videoLink.url.trim())
