# Publishing Ama Monster OS

**Status: 0.7.0 Stable is prepared but not tagged yet.** The latest published
release is 0.6.12; the Market submission is still manual and has not been
created. The 0.7.0 tree also carries the post-review fixes: one long-lived
Steam login service, non-blocking Steam probes, strict OpenID callback
validation, panel-only entries hidden from the agent, and a plugin-level
integration test.

- Version: `0.7.0` (displayed as **0.7.0**)
- Channel: **stable**
- Tag used by the CLI: `v0.7.0`
- Local build: `D:\NEKO.OS\dist\ama_monster_os.neko-plugin` (Windows build; the
  CI asset is built on Linux, so the two packages are not byte-identical)
- Market: **pending** — submit the GitHub Release to the stable channel
  manually

## Published history

### 0.6.12

- Release: https://github.com/mintpixiu/n.e.k.o_plugin_ama_monster_os/releases/tag/v0.6.12
- Tag: `v0.6.12` → source commit `eeedcb1`
- Release asset: `ama_monster_os.neko-plugin`, sha256
  `3ed2a9bdbb7ee3ae228bdacf7788b7a6e826807c1b1a4c40313424052b5793fd`
- Evidence: `ama_monster_os.market-release-check.txt` + `market-evidence.json`
- The release workflow ran `neko-plugin check --release`: tests passed, the
  package built, and the payload hash was verified. The evidence files record
  `source_commit = eeedcb1`, `version = 0.6.12`, and `ref_name = v0.6.12`.

## Publishing 0.7.0

1. Bump `[plugin].version` in `plugin.toml` to a number that has never been
   published, and update the version strings in README, DESIGN, docs headers,
   i18n and tests (already done for 0.7.0).
2. Run the release checks from the N.E.K.O source checkout:

   ```powershell
   uv run neko-plugin check -r "D:\NEKO.OS\ama_monster_os" --target-dir "D:\NEKO.OS\dist"
   ```

3. Commit and push the plugin repository.
4. Create the GitHub Release (and, when the Market submission is ready, notify
   the Market):

   ```powershell
   # GitHub Release only
   uv run neko-plugin publish github "D:\NEKO.OS\ama_monster_os"

   # GitHub Release + Market stable notification (requires a passed review)
   uv run neko-plugin publish "D:\NEKO.OS\ama_monster_os"
   ```

## First review

The first Market publication also needs the normal first-review submission for
the GitHub repository. Follow the official flow:

1. Submit the repository for review.
2. Wait for approval.
3. Create the Release and publish the stable version.

## Version rules

- Manifest version: `0.7.0`
- Display version: `0.7.0`
- Tag created by the CLI: `v0.7.0`
- Stable versions cannot be republished with the same number. Bump the version
  in `plugin.toml` for every later stable release.
- The `0.6.x-beta` line stays beta history; never publish a beta tag to the
  stable channel.
- The GitHub Release workflow builds and uploads the `.neko-plugin` asset and
  release evidence; the Market publication still needs the matching publish
  step or a manual submission from the Release page.
