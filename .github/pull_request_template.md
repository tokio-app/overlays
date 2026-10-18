# Pull Request

<!--
1. Give the PR a descriptive title.

  Examples of good titles:
    - [Overlay]: Add a gift goal overlay
    - [Bug]: Fix the likes counter after a reconnect
    - [FR]: Let the chat overlay hide commands

  Examples of bad titles:
    - fix #12
    - update overlay

2. Reference the related issue in the description.
3. Open it as a draft while you're still working on it.
-->

## Description

Summarize the change and the related issue. List any new dependencies.

Fixes # (issue)

## Type of Change

- [ ] New overlay
- [ ] Bug fix in an overlay
- [ ] New feature in an overlay
- [ ] Breaking change (streamers have to set the overlay up again)
- [ ] Tooling, workflows or docs

## Checklist

- [ ] Each overlay I changed has a new version in both `info.yaml` and `package.json`. Without it, the overlay isn't released.
- [ ] `yarn release:build` passes.
- [ ] I imported the built overlay (its `dist/` folder) into Tokio and tested it in OBS Studio or TikTok LIVE Studio.
- [ ] `preview.png` shows the overlay's current look.
- [ ] New dependencies have permissive licenses (MIT, ISC, BSD, Apache-2.0). Ask before adding anything copyleft (GPL, AGPL, LGPL, MPL, CC BY-SA).
- [ ] Commits follow Conventional Commits, scoped to the overlay, e.g. `feat(gift-goal): ...`.

## Screenshots or GIF

## Additional Notes

Add any other context about the pull request here.
