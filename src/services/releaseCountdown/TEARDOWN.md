# Tearing down the release countdown

The countdown is shown instead of the website until the release. Once it is released it has done
its job and everything of it goes. It was kept to as few places as possible so that this is short.
If you are Claude doing this: do each step below, then run the checks at the end.

## Remove

1. `src/app/layout.tsx`: delete the `ReleaseCountdownGate` import and unwrap its children - the
   `<div className={styles.wrapper}>` tree goes back to sitting directly inside `PageTitleProvider`.
   That and the store route's entry (step 5) are the only lines of the countdown outside its own folders.
2. Delete the folder `src/app/_components/ReleaseCountdown/`.
3. Delete the folder `src/services/releaseCountdown/` (this file included).
4. Delete `src/instrumentation.ts`, unless something else has been added to `register` since - then
   only remove the `prepareReleaseCountdown` call and import.
5. `src/app/store/[...path]/route.ts`: delete the `releaseCountdown/gitGraph.json` entry of `SERVED_FILES`.
   With the map then empty, delete `SERVED_FILES` and its lookup in `GET`, and the `'.json'` MIME type,
   which only the git graph needed. The settings file is not served.
6. Delete `tests/services/releaseCountdownGitGraph.test.ts`.
7. `.env.default`: delete the "Release countdown" block (`RELEASE_COUNTDOWN_PASSWORD` and
   `GITHUB_TOKEN`). `docker-compose.base.yml`: delete the same two lines under `environment`.
   Tell whoever runs production to drop the two variables from the deployment's environment as well.
8. The store volume holds `store/releaseCountdown/` (the settings file and the git graph). Nothing
   reads it once the service is gone; delete it from the volume when convenient.

Keep `/store` in `.gitignore` - the store volume is not the countdown's, it only lived there.

## Check

```
grep -rni "releaseCountdown\|RELEASE_COUNTDOWN\|GITHUB_TOKEN\|ReleaseAdmin\|GitGraph" src tests .env.default docker-compose.*.yml
npx tsc --noEmit -p tsconfig.json
npm run lint
```

The grep must come back empty, and the two others clean.
