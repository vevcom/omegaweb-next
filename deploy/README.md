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
│   └── local/         # k3d on a workstation: locally built images, no TLS, store on disk or S3
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
  the app sends aliases on itself.
- **The database.** `database.yaml` is a CloudNativePG Cluster, so the operator has to be
  installed. It creates the `omegaweb-next-db-app` secret, whose `uri` key the pods read as
  `DB_URI`. Storage size and backups are patched in by the overlay.
- **The store.** Uploaded images, ombul pdfs and the release countdown's files go to S3 when
  `STORE_S3_BUCKET` is set, with `STORE_S3_ENDPOINT`, `STORE_S3_ACCESS_KEY_ID` and
  `STORE_S3_SECRET_ACCESS_KEY`, and to the `store/` directory otherwise. Object keys are the
  paths under `store/`, so a directory can be copied to a bucket as it is. On disk, the overlay
  mounts a volume at `store/`, as the local one does.

A sync applies in waves: the database and the environment first, then the migrate job, which
runs `migrate:deploy-and-seed`, then the app and the worker. A failed migration stops the sync,
so the old pods keep serving.

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

The store is on disk unless `deploy/k3d/.env.local`, which is gitignored, sets the
`STORE_S3_*` variables from `.env.default`. Those go into the app's secret with the rest.

## Releasing

Publishing a GitHub release runs `.github/workflows/release.yml`, which builds the images and
pushes them to GHCR under the release tag. What happens next is the installation's: for ours,
the workflow opens a pull request on vivat that points prod at the release, and vivat's README
says how a deploy and a rollback work from there.
