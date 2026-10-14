import styles from './InfoBubbles.module.scss'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
    faHeart,
    faFutbol,
    faSuitcase
} from '@fortawesome/free-solid-svg-icons'

function InfoBubbles() {
    return (
        <div className={styles.InfoBubbles}>
            <div className={styles.bubble}>
                <div className={styles.icon}>
                    <FontAwesomeIcon icon={faHeart} />
                </div>
                <div className={styles.heading}>Sosialt</div>
                <div className={styles.text}>
                Sct. Omega Broderskaps mål er å skape et fargerikt sosialt liv for studenter
                ved studiene for Elektronisk Systemdesign og Innovasjon, og Kybernetikk og Robotikk.
                </div>
            </div>
            <div className={styles.bubble}>
                <div className={styles.icon}>
                    <FontAwesomeIcon icon={faFutbol} />
                </div>
                <div className={styles.heading}>Komitéer</div>
                <div className={styles.text}>
                Linjeforeningen består av 17 komitéer som alle inkluderer
                studenter på et bredt spekter,
                med alt fra revy til store fester som Phaestum Immatricularis.
                </div>
            </div>
            <div className={styles.bubble}>
                <div className={styles.icon}>
                    <FontAwesomeIcon icon={faSuitcase} />
                </div>
                <div className={styles.heading}>Næringsliv</div>
                <div className={styles.text}>
                Omega har kontakt med mange bedrifter og jobber kontinuerlig med å skape
                et godt forhold mellom studenten og en fremtidig arbeidsplass.
                </div>
            </div>
        </div>
    )
}

export default InfoBubbles
