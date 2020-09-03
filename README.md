# Invoke AMBuild GitHub Action

This action automates invoking [AMBuild](https://github.com/alliedmodders/ambuild).

## Inputs

### `build-folder`

The name of the folder to execute the build in. Default: `"build"`

### `project-root`

The root directory containing your 'configure.py'. Default: `"./"`

### `configure-args`

Additional arguments to supply to 'configure.py'.

### `delete-build`

Should this action delete the build folder after the build completes? Default: `"false"`

## Example usages

```yaml
uses: WildCard65/invoke-ambuild@master
with:
  build-folder: out/bin/
  project-root: src/
  delete-build: true
```

```yaml
uses: WildCard65/invoke-ambuild@master
with:
  configure-args: --debug
```
