# System-health widget themes

`tclock-system-health` supports named ANSI color themes for the bundled bottom widget.

## Use a theme

List available themes:

```bash
tclock-system-health --list-themes
```

Use the default theme explicitly:

```bash
tclock-system-health --theme default
```

Use the Evangelion/NERV-inspired theme:

```bash
tclock-system-health --theme nerv
```

You can also set the theme with an environment variable, which is convenient in wrapper scripts:

```bash
#!/usr/bin/env bash
exec tclock-system-health --theme nerv --snapshots "$@"
```

or:

```bash
TCLOCK_SYSTEM_HEALTH_THEME=nerv tclock-system-health
```

Then point a bottom widget at the wrapper:

```toml
[[clock.widgets]]
title = ""
command = "my-system-health"
refresh_secs = 300
position = "bottom"
```

## Built-in themes

- `default`: the original compact health palette: green OK, yellow warning, red error, cyan labels.
- `nerv`: Evangelion/NERV-inspired colors: EVA green OK, NERV orange warnings, alarm red failures, purple section labels.

## Add a new theme

Themes live in `examples/widgets/tclock-system-health` and are intentionally small Bash functions.

Add a function named `theme_<name>()` that sets these semantic variables:

- `G`: OK/success values.
- `Y`: warning values.
- `R`: error/critical values.
- `D`: dim separators and secondary text.
- `B`: title emphasis.
- `N`: reset sequence.
- `LBL`: section labels.
- `OK`, `WA`, `ER`: status glyphs built from the colors above.

Example skeleton:

```bash
theme_example() {
  G=$(sgr '38;5;118')
  Y=$(sgr '38;5;208')
  R=$(sgr '38;5;196')
  D=$'\033[2m'
  B=$'\033[1m'
  N=$'\033[0m'
  LBL=$(sgr '1;38;5;39')
  OK="${G}✔${N}"
  WA="${Y}▲${N}"
  ER="${R}✖${N}"
}
```

Then:

1. Add the name to `list_themes()`.
2. Add a branch in `apply_theme()`.
3. Run:

```bash
bash -n examples/widgets/tclock-system-health
examples/widgets/tclock-system-health --list-themes
examples/widgets/tclock-system-health --theme <name> --no-btrfs --single-column
```

Keep themes semantic rather than hard-coding colors in report logic. That keeps future themes easy to review and avoids scattering style decisions through the health checks.
