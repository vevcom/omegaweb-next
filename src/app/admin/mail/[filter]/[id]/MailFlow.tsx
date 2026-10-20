'use client'
import {
    destroyAliasMailingListRelationAction,
    destroyMailingListExternalRelationAction,
    destroyMailingListGroupRelationAction,
    destroyMailingListUserRelationAction
} from '@/services/mail/actions'
import { mailAuth } from '@/services/mail/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faArrowRightLong, faAt, faEnvelope, faListUl, faUser, faUserGroup, faXmark
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { ActionReturn } from '@/services/actionTypes'
import type { MailFlowObject, MailListTypes, ViaType } from '@/services/mail/types'

const typeIcons: Record<MailListTypes, IconDefinition> = {
    alias: faAt,
    mailingList: faListUl,
    group: faUserGroup,
    user: faUser,
    mailaddressExternal: faEnvelope,
}

type Chip = {
    type: MailListTypes,
    id: number,
    label: string,
    via?: ViaType[],
    destroy?: () => Promise<ActionReturn<unknown>>,
}

type ChipSection = {
    label?: string,
    chips: Chip[],
}

/**
 * The mail flow graphic: every mail follows alias → e-postliste → mottakere, and this renders
 * those three stages with the focused item highlighted. The recipient stage is sectioned by type,
 * and a group stands in for its members - users that are only on a list through a group are not
 * listed. Direct relations to the focused item can be removed right in the graphic.
 */
