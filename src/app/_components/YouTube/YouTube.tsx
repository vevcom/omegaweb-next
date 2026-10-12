import styles from './YouTube.module.scss'

type PropTypes = {
    src: string,
    title: string,
}

function YouTube({ src, title }: PropTypes) {
    return <div className={styles.YouTube}>
        <iframe
            title={title}
            allowFullScreen
            className={styles.YouTubeIframe}
            src={src.replace('/watch?v=', '/embed/')} />
    </div>
}

export default YouTube
