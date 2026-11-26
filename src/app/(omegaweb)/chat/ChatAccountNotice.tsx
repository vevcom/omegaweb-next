type PropTypes = {
    hasChatAccount: boolean,
}

/** How the user signs in to the chat, which is also what gives them their account there. */
export default function ChatAccountNotice({ hasChatAccount }: PropTypes) {
    return (
        <p className="m-0">
            {hasChatAccount
                ? 'Du logger inn på chatten med samme innlogging som her.'
                : 'Du får en konto på chatten første gang du logger inn der, med samme innlogging som her.'}
        </p>
    )
}
