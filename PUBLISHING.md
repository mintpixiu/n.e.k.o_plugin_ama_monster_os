# Publishing Ama Monster OS

**Status: 0.3.4 Beta published to GitHub Releases as a pre-release.** Standard
GitHub Actions evidence is present. The Market Beta submission is still manual
and has not been sent; the API only accepts stable-channel notifications.

- Release: https://github.com/mintpixiu/n.e.k.o_plugin_ama_monster_os/releases/tag/v0.3.4-beta
- Tag: `v0.3.4-beta`
- Package SHA-256: `a0a311189e71ea1d062d7d6728e76ceab6c07dd2d65bc01fa72aa7b40c6eb203`
- Evidence: `market-evidence.json` + `market-release-check.txt`
- Market: pending manual Beta-channel submission
- Standard GitHub Actions evidence: `market-evidence.json` + `market-release-check.txt` present

## Before publishing

```powershell
# From the N.E.K.O source checkout
uv run neko-plugin check -r "D:\NEKO.OS\ama_monster_os" --target-dir "D:\NEKO.OS\dist"
```

Also confirm that the repository is clean and points to the public GitHub
repository named `n.e.k.o_plugin_ama_monster_os`.

## Beta publication

0.2.3 is a **Beta** release. The default `neko-plugin publish` command publishes
to the **stable** channel, so for Beta use the two-step flow:

```powershell
# 1) Create and push tag v0.3.4-beta + the GitHub Release, without notifying Market
uv run neko-plugin publish github "D:\NEKO.OS\ama_monster_os"

# 2) In the N.E.K.O Plugin Market submission page, choose the Beta channel,
#    attach the GitHub Release, add release notes, and confirm.
```

Do not run the full `neko-plugin publish` command for this Beta unless you
intend to publish to `stable`.

## First review

The first Market publication also needs the normal first-review submission for
the GitHub repository. Follow the official flow:

1. Submit the repository for review.
2. Wait for approval.
3. Create the Release and choose the Beta channel.

## Version rules

- Manifest version: `0.3.4-beta`
- Display version: `0.3.4 Beta`
- Tag created by the CLI: `v0.3.4-beta`
- A version published to Beta cannot be republished with the same number to
  Stable; use a new version for a later stable release.

This repository has no automation that publishes to Market. The GitHub release
workflow builds and uploads the `.neko-plugin` asset and release evidence; the
Market Beta submission still needs the manual submission page.
