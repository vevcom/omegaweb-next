import EventTag from './EventTag'
import { eventListLink } from '@/pageKits/events/links'
import { toggled } from '@/pageKits/events/filter'
import Form from '@/components/Form/Form'
import { SettingsHeaderItemPopUp } from '@/components/HeaderItems/HeaderItemPopUp'
import TextInput from '@/UI/TextInput'
import Textarea from '@/UI/Textarea'
import ColorInput from '@/UI/ColorInput'
import { destroyEventTagAction, updateEventTagAction, createEventTagAction } from '@/services/events/tags/actions'
import { configureAction } from '@/services/configureAction'
import SiteLink from '@/components/SiteLink/SiteLink'
import type { EventTag as EventTagT } from '@/prisma-generated-pn-types'
import type { Capabilities } from '@/auth/authorizer/capabilities'
import type { EventPagesConfig } from '@/pageKits/events/config'
import type { EventListFilter } from '@/pageKits/events/links'

type PropTypes = {
    eventTags: EventTagT[]
    capabilities: Capabilities<'canCreateTags' | 'canUpdateTags' | 'canDestroyTags'>
    /** What the list is narrowed to now. Picking a tag links to the list with it added or removed. */
    filter: EventListFilter
    config: EventPagesConfig
    /** Whether the tags filter the archive rather than the coming events. */
    archive: boolean
}

const pickedClassName = `
    relative
    hover:after:content-['✖'] hover:after:text-[length:4em] hover:after:text-base-content hover:after:absolute
    hover:after:left-1/2 hover:after:top-1/2 hover:after:-translate-x-1/2 hover:after:-translate-y-1/2
`

/** The tags to narrow a list of events by, and the administration of the tags for those who may. */
export default function EventTagsAdmin({
    eventTags,
    filter,
    capabilities,
    config,
    archive,
}: PropTypes) {
    const listHref = eventListLink(config, archive)
    const pickedTagNames = filter.tagNames ?? []
    return (
        <div className="max-h-[80svh]">
            <h1>Tagger</h1>
            {
                capabilities.canCreateTags.authorized && (
                    <span className="
                        flex items-center
                        [&_form]:flex
                        max-mobile:[&_form]:flex-col
                        mobile:[&_form]:items-center mobile:[&_form]:justify-center mobile:[&_form]:gap-[1em]
                    ">
                        <Form refreshOnSuccess action={createEventTagAction} submitText="Lag">
                            <TextInput name="name" label="Navn" />
                            <Textarea name="description" label="Beskrivelse" />
                            <ColorInput name="color" label="Farge"/>
                        </Form>
                    </span>
                )
            }
            <ul className="
                mt-[1em] flex flex-row flex-wrap gap-[2em] overflow-y-auto overflow-x-visible list-none isolate pb-[5em]
                [&_a]:no-underline
                [&_li]:flex [&_li]:items-center [&_li]:z-1
                [&_li:hover]:z-2
            ">
                {
                    eventTags.map((tag, index) => (
                        <li key={index} >
                            <SiteLink
                                className={pickedTagNames.includes(tag.name) ? pickedClassName : ''}
                                href={listHref({ ...filter, tagNames: toggled(pickedTagNames, tag.name) })}
                            >
                                <EventTag eventTag={tag} />
                            </SiteLink>
                            {
                                capabilities.canUpdateTags.authorized || capabilities.canDestroyTags.authorized ? (
                                    <SettingsHeaderItemPopUp scale={25} popUpKey={`EventTagPopUp${tag.id}`}>
                                        {capabilities.canUpdateTags.authorized && <span
                                            className="border-b-3 border-base-300"
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
