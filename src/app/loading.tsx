import Loader from '@/components/Loader/Loader'

export default function loading() {
    return (
        <div className="bg-surface-base grid place-items-center place-content-center flex-1 min-h-full">
            <Loader />
        </div>
    )
}
