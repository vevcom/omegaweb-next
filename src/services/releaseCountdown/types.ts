export type ReleaseCountdownSettings = {
    releaseDate: Date,
    /**
     * Whether anyone may walk past the countdown (with the button on it), rather than only those
     * who know the password.
     */
    openToAll: boolean,
}
