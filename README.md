# Invoke AMBuild GitHub Action

This action automates installing and invoking [AMBuild](https://github.com/alliedmodders/ambuild).

## Inputs

### `auto-install`

**Required** Should this action automatically install a copy of AMBuild? Default `"true"`

### `build-folder`

**Required** The name of the folder to execute the build in. Default: `"build"`

### `project-root`

**Required** The root directory containing your 'configure.py'. Default: `"./"`

### `delete-build`

Should this action delete the build folder after the build completes? Default: `"false"`

## Example usages

```yaml
uses: WildCard65/invoke-ambuild@v1.0-fin
with:
  build-folder: out/bin/
  project-root: src/
  delete-build: true
```

```yaml
uses: WildCard65/invoke-ambuild@v1.0-fin
with:
  auto-install: false
```
