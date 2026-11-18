{
  description = "Omegaweb Next development shell";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      devShells = forAllSystems (
        pkgs:
        let
          shell =
            extraPackages:
            pkgs.mkShell {
              packages =
                with pkgs;
                [
                  # Same major as the Docker image (see NODE_VERSION in Dockerfile)
                  nodejs_24
                  openssl # Prisma probes it to pick an engine build
                  postgresql # psql for poking at the dev database
                  # deploy/k3d/up.sh and the manifests workflow
                  k3d
                  kubectl
                  kubernetes-helm
                  kustomize
                  kubeconform
                ]
                ++ extraPackages;

              env = {
                NEXT_TELEMETRY_DISABLED = "1";
              }
              // pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
                # The schema engine Prisma downloads is dynamically linked and does not run on
                # NixOS, so use the nixpkgs build. Keep its version in step with `prisma` in
                # package.json, or migrations may refuse to run.
                PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines_7}/bin/schema-engine";
              };

              # The extra packages go first, so a claude in node_modules cannot shadow the sandboxed one
              shellHook = ''
                export PATH="${pkgs.lib.concatMapStrings (package: "${package}/bin:") extraPackages}$PWD/node_modules/.bin:$PATH"
              '';
            };

          # Runs the claude already on PATH with only the repository, its own config and the Nix
          # store visible. /run is left out since it holds the Docker socket, which is root on the host.
          isolatedClaude = pkgs.writeShellScriptBin "claude" ''
            self=$(readlink -f "$0")
            real=
            while IFS= read -r candidate; do
              real=$(readlink -f "$candidate")
              if [ "$real" != "$self" ]; then break; fi
              real=
            done < <(type -ap claude)
            if [ -z "$real" ]; then echo "claude is not installed" >&2; exit 1; fi
            repo=$(git rev-parse --show-toplevel) || { echo "run claude inside a git repository" >&2; exit 1; }
            # A repository at the home directory, such as dotfiles, would bind the whole home back in
            case "$HOME/" in "''${repo%/}/"*) echo "the repository must be a folder inside your home" >&2; exit 1;; esac
            # A linked worktree keeps its objects and refs in the main repository's .git
            gitdir=$(git rev-parse --path-format=absolute --git-common-dir) || exit 1
            mkdir -p "$HOME/.claude"
            touch "$HOME/.claude.json"
            # Only these reach the sandbox, so a token exported in the shell profile does not
            env=()
            for name in HOME PATH TERM COLORTERM LANG USER SHELL EDITOR ANTHROPIC_API_KEY \
                HTTP_PROXY HTTPS_PROXY NO_PROXY NEXT_TELEMETRY_DISABLED PRISMA_SCHEMA_ENGINE_BINARY; do
              [ -n "''${!name+x}" ] && env+=(--setenv "$name" "''${!name}")
            done
            # The host's bwrap is allowed user namespaces where the Nix one is not, as on Ubuntu 24.04
            bwrap=$(command -v bwrap || echo ${pkgs.bubblewrap}/bin/bwrap)
            exec "$bwrap" --clearenv "''${env[@]}" \
              --ro-bind /nix /nix \
              --ro-bind /etc /etc \
              --ro-bind-try /bin /bin \
              --ro-bind-try /usr /usr \
              --ro-bind-try /lib /lib \
              --ro-bind-try /lib64 /lib64 \
              --ro-bind-try /run/current-system /run/current-system \
              --ro-bind-try /run/systemd/resolve /run/systemd/resolve \
              --proc /proc --dev /dev --tmpfs /tmp \
              --tmpfs "$HOME" \
              --ro-bind "$real" "$real" \
              --ro-bind-try "$HOME/.nix-profile" "$HOME/.nix-profile" \
              --ro-bind-try "$HOME/.local/state/nix" "$HOME/.local/state/nix" \
              --ro-bind-try "$HOME/.gitconfig" "$HOME/.gitconfig" \
              --ro-bind-try "$HOME/.config/git" "$HOME/.config/git" \
              --bind "$HOME/.claude" "$HOME/.claude" \
              --bind "$HOME/.claude.json" "$HOME/.claude.json" \
              --bind "$repo" "$repo" \
              --bind "$gitdir" "$gitdir" \
              --setenv TMPDIR /tmp \
              --unshare-all --share-net --die-with-parent \
              --chdir "$PWD" \
              "$real" "$@"
          '';
        in
        {
          default = shell [ ];
        }
        // pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
          isolate = shell [ isolatedClaude ];
        }
      );
    };
}
