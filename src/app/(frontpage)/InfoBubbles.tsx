import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faHeart,
    faFutbol,
    faSuitcase
} from '@fortawesome/free-solid-svg-icons'

const bubble = 'm-10 flex flex-col items-center justify-start'
const icon = [
    'size-[150px] rounded-full bg-accent-blue flex items-center justify-center mb-4',
    '[&>svg]:size-[75px] [&>svg]:text-text',
].join(' ')
const heading = 'text-xl font-bold'
const text = 'text-m font-light leading-[1.7em] text-center'

function InfoBubbles() {
    return (
        <div className={[
            'w-full bg-layer backdrop-brightness-[0.2] text-text py-40 px-[10vw]',
            'flex flex-row justify-around items-start max-mobile:flex-col',
        ].join(' ')}>
            <div className={bubble}>
                <div className={icon}>
                    <FontAwesomeIcon icon={faHeart} />
                </div>
                <div className={heading}>Sosialt</div>
                <div className={text}>
                Sct. Omega Broderskaps mål er å skape et fargerikt sosialt liv for studenter
                ved studiene for Elektronisk Systemdesign og Innovasjon, og Kybernetikk og Robotikk.
                </div>
            </div>
            <div className={bubble}>
                <div className={icon}>
                    <FontAwesomeIcon icon={faFutbol} />
                </div>
                <div className={heading}>Komitéer</div>
                <div className={text}>
                Linjeforeningen består av 17 komitéer som alle inkluderer
                studenter på et bredt spekter,
                med alt fra revy til store fester som Phaestum Immatricularis.
                </div>
            </div>
            <div className={bubble}>
                <div className={icon}>
                    <FontAwesomeIcon icon={faSuitcase} />
                </div>
                <div className={heading}>Næringsliv</div>
                <div className={text}>
                Omega har kontakt med mange bedrifter og jobber kontinuerlig med å skape
                et godt forhold mellom studenten og en fremtidig arbeidsplass.
                </div>
            </div>
        </div>
    )
}

export default InfoBubbles
