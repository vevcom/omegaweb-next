# Deploying to Kubernetes

This directory holds the manifests for running the app on Kubernetes: the generic shape of
one installation, with nothing about where it runs. Domains, certificates, buckets, backups
and the release that runs are an installation's business and live with whoever runs one. Ours
is [vivat](https://github.com/vevcom/vivat), which deploys omega.ntnu.no with Argo CD. The
compose files stay for development and tests.

```
deploy/
├── base/              # The app, the worker, the migrate job and the database
│   └── postgres.env   # The Postgres version, read here and by the compose files
├── overlays/
│   └── local/         # k3d on a workstation: locally built images, no TLS, store on the volume or S3
└── k3d/               # Local cluster config and up.sh
```

## What base expects

An overlay includes `base` and fills in what it leaves open:

- **Images.** The manifests name the images `omegaweb-next` and `omegaweb-next-tools`. The
  overlay sets the registry and the tag with `images:`. A release pushes
  `ghcr.io/vevcom/omegaweb-next:<tag>` and `ghcr.io/vevcom/omegaweb-next-tools:<tag>`, and
  the packages are private because the build bakes in `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, so
  the overlay also adds a pull secret.
- **The ingress host.** `ingress.yaml` routes `placeholder.invalid`. The overlay patches in its
  hosts and TLS.
- **The environment.** Every pod reads the `omegaweb-next-env` secret, with the variables of
  `.env.default`, and the `omegaweb-next-config` ConfigMap generated here, whose keys win.
  How the secret gets there is up to the overlay. The local one builds it from `.env`.
- **The sites.** Every pod mounts the `omegaweb-next-sites` ConfigMap as `sites.json`, which
  maps hosts to sites, and none start without it. The overlay generates it from its own file. A
  changed file rolls the pods. The ingress has to list the same hosts, aliases included, since
  the app sends aliases on itself, and the auth host when the file sets one apart with
  `"auth": true`, which is where everyone signs in and the one host Feide calls back to.
- **The database.** `database.yaml` is a CloudNativePG Cluster, so the operator has to be
  installed. It creates the `omegaweb-next-db-app` secret, whose `uri` key the pods read as
  `DB_URI`. Storage size and backups are patched in by the overlay.
- **The webmail.** `EMAIL_WEBMAIL_URL` is the origin of the mail server's webmail, whose host
  is also the mail domain the aliases' mailboxes are on, and the client id the webmail signs in
  through the provider with. Left unset, no alias keeps a mailbox. The mail server's own settings
  for this are documented in mail-infrastructure.
- **The chat.** `CHAT_AUTH_URL` is the origin of the chat's sign in, MAS, whose host is the
  client id it signs users in through the provider with. Left unset, the provider knows no chat.
  The chat's own settings for this are documented in chat-infrastructure. `CHAT_CLIENT_URL` is the
  origin of the chat client, which a user's chat page links to. Left unset, nothing links to it.
- **The chat sync.** `CHAT_HOMESERVER_URL` is Synapse and `CHAT_MAS_URL` MAS's admin api, both as
  the worker reaches them inside the cluster, and `CHAT_SERVER_NAME` is the server name of the
  homeserver. `CHAT_AS_TOKEN` and `CHAT_MAS_CLIENT_SECRET` are secrets the chat has too. With all
  five set, the worker keeps the homeserver's accounts and spaces in step with the database. Left
  unset, nothing is synced.
- **The store.** Uploaded images and ombul pdfs are on the store volume, which base mounts at
  `store/` in the app, the worker and the migrate job, and in an S3 bucket when
  `STORE_S3_BUCKET` is set, with `STORE_S3_ENDPOINT`, `STORE_S3_ACCESS_KEY_ID` and
  `STORE_S3_SECRET_ACCESS_KEY`. See [The store](#the-store).

A sync applies in waves: the database and the environment first, then the migrate job, which
runs `migrate:deploy-and-seed`, then the app and the worker. A failed migration stops the sync,
so the old pods keep serving.

## The store

Without a bucket every file is on the volume. With one, the code says per kind of file where it
should be: originals and pdfs in the bucket, and the resized image variants on the volume, since
they can be made again and the bucket has a limit on objects. A file the wanted place refuses is
written to the other. The database remembers where each file is, and the store's workers move the
files that are in the wrong place. So setting a bucket, or changing where a kind of file should
be, needs no copying by hand.

The volume is a `ReadWriteOnce` claim of 5Gi, which works while every pod runs on one node, and it
is not backed up. Deleting an object from a versioned bucket keeps its old versions, so expire the
noncurrent versions if the bucket's count of objects does not drop.

**Taking the bucket away** does need a step first. Once `STORE_S3_BUCKET` is unset, a file the
database places in the bucket can be neither read nor moved, and is a 404 until the bucket is set
again. So empty it first: release with `preferredLocation: 'VOLUME'` for the purposes kept in the
bucket, with the bucket still set, wait for the workers to move the files, and unset it once
`SELECT count(*) FROM "StoreFile" WHERE location = 'S3'` is 0.

**Losing the volume** costs what was only there:

- The image variants come back on their own. The store's worker finds the variants whose content
  is gone, and the image worker makes them again from the originals, one image at a time. Until
  it has caught up an image shows its blur placeholder. A volume that is not mounted looks the
  same as a lost one, and sets off the same work.
- Originals and pdfs are on the volume only when the bucket refused them, until the worker has
  moved them there. That is the state right after the first release with this store, while the
  bucket is at its limit. One that is lost is gone: the worker logs it as an error on every run,
  with the image or the ombul it belonged to, until it is uploaded again.

## Trying it locally

You need Docker and the tools in the repo's flake, which `nix develop` puts on your path.

```bash
./deploy/k3d/up.sh                 # cluster, CNPG, images, secrets, overlay
open http://omegaweb-next.localhost:8080
k3d cluster delete omegaweb-next     # tear down
```

`up.sh` applies the local overlay with `kubectl` and does not use Argo CD. To try Argo CD
itself, push your branch, set it as `targetRevision` in vivat's
`clusters/local/omegaweb.yaml` and start from a fresh cluster:

```bash
k3d cluster delete omegaweb-next
./deploy/k3d/up.sh --argocd          # Argo CD deploys the pushed branch
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
kubectl -n argocd port-forward svc/argocd-server 8443:443
```

The store is on the volume alone unless `deploy/k3d/.env.local`, which is gitignored, sets the
`STORE_S3_*` variables from `.env.default`. Those go into the app's secret with the rest.

## Releasing

Publishing a GitHub release runs `.github/workflows/release.yml`, which builds the images and
pushes them to GHCR under the release tag. What happens next is the installation's: for ours,
the workflow opens a pull request on vivat that points prod at the release, and vivat's README
says how a deploy and a rollback work from there.
