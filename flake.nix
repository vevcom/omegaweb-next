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
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            # Same major as the Docker image (see NODE_VERSION in Dockerfile)
            nodejs_24
            openssl # Prisma probes it to pick an engine build
            postgresql # psql for poking at the dev database
          ];

          env = {
            NEXT_TELEMETRY_DISABLED = "1";
          }
          // pkgs.lib.optionalAttrs pkgs.stdenv.hostPlatform.isLinux {
            # The schema engine Prisma downloads is dynamically linked and does not run on
            # NixOS, so use the nixpkgs build. Keep its version in step with `prisma` in
            # package.json, or migrations may refuse to run.
            PRISMA_SCHEMA_ENGINE_BINARY = "${pkgs.prisma-engines_7}/bin/schema-engine";
          };

          shellHook = ''
            export PATH="$PWD/node_modules/.bin:$PATH"
          '';
        };
      });
    };
}
