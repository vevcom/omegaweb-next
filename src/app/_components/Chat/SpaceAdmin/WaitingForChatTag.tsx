export default function WaitingForChatTag({ children }: { children: string }) {
    return (
        <span className="px-2 rounded-round border text-s whitespace-nowrap border-base-content/80 text-base-content/80">
            {children}
        </span>
    )
}
