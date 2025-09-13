{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.05";
    systems.url = "github:nix-systems/default";
    devenv = {
      url = "github:cachix/devenv";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    # does not follow anything
    flake-utils.url = "github:numtide/flake-utils";
    utils = {
      url = "github:alanscodelog/nix-devenv-utils";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };
  nixConfig = {
    extra-trusted-public-keys = "devenv.cachix.org-1:w1cLUi8dv3hnoSPGAuibQv+f9TZLr6cv/Hm9XgU50cw=";
    extra-substituters = "https://devenv.cachix.org";
  };
  outputs =
    { self
    , nixpkgs
    , devenv
    , systems
    , utils
    , ...
    } @ inputs:
    let
      forEachSystem = nixpkgs.lib.genAttrs (import systems);
    in
    {
      packages = forEachSystem (system: {
        devenv-up = self.devShells.${system}.default.config.procfileScript;
        devenv-test = self.devShells.${system}.default.config.test;
      });

      devShells = forEachSystem
        (system:
          let
            overlay = final: prev: { };
            pkgs = import nixpkgs {
              inherit system;
              overlays = [ overlay ];
            };
          in
          {
            default = devenv.lib.mkShell {
              inherit inputs pkgs;
              modules =
                let
                in
                [
                utils.devenvModule
                  ({ pkgs, config, ... }: {
                    custom.js.nodejs.package = pkgs.nodejs_24;
                  })
                ];
            };
          });
    };
}
