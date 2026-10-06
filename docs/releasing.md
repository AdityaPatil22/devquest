# Releasing DevQuest

This document describes the release process for the current DevQuest implementation.

## 1. Update Versions

Keep the plugin and marketplace versions synchronized.

Update:

```text
.claude-plugin/marketplace.json
plugin/.claude-plugin/plugin.json
```

For example:

```json
"version": "1.1.0"
```

Also update `CHANGELOG.md` with:

- release version
- release date
- notable changes
- fixes
- breaking changes, if any

## 2. Validate the Repository

From the repository root, run:

```bash
make test
make build
```

Both commands must complete successfully before creating the release.

## 3. Verify the Plugin Locally

Install the local marketplace and plugin:

```bash
claude plugin marketplace add ./
claude plugin install devquest@devquest
```

Start DevQuest:

```text
/devquest
```

Verify that the runtime starts successfully and the game is available at:

```text
http://localhost:5173
```

## 4. Verify the Complete Gameplay Flow

The release candidate should be tested using the current gameplay flow:

1. Start a new DevQuest session.
2. Enter an engineering problem in BootScene.
3. Receive the initial Decision Room.
4. Verify that four options are displayed.
5. Walk to a door and press `E`.
6. Enter optional context.
7. Confirm the selected option.
8. Verify that the Corridor is generated and aligned with the selected door.
9. Verify that the player can move through the Corridor while Claude generates the next decision.
10. Verify that the Corridor exit remains blocked until the next decision is ready.
11. Verify that the Options Room is generated and aligned with the Corridor.
12. Select another option.
13. Repeat the Corridor → Options Room loop.
14. Verify that final document generation starts when the problem is sufficiently explored.
15. Verify that the session transitions to the Trophy Room.
16. Verify that the final implementation document is displayed.
17. Refresh or reconnect during a session and verify that the existing session resumes correctly.

Do not use challenge, challenge-response, evaluation, reconsideration, or separate interview stages as release criteria unless those features are reintroduced into the current implementation.

## 5. Verify Documentation

Before releasing, verify that:

- `README.md` reflects the current gameplay.
- `README.md` contains the current demo.
- Documentation links in `README.md` resolve correctly.
- `docs/gameplay.md` matches the current game flow.
- `docs/architecture.md` matches the current architecture.
- `docs/networking.md` matches the current protocol.
- `docs/persistence.md` matches the current session behavior.
- `docs/plugin.md` matches the current Claude Code plugin behavior.
- `docs/CLAUDE.md` does not describe removed gameplay.
- `AGENTS.md` does not describe removed gameplay.

## 6. Verify the Release Build

Run:

```bash
make build
```

Confirm that:

```text
apps/game/dist/
```

is generated successfully and that the resulting frontend can be served by the backend when using the production/static configuration.

## 7. Create the Release Commit

Review the changes:

```bash
git status
git diff
```

Commit the release changes:

```bash
git add .
git commit -m "Release v1.1.0"
```

Replace `1.1.0` with the actual release version.

## 8. Create the Git Tag

Create the version tag:

```bash
git tag v1.1.0
```

Push the commit and tag:

```bash
git push origin master
git push origin v1.1.0
```

## 9. Create the GitHub Release

Create a GitHub Release for the new tag.

The release should include:

- release summary
- notable changes
- bug fixes
- breaking changes, if any
- installation/update instructions
- known limitations

Use the corresponding version from:

```text
.claude-plugin/marketplace.json
plugin/.claude-plugin/plugin.json
```

## 10. Post-Release Verification

After publishing the release:

1. Verify the GitHub Release exists.
2. Verify the tag points to the intended commit.
3. Verify the marketplace version is correct.
4. Verify the plugin can be installed from the published marketplace.
5. Start a new `/devquest` session.
6. Verify the complete gameplay flow once more.

## Release Checklist

```text
[ ] Version updated in marketplace.json
[ ] Version updated in plugin.json
[ ] CHANGELOG.md updated
[ ] make test passes
[ ] make build passes
[ ] Local plugin installation verified
[ ] New session verified
[ ] Decision Room verified
[ ] Door selection verified
[ ] Context submission verified
[ ] Corridor generation verified
[ ] Corridor processing verified
[ ] Options Room generation verified
[ ] Repeated decision loop verified
[ ] Final document generation verified
[ ] Trophy Room verified
[ ] Session resume verified
[ ] README verified
[ ] Documentation verified
[ ] Release commit created
[ ] Git tag created
[ ] GitHub Release published
[ ] Published plugin installation verified
```