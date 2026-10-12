import EventTag from './EventTag'
import styles from './EventTagsAdmin.module.scss'
import Form from '@/components/Form/Form'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import TextInput from '@/UI/TextInput'
import Textarea from '@/UI/Textarea'
import ColorInput from '@/UI/ColorInput'
import { QueryParams } from '@/lib/queryParams/queryParams'
import { destroyEventTagAction, updateEventTagAction, createEventTagAction } from '@/services/events/tags/actions'
import { configureAction } from '@/services/configureAction'
import Link from 'next/link'
import type { EventTag as EventTagT } from '@/prisma-generated-pn-types'
import type { Capabilities } from '@/auth/authorizer/capabilities'

type PropTypes = {
    eventTags: EventTagT[]
    capabilities: Capabilities<'canCreateTags' | 'canUpdateTags' | 'canDestroyTags'>
    selectedTags: EventTagT[]
    page: 'EVENT' | 'EVENT_ARCHIVE'
}

/**
 * Component that displays tags and admin for admins.
 * @param eventTags - the tags to display
 * @param capabilities - which of creating, updating and destroying tags to offer
 * @returns
 */
export default function EventTagsAdmin({
    eventTags,
    selectedTags,
    capabilities,
    page
}: PropTypes) {
    const baseUrl = page === 'EVENT' ? '/events' : '/events/archive'

    const removeFromUrl = (tag: string) => (selectedTags.length === 1 ?
        baseUrl :
        `${baseUrl}?${QueryParams.eventTags.encodeUrl(
            selectedTags.filter(tagItem => tagItem.name !== tag).map(tagItem => tagItem.name)
        )}`)
    const addToUrl = (tag: string) => `${baseUrl}?${QueryParams.eventTags.encodeUrl(
        [...selectedTags.map(tagItem => tagItem.name), tag]
    )}`
    return (
        <div className={styles.EventTagsAdmin}>
            <h1>Tagger</h1>
            {
                capabilities.canCreateTags.authorized && (
                    <span className={styles.create}>
                        <Form refreshOnSuccess action={createEventTagAction} submitText="Lag">
                            <TextInput name="name" label="Navn" />
                            <Textarea name="description" label="Beskrivelse" />
                            <ColorInput name="color" label="Farge"/>
                        </Form>
                    </span>
                )
            }
            <ul>
                {
                    eventTags.map((tag, index) => (
                        <li key={index} >
                            <Link
                                className={
                                    selectedTags.map(tagItem => tagItem.name).includes(tag.name) ? styles.selected : ''
                                }
                                href={
                                    selectedTags.map(tagItem => tagItem.name).includes(tag.name) ?
                                        removeFromUrl(tag.name) : addToUrl(tag.name)
                                }
                            >
                                <EventTag eventTag={tag} />
                            </Link>
                            {
                                capabilities.canUpdateTags.authorized || capabilities.canDestroyTags.authorized ? (
                                    <SettingsHeaderItemPopUp scale={25} popUpKey={`EventTagPopUp${tag.id}`}>
                                        {capabilities.canUpdateTags.authorized && <span className={styles.update}>
                                            <Form
                                                refreshOnSuccess
                                                action={configureAction(updateEventTagAction, { params: { id: tag.id } })}
                                                submitText="Oppdater"
                                            >
                                                <TextInput
                                                    name="name"
                                                    label="Navn"
                                                    defaultValue={tag.name}
                                                />
                                                <Textarea
                                                    name="description"
                                                    label="Beskrivelse"
                                                    defaultValue={tag.description}
                                                />
                                                <ColorInput
                                                    name="color"
                                                    label="Farge"
                                                    defaultValueRGB={{
                                                        red: tag.colorR,
                                                        green: tag.colorG,
                                                        blue: tag.colorB
                                                    }}
                                                />
                                            </Form>
                                        </span>
                                        }
                                        {capabilities.canDestroyTags.authorized && <span className={styles.destroy}>
                                            <Form
                                                closePopUpOnSuccess={`EventTagPopUp${tag.id}`}
                                                refreshOnSuccess
                                                action={configureAction(destroyEventTagAction, { params: { id: tag.id } })}
                                                submitColor="red"
                                                confirmation={{
                                                    confirm: true,
                                                    text: 'Er du sikker på at du vil slette denne taggen?'
                                                }}
                                                submitText="Slett"
                                            />
                                        </span>
                                        }
                                    </SettingsHeaderItemPopUp>
                                ) : <></>
                            }
                        </li>
                    ))
                }
            </ul>
        </div>
    )
}
