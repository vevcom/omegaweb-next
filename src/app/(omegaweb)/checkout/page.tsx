import Button from '@/components/UI/Button'
import { serverPage } from '@/app/ServerPage'

const { page } = serverPage({
    operation: () => ({}),
    render: () => <div>
        <h1>Betaling</h1>
        <p>Her kommer kassen din!</p>
        <Button>Betal</Button>
    </div>,
})

export default page
