# Deploying with k3s and Argo CD

Production runs on k3s and is deployed by Argo CD. This directory holds the app's own
manifests. The rest of the cluster lives in [vivat](https://github.com/vevcom/vivat):
Argo CD's applications, the operators and the Let's Encrypt issuer. The compose files
stay for development and tests.

```
deploy/
├── base/              # The app, the worker, the migrate job and the database
├── overlays/
│   ├── local/         # k3d on a workstation: locally built images, no TLS, store on disk or S3
│   └── prod/          # sctomega.com: release images, TLS, backups, Phase secrets, S3 store
└── k3d/               # Local cluster config and up.sh
```

## How a deploy works

1. Publishing a GitHub release runs `.github/workflows/release.yml`. It builds the
   `prod` and `tools` images and pushes them to GHCR under the release tag.
2. The workflow opens a pull request that sets that tag in `overlays/prod`.
3. Merging the pull request is the deploy. The `omegaweb` application, which vivat
   defines, sees main change and syncs in waves:
   - wave -3: the database and the PhaseSecret
   - wave -1: the migrate job, which runs `migrate:deploy-and-seed`, and locally the store
     volume it is the first to mount
   - wave 0: the app and the worker

   A failed migration stops the sync, so the old pods keep serving.
4. A rollback is a revert of that pull request.

## Trying it locally

You need the tools from `~/dotfiles/modules/kubernetes.nix` and Docker.

```bash
./deploy/k3d/up.sh                 # cluster, CNPG, images, secrets, overlay
open http://projectnext.localhost:8080
k3d cluster delete projectnext     # tear down
```

`up.sh` applies the overlay with `kubectl` and does not use Argo CD. To try Argo CD
itself, push your branch, set it as `targetRevision` in vivat's
`clusters/local/omegaweb.yaml` and start from a fresh cluster:

```bash
k3d cluster delete projectnext
./deploy/k3d/up.sh --argocd          # Argo CD deploys the pushed branch
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
kubectl -n argocd port-forward svc/argocd-server 8443:443
```

The store is on disk unless `deploy/k3d/.env.local`, which is gitignored, sets the
`STORE_S3_*` variables from `.env.default`. Those go into the app's secret with the rest.

## Secrets

The app's environment lives in Phase. In prod, the Phase operator reads it into the
`projectnext-env` secret, as set up in `overlays/prod/phase-secret.yaml`, and keeps it in
sync. Only two secrets are created by hand, once per cluster: the Phase service token the
operator logs in with, and the pull secret for the private images.

The operator does not restart the app, so after changing a secret in Phase run
`kubectl -n projectnext rollout restart deployment`.

Locally, `up.sh` makes `projectnext-env` from `.env` instead.

## The store

Uploaded images, ombul pdfs and the release countdown's files go to S3 when
`STORE_S3_BUCKET` is set, and to the `store/` directory otherwise. Prod uses NTNU's
object storage at `https://s3.stack.it.ntnu.no`, and k3d and compose use the disk.
Object keys are the paths under `store/`, so a directory can be copied to the bucket as it is.

Turn on versioning for the bucket, so a deleted file can be brought back after a database
restore:

```bash
aws s3api put-bucket-versioning --bucket <bucket> --versioning-configuration Status=Enabled \
    --endpoint-url https://s3.stack.it.ntnu.no
```

NTNU does not back the bucket up, so copy it somewhere else nightly with `rclone copy`.
Use `copy`, not `sync`, so deletes never reach the copy.

## Moving production off Dokploy

1. **Install k3s on the Debian box.** Dokploy holds ports 80 and 443 through
   Traefik on Docker Swarm, so either use a fresh VM or plan a short outage
   for the switch.
2. **Install Argo CD** with Helm, as in the local steps.
3. **Fill in the TODOs.** Set the backup bucket in `overlays/prod/database-patch.yaml`, the store bucket in
   `overlays/prod/kustomization.yaml` and the Phase app id in `overlays/prod/phase-secret.yaml`.
4. **Set up S3.** Create the store and backup buckets on stack.it, turn on versioning for
   the store, and make keys with `openstack ec2 credentials create`. Add the store keys to
   Phase as `STORE_S3_ACCESS_KEY_ID` and `STORE_S3_SECRET_ACCESS_KEY`. The database
   backups use the same keys, since EC2 keys reach every bucket in the project.
5. **Create the two hand-made secrets.** Read the token with `read -s` so it stays out of
   the shell history.

   ```bash
   kubectl create namespace projectnext
   read -s PHASE_TOKEN
   kubectl -n projectnext create secret generic phase-service-token --from-literal=token="$PHASE_TOKEN"
   kubectl -n projectnext create secret docker-registry ghcr-pull --docker-server=ghcr.io \
       --docker-username=<user> --docker-password=<read:packages token>
   ```

6. **Set up GitHub.** Add the secret `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and the
   variable `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, and keep both GHCR packages private.
7. **Bootstrap Argo CD** from vivat, as its README describes.
8. **Move the data.** Stop the Dokploy stack, then `pg_dump` the Dokploy database
   into the `projectnext-db` cluster with `pg_restore`. Copy the `store` volume to the
   bucket with `rclone copy <store volume> s3:<bucket>`. Then point DNS at the new box.
