# Releasing DevQuest

## 1. Update versions

Keep these versions synchronized:

* `.claude-plugin/marketplace.json`
* `plugin/.claude-plugin/plugin.json`

Example:

```json
"version": "1.1.0"
```

## 2. Run validation

```bash
make test
make build
```

Verify the plugin locally:

```bash
claude plugin marketplace add ./
claude plugin install devquest@devquest
```

Run:

```text
/devquest
```

## 3. Verify the complete flow

Test:

1. New session
2. Problem submission
3. Decision selection
4. Challenge
5. Challenge response
6. Next decision
7. Reconsideration
8. Finish
9. Trophy Room
10. Generated decision document

## 4. Push the release

```bash
git tag v1.1.0
git push origin v1.1.0
```

Create a GitHub Release for the tag.

Include:

* release summary
* notable changes
* breaking changes
* installation command
* known limitations

