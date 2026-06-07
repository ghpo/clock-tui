# AGENTS.md

## Commands
- CI is only `cargo build --verbose` followed by `cargo test --verbose` (`.github/workflows/rust.yml`). Run both before claiming CI parity.
- Local aliases live in `.cargo/config.toml`: `cargo main -- <tclock args>` runs the app crate, and `cargo xtask` runs the generator helper.
- For package-scoped checks, use the workspace package names: `cargo test --package clock-tui` or `cargo test --package xtask`.
- There are no repo-specific lint, fmt, clippy, or typecheck scripts/configs beyond Cargo defaults.

## Repo shape
- Root is a Cargo workspace with two members: `clock-tui` (the published app crate) and `xtask` (generation helper).
- `clock-tui` exposes library `clock_tui` from `clock-tui/src/lib.rs` and binary `tclock` from `clock-tui/src/bin/main.rs`.
- CLI modes and clap parsing are centralized in `clock-tui/src/app.rs`; mode widgets are under `clock-tui/src/app/modes/`.
- `clock-tui/src/bin/main.rs` owns terminal raw/alternate-screen setup and the draw/key loop. Keep CLI parsing before alternate-screen setup so `--help` prints normally.

## Generated assets
- `cargo xtask` regenerates shell completions and the `tclock.1` manpage into `assets/gen` using the clap `App` definition. Rerun it after changing CLI flags/subcommands if generated assets are part of the change.

## Runtime gotchas
- Config is loaded from `dirs::config_dir()/tclock/config.toml` (XDG: `$XDG_CONFIG_HOME/tclock/config.toml`, usually `~/.config/tclock/config.toml`); missing config is ignored, and invalid TOML prints an error then falls back to defaults.
- The main key bindings are in `clock-tui/src/bin/main.rs`: `q` exits, space pauses/resumes supported modes, and `c`/`w`/`t` switch to clock/stopwatch/timer. There is no countdown switch key in the main loop.
- Clock widgets are config-only under `[[clock.widgets]]`, clock-mode only, implemented in `clock-tui/src/app/modes/clock_widget.rs`; widget commands run from `App::tick()` state, not from `Widget::render()`.

## Tests
- Focused unit tests exist in `clock-tui/src/config.rs` and `clock-tui/src/app/modes/clock_widget.rs`; use Cargo’s standard filter, e.g. `cargo test clock_widget --package clock-tui`.
