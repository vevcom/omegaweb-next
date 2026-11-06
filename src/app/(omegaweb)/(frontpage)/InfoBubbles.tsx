import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faHeart,
    faFutbol,
    faSuitcase
} from '@fortawesome/free-solid-svg-icons'

const bubbleClassName = 'm-10 flex flex-col items-center justify-start'
const iconClassName = `
    size-[150px] rounded-full bg-primary flex items-center justify-center mb-4
    [&>svg]:size-[75px] [&>svg]:text-primary-content text-primary-content
`
const heading = 'text-xl text-white font-bold'
const text = 'text-m text-white font-light leading-[1.7em] text-center'

function InfoBubbles() {
    return (
        <div className="
            w-full bg-layer backdrop-brightness-[0.2] text-base-content py-40 px-[10vw] flex flex-row justify-around items-start
            max-mobile:flex-col
        ">
            <div className={bubbleClassName}>
                <div className={iconClassName}>
                    <FontAwesomeIcon icon={faHeart} />
                </div>
                <div className={heading}>Sosialt</div>
                <div className={text}>
                Sct. Omega Broderskaps mål er å skape et fargerikt sosialt liv for studentene
                på Elektronisk systemdesign og innovasjon og Kybernetikk og robotikk.
                </div>
            </div>
            <div className={bubbleClassName}>
                <div className={iconClassName}>
                    <FontAwesomeIcon icon={faFutbol} />
                </div>
                <div className={heading}>Komitéer</div>
                <div className={text}>
                Linjeforeningen har 17 komitéer som favner bredt,
                med alt fra revy til store fester som Phaestum Immatricularis.
                </div>
            </div>
            <div className={bubbleClassName}>
                <div className={iconClassName}>
                    <FontAwesomeIcon icon={faSuitcase} />
                </div>
                <div className={heading}>Næringsliv</div>
                <div className={text}>
                Omega har kontakt med mange bedrifter og jobber kontinuerlig med å skape
                et godt forhold mellom studentene og fremtidige arbeidsgivere.
                </div>
            </div>
        </div>
    )
}

export default InfoBubbles
