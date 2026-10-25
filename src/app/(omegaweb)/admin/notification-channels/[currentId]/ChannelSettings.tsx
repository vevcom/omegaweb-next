'use client'

import PageTitleSetter from '@/contexts/PageTitleSetter'
import NotificationMethodSelector from '@/components/NotificationMethodSelector/NotificationMethodSelector'
import TextInput from '@/components/UI/TextInput'
import { SelectNumber } from '@/components/UI/Select'
import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import {
    destroyNotificationChannelAction,
    updateNotificationChannelAction
} from '@/services/notifications/channel/actions'
import { findValidParents } from '@/services/notifications/channel/helpers'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'
import type { MailAlias } from '@/prisma-generated-pn-types'
import type { CapabilitiesJsObject } from '@/auth/authorizer/capabilities'

export default function ChannelSettings({
    currentChannel,
    channels,
    mailAliases,
    capabilities,
}: {
    currentChannel: ExpandedNotificationChannel,
    channels: ExpandedNotificationChannel[],
    mailAliases: MailAlias[],
    capabilities: CapabilitiesJsObject<'canUpdate' | 'canDestroy'>,
}) {
    const [currentChannelState, setCurrentChannel] = useState(currentChannel)

    const selectOptions = findValidParents(currentChannel.id, channels)

    return <PageWrapper
    >
        <PageTitleSetter title={currentChannelState.name} />
        <div className="
            w-full
            [&>p]:[font-weight:lighter] [&>p]:mb-[1rem]
        ">
            {currentChannelState.special ? <p>Spesiell: {currentChannelState.special}</p> : null}
            {capabilities.canUpdate.authorized &&
            <Form
                action={configureAction(updateNotificationChannelAction, {
                    params: {
                        id: currentChannelState.id,
                        availableMethods: currentChannelState.availableMethods,
                        defaultMethods: booleanOperationOnMethods(
                            currentChannelState.defaultMethods,
                            currentChannelState.availableMethods,
                            'AND'
                        )
                    }
                })}
                submitText="Lagre"
            >
                <input type="hidden" name="id" value={currentChannelState.id} />

                <TextInput label="Navn" name="name" defaultValue={currentChannelState.name} onChange={(e) => {
                    const value = e.target.value
                    setCurrentChannel({
                        ...currentChannelState,
                        name: value,
                    })
                }} />
                <div className="max-w-[350px]">
                    <TextInput
                        label="Beskrivelse"
                        name="description"
                        defaultValue={currentChannelState.description ?? ''}
                    />
                </div>

                <div className="max-w-[350px]">
                    {currentChannelState.special !== 'ROOT' ?
                        <SelectNumber
                            label="Overordnet kanal"
                            name="parentId"
                            options={selectOptions.map(channel => ({ value: channel.id, label: channel.name }))}
                            value={currentChannelState.parentId}
                            onChange={id => setCurrentChannel({ ...currentChannelState, parentId: id })}
                        />
                        :
                        <input type="hidden" name="parentId" value={currentChannelState.parentId} />
                    }
                </div>

                <div className="max-w-[350px]">
                    <SelectNumber
                        label="Alias"
                        name="mailAliasId"
                        options={mailAliases.map(alias => ({ value: alias.id, label: alias.address }))}
                        value={currentChannelState.mailAliasId}
                        onChange={id => setCurrentChannel({ ...currentChannelState, mailAliasId: id })}
                    />
                </div>

                <div className="flex flex-row flex-wrap">

                    <NotificationMethodSelector
                        formPrefix="availableMethods"
                        title="Tilgjengelige metoder"
                        methods={currentChannelState.availableMethods}
                        onChange={(data) => {
                            setCurrentChannel({
                                ...currentChannelState,
                                availableMethods: data,
                            })
                        }}
                    />
                    <NotificationMethodSelector
                        formPrefix="defaultMethods"
                        title="Standardmetoder"
                        methods={currentChannelState.defaultMethods}
                        editable={currentChannelState.availableMethods}
                        onChange={(data) => {
                            setCurrentChannel({
                                ...currentChannelState,
                                defaultMethods: data,
                            })
                        }}
                    />

                </div>


            </Form>
            }
            {capabilities.canDestroy.authorized && !currentChannel.special &&
            <Form
                title="Slett kanal"
                submitText="Slett kanal"
                submitColor="red"
                action={configureAction(destroyNotificationChannelAction, { params: { id: currentChannel.id } })}
                navigateOnSuccess="/admin/notification-channels"
                confirmation={{
                    confirm: true,
                    text: `
                        Er du sikker på at du vil slette kanalen "${currentChannel.name}"?
                        Abonnementene på den og varslene som er sendt i den slettes også. Dette kan ikke angres.
                    `
                }}
            />
            }
        </div>
    </PageWrapper>
}
