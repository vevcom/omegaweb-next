'use client'
import { mailServerLinks } from '@/pageKits/mailServer/links'
import Checkbox from '@/components/UI/Checkbox'
import useSiteRouter from '@/hooks/useSiteRouter'
import type { MailServerPagesConfig } from '@/pageKits/mailServer/config'
import type { MailServerPart } from '@/pageKits/mailServer/links'

/**
 * The switch between every alias or list the session may see and only the ones it owns. Kept in
 * the url, since the list is rendered on the server.
 */
export default function ToggleOnlyOwned({
    config,
    part,
    onlyOwned,
}: {
    config: MailServerPagesConfig,
    part: MailServerPart,
    onlyOwned: boolean,
}) {
    const { replace } = useSiteRouter()
    const links = mailServerLinks(config)

    return <Checkbox
        name="onlyOwned"
        label="Bare det jeg eier"
        checked={onlyOwned}
        onChange={event => replace(links.part(part, event.target.checked))}
    />
}
