#!/usr/bin/env bash
# Brings the local overlay up on a k3d cluster, for trying the manifests and the
# images on a workstation. Safe to re-run: it rebuilds the images and re-applies
# everything. Tear down with `k3d cluster delete projectnext`.
#
# With --argocd it installs Argo CD instead of applying the overlay, and Argo CD
# deploys the branch named in deploy/argocd/local from GitHub, so push it first.
set -euo pipefail

argocd=false
[[ ${1:-} == --argocd ]] && argocd=true

cd "$(dirname "$0")/../.."
cluster=projectnext
namespace=projectnext
secrets=deploy/k3d/.env.local

k3d cluster list "$cluster" >/dev/null 2>&1 || k3d cluster create --config deploy/k3d/cluster.yaml

if ! $argocd; then
    helm repo add cnpg https://cloudnative-pg.github.io/charts --force-update >/dev/null
    helm upgrade --install cnpg cnpg/cloudnative-pg --version 0.24.0 \
        --namespace cnpg-system --create-namespace --wait
fi

# Production refuses the development secrets in .env, so the cluster gets its own,
# generated once and kept in a gitignored file.
if [[ ! -f $secrets ]]; then
    key=$(mktemp)
    openssl ecparam -name prime256v1 -genkey -noout -out "$key"
    {
        echo "NEXTAUTH_SECRET=$(openssl rand -base64 32)"
        echo "JWT_SECRET=$(openssl rand -base64 32)"
        echo "PASSWORD_ENCRYPTION_KEY=$(openssl rand -base64 32)"
        echo "API_KEY_ENCRYPTION_KEY=$(openssl rand -base64 32)"
        echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$(openssl rand -base64 32)"
        echo "JWT_PRIVATE_KEY=$(base64 -w0 "$key")"
        echo "JWT_PUBLIC_KEY=$(openssl ec -in "$key" -pubout 2>/dev/null | base64 -w0)"
    } > "$secrets"
    rm "$key"
fi

# `kubectl create secret --from-env-file` would keep the quotes and inline comments
# in .env as part of the values. ${...} references stay unexpanded, which only
# affects DB_URI, and the pods take that from the database secret instead.
env_file=$(mktemp)
trap 'rm -f "$env_file"' EXIT
awk '
    /^[[:space:]]*(#|$)/ { next }
    {
        key = substr($0, 1, index($0, "=") - 1)
        value = substr($0, index($0, "=") + 1)
        quote = substr(value, 1, 1)
        if (quote == "\"" || quote == "'\''") {
            value = substr(value, 2)
            value = substr(value, 1, index(value, quote) - 1)
        } else {
            sub(/[[:space:]]+#.*$/, "", value)
            sub(/[[:space:]]+$/, "", value)
        }
        values[key] = value
        if (!(key in seen)) { seen[key] = 1; order[++count] = key }
    }
    END { for (i = 1; i <= count; i++) print order[i] "=" values[order[i]] }
' .env "$secrets" > "$env_file"
actions_key=$(grep '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=' "$env_file" | cut -d= -f2-)
stripe_key=$(grep '^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=' "$env_file" | cut -d= -f2- || true)

for target in prod tools; do
    image=ghcr.io/vevcom/project-next:local
    [[ $target == tools ]] && image=ghcr.io/vevcom/project-next-tools:local
    docker build --target "$target" -t "$image" \
        --build-arg NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$actions_key" \
        --build-arg NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$stripe_key" .
    k3d image import "$image" --cluster "$cluster"
done

kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$namespace" create secret generic projectnext-env --from-env-file="$env_file" \
    --dry-run=client -o yaml | kubectl apply -f -

if $argocd; then
    helm repo add argo https://argoproj.github.io/argo-helm --force-update >/dev/null
    helm upgrade --install argocd argo/argo-cd --version 10.10.5 \
        --namespace argocd --create-namespace --wait
    kubectl apply -k deploy/argocd/local
    # The first sync installs the operators before the app, so this takes a while.
    kubectl -n argocd wait application/projectnext --for=jsonpath='{.status.health.status}'=Healthy --timeout=20m
    # A rebuilt image keeps its tag, so Argo CD sees nothing to roll out.
    kubectl -n "$namespace" rollout restart deployment
    kubectl -n "$namespace" rollout status deployment --timeout=5m
    echo "Up at http://projectnext.localhost:8080"
    exit
fi

# Without Argo CD's sync waves everything is applied at once, so the migrate job
# would start before the database accepts connections. It is recreated once the
# database is ready, which Argo CD also does for a hook job on every sync.
kubectl apply -k deploy/overlays/local
kubectl -n "$namespace" wait cluster.postgresql.cnpg.io/projectnext-db --for=condition=Ready --timeout=5m
kubectl -n "$namespace" delete job projectnext-migrate --ignore-not-found
kubectl apply -k deploy/overlays/local
kubectl -n "$namespace" wait job/projectnext-migrate --for=condition=Complete --timeout=10m
kubectl -n "$namespace" rollout restart deployment
kubectl -n "$namespace" rollout status deployment --timeout=5m

echo "Up at http://projectnext.localhost:8080"