export default function MailFlow({
    filter,
    id,
    data,
    groupNames,
}: {
    filter: MailListTypes,
    id: number,
    data: MailFlowObject,
    groupNames: Record<number, string>,
}) {
    const { refresh } = useRouter()
    const [error, setError] = useState<string | null>(null)

    const canDestroyAliasMailingListRelation = useAuthorizer({
        authorizer: mailAuth.destroyAliasMailingListRelation
    }).authorized
    const canDestroyMailingListExternalRelation = useAuthorizer({
        authorizer: mailAuth.destroyMailingListExternalRelation
    }).authorized
    const canDestroyMailingListUserRelation = useAuthorizer({
        authorizer: mailAuth.destroyMailingListUserRelation
    }).authorized
    const canDestroyMailingListGroupRelation = useAuthorizer({
        authorizer: mailAuth.destroyMailingListGroupRelation
    }).authorized

    // Which relations are removable depends on which item is in focus - only relations directly
    // to the focused item can be removed here, and never ones that follow from a via-path.
    const aliasChips: Chip[] = data.alias.map(alias => ({
        type: 'alias',
        id: alias.id,
        label: alias.address,
        via: alias.via,
        destroy: (filter === 'mailingList' && !alias.via && canDestroyAliasMailingListRelation)
            ? () => destroyAliasMailingListRelationAction({ data: { mailingListId: id, mailAliasId: alias.id } })
            : undefined,
    }))

    const mailingListChips: Chip[] = data.mailingList.map(list => {
        let destroy
        if (!list.via) {
            if (filter === 'alias' && canDestroyAliasMailingListRelation) {
                destroy = () => destroyAliasMailingListRelationAction({ data: { mailAliasId: id, mailingListId: list.id } })
            } else if (filter === 'mailaddressExternal' && canDestroyMailingListExternalRelation) {
                destroy = () => destroyMailingListExternalRelationAction({
                    data: { mailAddressExternalId: id, mailingListId: list.id },
                })
            } else if (filter === 'user' && canDestroyMailingListUserRelation) {
                destroy = () => destroyMailingListUserRelationAction({ data: { userId: id, mailingListId: list.id } })
            } else if (filter === 'group' && canDestroyMailingListGroupRelation) {
                destroy = () => destroyMailingListGroupRelationAction({ data: { groupId: id, mailingListId: list.id } })
            }
        }
        return {
            type: 'mailingList',
            id: list.id,
            label: list.name,
            via: list.via,
            destroy,
        }
    })

    const groupChips: Chip[] = data.group.map(group => ({
        type: 'group',
        id: group.id,
        label: groupNames[group.id] ?? `Gruppe ${group.id}`,
        via: group.via,
        destroy: (filter === 'mailingList' && !group.via && canDestroyMailingListGroupRelation)
            ? () => destroyMailingListGroupRelationAction({ data: { mailingListId: id, groupId: group.id } })
            : undefined,
    }))

    // A group stands in for its members, so users that are only reached via a group are left
    // out - except the focused user, who must stay visible on their own page.
    const userChips: Chip[] = data.user
        .filter(user => !user.via || (filter === 'user' && user.id === id))
        .map(user => ({
            type: 'user',
            id: user.id,
            label: `${user.firstname} ${user.lastname}`,
            via: user.via,
            destroy: (filter === 'mailingList' && !user.via && canDestroyMailingListUserRelation)
                ? () => destroyMailingListUserRelationAction({ data: { mailingListId: id, userId: user.id } })
                : undefined,
        }))

    const externalChips: Chip[] = data.mailaddressExternal.map(external => ({
        type: 'mailaddressExternal',
        id: external.id,
        label: external.address,
        via: external.via,
        destroy: (filter === 'mailingList' && !external.via && canDestroyMailingListExternalRelation)
            ? () => destroyMailingListExternalRelationAction({
                data: { mailingListId: id, mailAddressExternalId: external.id },
            })
            : undefined,
    }))

    const removeRelation = async (chip: Chip) => {
        if (!chip.destroy) return
        const result = await chip.destroy()
        if (!result.success) {
            setError(`Kunne ikke fjerne ${chip.label}.`)
            return
        }
        setError(null)
        refresh()
    }

    const renderChip = (chip: Chip) => {
        const focused = chip.type === filter && chip.id === id
        const removable = Boolean(chip.destroy) && !focused

        return <li
            key={`${chip.type}-${chip.id}`}
            className={[
                'flex items-center gap-2 py-2 px-3 rounded-round bg-surface-subtle min-w-0',
                focused ? 'outline-2 outline-accent-green font-bold' : '',
            ].join(' ')}
        >
            <FontAwesomeIcon icon={typeIcons[chip.type]} className="text-text-muted flex-none" />
            {focused
                ? <span className="text-text no-underline wrap-anywhere">{chip.label}</span>
                : <Link
                    className="text-text no-underline wrap-anywhere hover:underline"
                    href={`/admin/mail/${chip.type}/${chip.id}`}
                >
                    {chip.label}
                </Link>
            }
            {chip.via && chip.via.length > 0 && <span className="text-[0.8rem] text-text-muted italic">
                via {chip.via.map(viaItem => viaItem.label).join(', ')}
            </span>}
            {removable && <button
                type="button"
                className="ml-auto bg-transparent border-none cursor-pointer text-text-muted p-1 leading-none flex-none hover:text-accent-red"
                aria-label={`Fjern ${chip.label}`}
                onClick={() => removeRelation(chip)}
            >
                <FontAwesomeIcon icon={faXmark} />
            </button>}
        </li>
    }

    const renderStage = (title: string, sections: ChipSection[]) => {
        const chipCount = sections.reduce((count, section) => count + section.chips.length, 0)

        return <section className="flex-[1_1_0] min-w-0">
            <h3 className="mt-0 mx-0 mb-2 text-[0.85rem] uppercase tracking-[0.06em] text-text-muted">{title}</h3>
            {chipCount === 0 && <p className="text-text-muted italic m-0">Ingen</p>}
            {sections.filter(section => section.chips.length > 0).map(section => (
                <div key={section.label ?? title} className="[&:not(:first-of-type)]:mt-3">
                    {section.label && <h4
                        className="mt-0 mx-0 mb-1 text-[0.75rem] font-normal uppercase tracking-[0.06em] text-text-muted"
                    >
                        {section.label}
                    </h4>}
                    <ul className="list-none m-0 p-0 flex flex-col gap-2">
                        {section.chips.map(renderChip)}
                    </ul>
                </div>
            ))}
        </section>
    }

    return <div className="bg-surface-raised rounded-[calc(3*var(--rounding))] p-(--card-padding)">
        <div className="flex flex-row items-stretch gap-4 max-mobile:flex-col">
            {renderStage('Alias', [{ chips: aliasChips }])}
            <FontAwesomeIcon
                icon={faArrowRightLong}
                className="self-center text-text-muted text-[1.5rem] flex-none max-mobile:rotate-90"
            />
            {renderStage('E-postlister', [{ chips: mailingListChips }])}
            <FontAwesomeIcon
                icon={faArrowRightLong}
                className="self-center text-text-muted text-[1.5rem] flex-none max-mobile:rotate-90"
            />
            {renderStage('Mottakere', [
                { label: 'Grupper', chips: groupChips },
                { label: 'Brukere', chips: userChips },
                { label: 'Eksterne adresser', chips: externalChips },
            ])}
        </div>
        {error && <p className="text-accent-red mx-0 mb-0 mt-2">{error}</p>}
    </div>
}
