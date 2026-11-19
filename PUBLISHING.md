# Publishing Ama Monster OS

**Status: 0.6.12 Stable is prepared. No GitHub Release or Market version has
been created for 0.6.12 yet.** The release steps below are manual.

- Version: `0.6.12` (displayed as **0.6.12**)
- Channel: **stable**
- Tag used by the CLI: `v0.6.12`
- Local build: `D:\NEKO.OS\dist\ama_monster_os.neko-plugin`
- Market: **not submitted**; the Stable channel submission is manual

## Before publishing

```powershell
# From the N.E.K.O source checkout
uv run neko-plugin check -r "D:\NEKO.OS\ama_monster_os" --target-dir "D:\NEKO.OS\dist"
```

The release check runs the tests, builds `ama_monster_os.neko-plugin`, verifies
its payload hash, and prints the package SHA-256. Also confirm that the plugin
repository is clean and points to the public GitHub repository named
`n.e.k.o_plugin_ama_monster_os`.

## Stable publication

0.6.12 is a **stable** release, so the full `neko-plugin publish` command targets
the **stable** channel. From the N.E.K.O source checkout:

```powershell
uv run neko-plugin publish "D:\NEKO.OS\ama_monster_os"
```

The command:

1. Confirms the plugin repository is clean and its commit is pushed to `origin`.
2. Runs the release checks, tests, package build, and package verification.
3. Creates and pushes tag `v0.6.12` from the `0.6.12` version in `plugin.toml`.
4. Waits for GitHub Actions to create the GitHub Release and upload
   `ama_monster_os.neko-plugin`, `ama_monster_os.market-release-check.txt`, and
   `market-evidence.json`.
5. Tells the Market to publish that Release to the **stable** channel.

If the first Market review has not passed yet, or you only want the GitHub
Release, create the Release without the Market step:

```powershell
uv run neko-plugin publish github "D:\NEKO.OS\ama_monster_os"
```

Then attach the Release to the Market submission page and choose the stable
channel manually.

## First review

The first Market publication also needs the normal first-review submission for
the GitHub repository. Follow the official flow:

1. Submit the repository for review.
2. Wait for approval.
3. Create the Release and publish the stable version.

## Version rules

- Manifest version: `0.6.12`
- Display version: `0.6.12`
- Tag created by the CLI: `v0.6.12`
- Stable versions cannot be republished with the same number. Bump the version
  in `plugin.toml` for every later stable release.
- The `0.6.5-beta` line stays beta history; never publish `0.6.5-beta` to the
  stable channel.
- The GitHub Release workflow builds and uploads the `.neko-plugin` asset and
  release evidence; the Market notification still needs the matching publish
  step.
