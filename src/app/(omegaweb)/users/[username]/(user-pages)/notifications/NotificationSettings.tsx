'use client'

import SubscriptionItem from './SubscriptionItem'
import { booleanOperationOnMethods, newAllMethodsOff } from '@/services/notifications/methods/helpers'
import SubmitButton from '@/components/UI/SubmitButton'
import { SUCCESS_FEEDBACK_TIME } from '@/components/Form/constants'
import { updateNotificationSubscriptionsAction } from '@/services/notifications/subscription/actions'
import { notificationSubscriptionAuth } from '@/services/notifications/subscription/auth'
import useAuthorizer from '@/hooks/useAuthorizer'
import { notificationMethodsArray, notificationMethodsDisplayMap } from '@/services/notifications/constants'
import { useState } from 'react'
import type { UserBasic } from '@/services/users/types'
import type { MinimizedSubscription, Subscription } from '@/services/notifications/subscription/types'
import type { NotificationBranch } from './types'
import type { ErrorMessage } from '@/services/error'
import type {
    ExpandedNotificationChannel,
    NotificationMethodGeneral,
    NotificationMethods
} from '@/services/notifications/types'

function generateChannelTree(channels: ExpandedNotificationChannel[], subscriptions: Subscription[]): NotificationBranch {
    const rootChannel = channels.find(channel => channel.special === 'ROOT')
    if (!rootChannel) {
        throw Error('Ingen ROOT varslings kanal')
    }

    function extendChannel(channel: ExpandedNotificationChannel): NotificationBranch {
        return {
            ...channel,
            children: [],
            subscription: subscriptions.find(subscription => subscription.channelId === channel.id)
        }
    }


    const channelTree = extendChannel(rootChannel)

    function searchTree(currentBranch: NotificationBranch) {
        for (const channel of channels) {
            if (channel.parentId === currentBranch.id && channel.special !== 'ROOT') {
                const obj = extendChannel(channel)
                currentBranch.children.push(obj)
                searchTree(obj)
            }
        }
    }

    searchTree(channelTree)

    return channelTree
}

function findBranchInTree(branch: NotificationBranch, branchId: number): NotificationBranch | null {
    if (branch.id === branchId) {
        return branch
    }

    for (const branchChild of branch.children) {
        const child = findBranchInTree(branchChild, branchId)
        if (child) {
            return child
        }
    }

    return null
}

function changeMethodsInBranch(branch: NotificationBranch, newMethods: NotificationMethodGeneral): NotificationBranch {
    branch.subscription ??= {
        new: true,
        methods: newAllMethodsOff(),
    }

    const changedMethod = booleanOperationOnMethods(
        branch.subscription.methods,
        newMethods,
        'XOR'
    )

    const changedMethodArr = Object
        .entries(changedMethod)
        .filter(keyValue => keyValue[1])
        .map(keyValue => keyValue[0]) as NotificationMethods[]

    function recursiveChange(subBranch: NotificationBranch) {
        for (const method of changedMethodArr) {
            if (!subBranch.availableMethods[method]) {
                continue
            }

            if (newMethods[method] && !subBranch.subscription) {
                subBranch.subscription = {
                    new: true,
                    methods: newAllMethodsOff(),
                }
            }

            if (subBranch.subscription) {
                subBranch.subscription.methods[method] = newMethods[method]
            }
        }

        subBranch.children.forEach(recursiveChange)
    }

    recursiveChange(branch)

    return branch
}

function prepareDataForDelivery(tree: NotificationBranch) {
    const ret: MinimizedSubscription[] = []

    function traverseBranch(branch: NotificationBranch) {
        if (branch.subscription) {
            ret.push({
                channelId: branch.id,
                methods: branch.subscription.methods
            })
        }

        branch.children.forEach(traverseBranch)
    }

    traverseBranch(tree)

    return ret
}

type PropTypes = {
    channels: ExpandedNotificationChannel[],
    subscriptions: Subscription[],
    user: UserBasic
}

export default function NotificationSettings({
    channels,
    subscriptions,
    user
}: PropTypes) {
    const [channelTree, setChannelTree] = useState(
        generateChannelTree(channels, subscriptions)
    )
    const canUpdate = useAuthorizer({
        authorizer: notificationSubscriptionAuth.update.data({ userId: user.id })
    }).authorized

    const [hasChanged, setHasChanged] = useState<number>(new Date().getTime() - 1)
    const [lastSubmit, setLastSubmit] = useState<number>(new Date().getTime())
    const [formState, setFormState] = useState<{
        pending: boolean,
        success: boolean,
        errors?: ErrorMessage[]
    }>({
        pending: false,
        success: false,
    })

    function handleChange(branchId: number, method: NotificationMethodGeneral) {
        const branch = findBranchInTree(channelTree, branchId)
        if (!branch) return

        changeMethodsInBranch(branch, method)

        setChannelTree(channelTree)
        setHasChanged(new Date().getTime())
    }

    async function handleSubmit() {
        if (!user) {
            setFormState({
                success: false,
                pending: false,
            })
            return
        }

        const submitTimestamp = (new Date().getTime())

        setFormState({
            success: false,
            pending: true
        })
        const data = prepareDataForDelivery(channelTree)
        const results = await updateNotificationSubscriptionsAction({
            params: {
                userId: user.id
            },
        }, {
            data: {
                subscriptions: data
            },
        })

        if (results.success) {
            setFormState({
                success: true,
                pending: false,
            })

            setTimeout(
                () => {
                    setLastSubmit(submitTimestamp)
                },
                SUCCESS_FEEDBACK_TIME
            )

            setTimeout(
                () => setFormState({
                    pending: false,
                    success: false,
                }),
                SUCCESS_FEEDBACK_TIME + 200
            )

            return
        }

        setFormState({
            success: false,
            pending: false,
            errors: results.error
        })
    }

    return <>
        <table cellSpacing="0" className="
            ohma-table
            max-mobile:[&_th]:py-2 max-mobile:[&_th]:px-[calc(1.2*var(--gap))]
            max-mobile:[&_td]:py-2 max-mobile:[&_td]:px-[calc(1.2*var(--gap))]
        ">
            <thead className="align-bottom">
                <tr>
                    <th>Kanal</th>
                    {notificationMethodsArray.map(method =>
                        <th
                            key={method}
                            className="
                                w-[1%] whitespace-nowrap text-center
                                mobile:min-w-[8rem]
                                max-mobile:relative max-mobile:h-[6rem] max-mobile:min-w-[2.5rem]
                                max-mobile:[&>span]:absolute max-mobile:[&>span]:right-1/2 max-mobile:[&>span]:bottom-2
                                max-mobile:[&>span]:rotate-45 max-mobile:[&>span]:origin-bottom-right
                            "
                        >
                            <span>{notificationMethodsDisplayMap[method]}</span>
                        </th>
                    )}
                </tr>
            </thead>
            <tbody>
                <SubscriptionItem
                    branch={channelTree}
                    onChange={handleChange}
                />
            </tbody>
        </table>

        {canUpdate && (
            <div className={`
                transition-opacity duration-300 ease-[ease] max-w-[15rem] mt-4 mx-auto mb-0
                ${hasChanged > lastSubmit ? '' : 'opacity-0'}
            `}>
                <SubmitButton
                    color="primary"
                    success={formState.success}
                    pending={formState.pending}
                    generalErrors={formState.errors}
                    onClick={handleSubmit}
                >Lagre</SubmitButton>
            </div>
        )}
    </>
}
