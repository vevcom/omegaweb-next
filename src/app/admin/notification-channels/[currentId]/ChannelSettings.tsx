'use client'

import styles from './ChannelSettings.module.scss'
import PageTitleSetter from '@/contexts/PageTitleSetter'
import NotificationMethodSelector from '@/components/NotificationMethodSelector/NotificationMethodSelector'
import TextInput from '@/components/UI/TextInput'
import { SelectNumber } from '@/components/UI/Select'
import Form from '@/components/Form/Form'
import PageWrapper from '@/components/PageWrapper/PageWrapper'
import { booleanOperationOnMethods } from '@/services/notifications/methods/helpers'
import { updateNotificationChannelAction } from '@/services/notifications/channel/actions'
import { findValidParents } from '@/services/notifications/channel/schemas'
import { configureAction } from '@/services/configureAction'
import { useState } from 'react'
import type { ExpandedNotificationChannel } from '@/services/notifications/types'
import type { MailAlias } from '@/prisma-generated-pn-types'

export default function ChannelSettings({
    currentChannel,
    channels,
    mailAliases,
}: {
    currentChannel: ExpandedNotificationChannel,
    channels: ExpandedNotificationChannel[],
    mailAliases: MailAlias[],
}) {
    const [currentChannelState, setCurrentChannel] = useState(currentChannel)

    const selectOptions = findValidParents(currentChannel.id, channels)

    return <PageWrapper
    >
        <PageTitleSetter title={currentChannelState.name} />
        <div className={styles.channelSettings}>
            {currentChannelState.special ? <p>Spesiell: {currentChannelState.special}</p> : null}
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
                <div className={styles.widerDiv}>
                    <TextInput
                        label="Beskrivelse"
                        name="description"
                        defaultValue={currentChannelState.description ?? ''}
                        className={styles.descriptionInput}
                    />
                </div>

                <div className={styles.widerDiv}>
                    {currentChannelState.special !== 'ROOT' ?
                        <SelectNumber
                            label="Forelder"
                            name="parentId"
                            options={selectOptions.map(channel => ({ value: channel.id, label: channel.name }))}
                            value={currentChannelState.parentId}
                            onChange={id => setCurrentChannel({ ...currentChannelState, parentId: id })}
                        />
                        :
                        <input type="hidden" name="parentId" value={currentChannelState.parentId} />
                    }
                </div>

                <div className={styles.widerDiv}>
                    <SelectNumber
                        label="Alias"
                        name="mailAliasId"
                        options={mailAliases.map(alias => ({ value: alias.id, label: alias.address }))}
                        value={currentChannelState.mailAliasId}
                        onChange={id => setCurrentChannel({ ...currentChannelState, mailAliasId: id })}
                    />
                </div>

                <div className={styles.methodContainer}>

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
                        title="Standard metoder"
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
        </div>
    </PageWrapper>
}
