
type PropTypes = {
    params: Promise<{
        category: string
    }>,
}

export default async function ArticleCategory({ params }: PropTypes) {
    const category = decodeURIComponent((await params).category)
    return (
        <div className="w-full h-full flex items-center justify-center [&>p]:border-l [&>p]:border-surface-subtle [&>p]:ml-2 [&>p]:pl-2">
            <h2>{category.toUpperCase()}</h2>
            <p>Velg en artikel i navigasjonsmenyen</p>
        </div>
    )
}
