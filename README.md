# Production Timeline panel for Grafana

`kobzevra-production-timeline-panel` is a read-only Grafana panel for production jobs and machine states. It is a full React rewrite of the historical Natel Discrete panel concept for Grafana OSS 13.1.1.

The panel is vendor-neutral: it consumes already-normalized interval rows and does not parse DURST, ESKO, LIYU, ZUND, NcStudio, Caldera, Workflow, or any other vendor format.

## Compatibility

- Grafana OSS: `>=13.1.1` (13.1.1 is the initial acceptance target)
- Node.js for development: `>=22`
- License: MIT

The implementation uses public Grafana plugin APIs only. It does not use Angular panel controllers, `grafana/app/*`, jQuery, Moment.js, or `@grafana/toolkit`.

## Interval input contract

Required logical fields:

| Logical field | Default physical field | Meaning |
| --- | --- | --- |
| `machine_id` | `machine_id` | stable machine identifier |
| `state` | `state` | normalized machine state |
| `started_at` | `started_at` | interval start |
| `ended_at` | `ended_at` | interval end; null means current/open |

Optional logical fields include `machine_type`, `original_duration`, `job`, `run_id`, `display_class`, `operator`, `material`, `customer`, `manager`, `color_profile`, `print_mode`, `drop_size`, `tool`, `preset`, `commanded_speed`, `quality`, and `details`.

Every physical field name is configurable in panel options. `original_duration` has **no default physical mapping** because the project schema does not yet define one universal storage unit. If it is explicitly mapped, the panel interprets that value as **milliseconds**. When it is not mapped, a closed interval's original duration is safely derived from `ended_at - started_at`.

Grafana time fields may provide epoch milliseconds. Explicit ISO-8601 string fields are also accepted. Arbitrary numeric non-time fields are not guessed to be timestamps.

## Boundary semantics

Dashboard time range is interpreted as a half-open interval:

```text
[from,to)
```

A source interval is relevant when:

```text
started_at < to
AND ended_at > from
```

Visible geometry is clipped without changing the original interval:

```text
visible_start = max(started_at, from)
visible_end   = min(ended_at, to)
```

For an open interval, the visible end is the earlier of dashboard `to` and current time.

The datasource/read model is responsible for returning overlapping intervals and sufficient carry-in information. The panel cannot recover an interval that the query omitted.

## Duration rules

Duration filters are configured as dynamic rows:

```text
State | Minimum (s) | Maximum (s)
```

The state selector is populated from state values actually present in the current DataFrame, and additional rows can be added or removed. This allows rules for `gap`, `idle`, `setup`, or any other normalized state without reclassifying one state as another.

Duration filters use the **original full interval duration**, before range clipping. Legend totals use **visible clipped duration** only.

Example: a 40 minute Idle interval with only 5 minutes visible passes a 30 minute minimum rule, but adds only 5 minutes to the visible legend.

## Dynamic filters

Filters are configured as rows:

```text
Field | Value(s)
```

The field selector is populated from the fields discovered in the current DataFrame. The value selector is populated from values discovered for the selected field and supports multiple values.

- multiple values within one row are OR;
- multiple filter rows are AND;
- custom values and Grafana variable expressions are accepted;
- rows can be added or removed;
- the editor initially presents up to four useful field suggestions from the current data.

The dynamic model allows printer-, cutter-, workflow-, and common production dimensions to use the same panel without a hardcoded per-machine filter form.

## Job focus

Job selection modes:

- `None`: no job restriction.
- `Filter`: matching job rows are handled by the configured filter mapping.
- `Focus`: one selected job becomes `Selected job`, all other running jobs become `Other jobs`, and non-running machine states remain visible.

A focus selection must resolve to exactly one job and requires an available mapped job field. A multi-value selection is not guessed; the panel shows a diagnostic instead. Focus legend keeps explicit Selected-job and Other-jobs entries even when one visible duration is zero.

## Time interaction

The timeline changes the normal Grafana dashboard time range rather than maintaining a private local viewport:

- drag empty timeline space or the time axis to pan left/right;
- drag on a colored segment to select a range; releasing zooms the dashboard to that range;
- mouse wheel pans in time;
- `Ctrl + wheel` zooms around the timestamp under the cursor;
- `Shift + wheel` performs faster panning;
- horizontal wheel/touchpad delta is accepted for panning.

Very short pointer drags are ignored to avoid accidental zooms. Tooltip hover is suppressed while a time interaction is active.

## Legend

The legend is calculated from the exact same transformed intervals that are passed to Canvas. The timeline area uses only the height required by its machine rows and optional axis, so the legend starts immediately below it instead of being pushed to the bottom of a tall panel.

States report visible duration, percentage, and segment count. Jobs report visible duration, segment count, and distinct `run_id` count when reliable run IDs are available. In multi-machine mode the percentage denominator is selected range duration multiplied by the number of visible machine rows.

## Data quality

The panel deliberately refuses misleading exact totals when normalized intervals for the same machine conflict in time.

It distinguishes normalized machine states, running without a resolved job, explicit Unknown/Gap/Stale classes, source no-data regions, and intervals removed by user filters. Missing telemetry is never silently converted to Idle.

## Colors

Jobs use a stable versioned hash of the normalized job key into a fixed palette, so the same job keeps the same color across interruptions and dashboard reloads.

Explicit color overrides are configured in a separate **Color mappings** modal:

```text
Field | Value | Color
```

Both field and value selectors are populated from the current DataFrame. A complete matching mapping overrides the default state/job color. The editor presents four initial mapping rows and supports adding or removing rows. `running` is not automatically mapped by default, preserving deterministic per-job colors unless the user explicitly overrides it.

## Options layout

The option editor follows Grafana 13 native controls while retaining the organization of the historical Discrete panel where it still fits: Display, Legend, Filters, Duration filters, Colors, and Field mappings. A later visual pass can modernize styling without changing these option semantics.

## Development

```bash
npm install
npm run test:ci
npm run typecheck
npm run lint
npm run build
npm run react:detect
```

Repository CI performs these checks on the rewrite branch. Runtime acceptance is separate from build acceptance and is exercised against Grafana 13.1.1 with a fixed interval fixture.

## Upstream attribution

This repository originated as a fork of `NatelEnergy/grafana-discrete-panel`. The new implementation is a clean React/TypeScript rewrite, but retains the upstream MIT license and attribution. The historical Discrete panel remains the UX reference for horizontal discrete state regions; it is not a runtime dependency.

## Non-goals

This panel does not edit production facts, schedule future jobs, draw Gantt dependencies, control machines, or reconstruct historical intervals from second-by-second points.
