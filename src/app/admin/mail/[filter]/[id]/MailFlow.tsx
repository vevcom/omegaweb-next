'use client'
import styles from './MailFlow.module.scss'
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

    const canDestroyRelations = useAuthorizer({
        authorizer: mailAuth.destroyAliasMailingListRelation
    }).authorized

    // Which relations are removable depends on which item is in focus - only relations directly
    // to the focused item can be removed here, and never ones that follow from a via-path.
    const aliasChips: Chip[] = data.alias.map(alias => ({
        type: 'alias',
        id: alias.id,
        label: alias.address,
        via: alias.via,
        destroy: (filter === 'mailingList' && !alias.via)
            ? () => destroyAliasMailingListRelationAction({ data: { mailingListId: id, mailAliasId: alias.id } })
            : undefined,
    }))

    const mailingListChips: Chip[] = data.mailingList.map(list => {
        let destroy
        if (!list.via) {
            if (filter === 'alias') {
                destroy = () => destroyAliasMailingListRelationAction({ data: { mailAliasId: id, mailingListId: list.id } })
            } else if (filter === 'mailaddressExternal') {
                destroy = () => destroyMailingListExternalRelationAction({
                    data: { mailAddressExternalId: id, mailingListId: list.id },
                })
            } else if (filter === 'user') {
                destroy = () => destroyMailingListUserRelationAction({ data: { userId: id, mailingListId: list.id } })
            } else if (filter === 'group') {
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
        destroy: (filter === 'mailingList' && !group.via)
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
            destroy: (filter === 'mailingList' && !user.via)
                ? () => destroyMailingListUserRelationAction({ data: { mailingListId: id, userId: user.id } })
                : undefined,
        }))

    const externalChips: Chip[] = data.mailaddressExternal.map(external => ({
        type: 'mailaddressExternal',
        id: external.id,
        label: external.address,
        via: external.via,
        destroy: (filter === 'mailingList' && !external.via)
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
        const removable = Boolean(chip.destroy) && canDestroyRelations && !focused

        return <li
            key={`${chip.type}-${chip.id}`}
            className={`${styles.chip} ${focused ? styles.focused : ''}`}
        >
            <FontAwesomeIcon icon={typeIcons[chip.type]} className={styles.typeIcon} />
            {focused
                ? <span className={styles.chipLabel}>{chip.label}</span>
                : <Link className={styles.chipLabel} href={`/admin/mail/${chip.type}/${chip.id}`}>{chip.label}</Link>
            }
            {chip.via && chip.via.length > 0 && <span className={styles.via}>
                via {chip.via.map(viaItem => viaItem.label).join(', ')}
            </span>}
            {removable && <button
                type="button"
                className={styles.remove}
                aria-label={`Fjern ${chip.label}`}
                onClick={() => removeRelation(chip)}
            >
                <FontAwesomeIcon icon={faXmark} />
            </button>}
        </li>
    }

    const renderStage = (title: string, sections: ChipSection[]) => {
        const chipCount = sections.reduce((count, section) => count + section.chips.length, 0)

        return <section className={styles.stage}>
            <h3>{title}</h3>
            {chipCount === 0 && <p className={styles.none}>Ingen</p>}
            {sections.filter(section => section.chips.length > 0).map(section => (
                <div key={section.label ?? title} className={styles.stageSection}>
                    {section.label && <h4>{section.label}</h4>}
                    <ul>
                        {section.chips.map(renderChip)}
                    </ul>
                </div>
            ))}
        </section>
    }

    return <div className={styles.flowCard}>
        <div className={styles.flow}>
            {renderStage('Alias', [{ chips: aliasChips }])}
            <FontAwesomeIcon icon={faArrowRightLong} className={styles.arrow} />
            {renderStage('E-postlister', [{ chips: mailingListChips }])}
            <FontAwesomeIcon icon={faArrowRightLong} className={styles.arrow} />
            {renderStage('Mottakere', [
                { label: 'Grupper', chips: groupChips },
                { label: 'Brukere', chips: userChips },
                { label: 'Eksterne adresser', chips: externalChips },
            ])}
        </div>
        {error && <p className={styles.error}>{error}</p>}
    </div>
}
