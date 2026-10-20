import EventTag from './EventTag'
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
        <div className="max-h-[80svh]">
            <h1>Tagger</h1>
            {
                capabilities.canCreateTags.authorized && (
                    <span className="flex items-center [&_form]:flex max-mobile:[&_form]:flex-col mobile:[&_form]:items-center mobile:[&_form]:justify-center mobile:[&_form]:gap-[1em]">
                        <Form refreshOnSuccess action={createEventTagAction} submitText="Lag">
                            <TextInput name="name" label="Navn" />
                            <Textarea name="description" label="Beskrivelse" />
                            <ColorInput name="color" label="Farge"/>
                        </Form>
                    </span>
                )
            }
            <ul className="mt-[1em] flex flex-row flex-wrap gap-[2em] overflow-y-auto overflow-x-visible list-none isolate pb-[5em] [&_a]:no-underline [&_li]:flex [&_li]:items-center [&_li]:z-1 [&_li:hover]:z-2">
                {
                    eventTags.map((tag, index) => (
                        <li key={index} >
                            <Link
                                className={
                                    selectedTags.map(tagItem => tagItem.name).includes(tag.name) ? "relative hover:after:content-['✖'] hover:after:text-[length:4em] hover:after:text-text hover:after:absolute hover:after:left-1/2 hover:after:top-1/2 hover:after:-translate-x-1/2 hover:after:-translate-y-1/2" : ''
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
                                        {capabilities.canUpdateTags.authorized && <span
                                            className="border-b-3 border-surface-subtle"
                                        >
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
                                        {capabilities.canDestroyTags.authorized && <span>
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
