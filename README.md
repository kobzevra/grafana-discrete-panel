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

Optional fields:

`machine_type`, `duration`, `job`, `run_id`, `display_class`, `operator`, `material`, `customer`, `manager`, `color_profile`, `print_mode`, `drop_size`, `tool`, `preset`, `commanded_speed`, `quality`, `details`.

Every physical field name is configurable in panel options. The optional mapped `duration` field is interpreted as **milliseconds**. If it is absent for a closed interval, duration is derived from `ended_at - started_at`.

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

Idle and Setup min/max filters use the **original interval duration**, before range clipping. Legend totals use **visible clipped duration** only.

Example: a 40 minute Idle interval with only 5 minutes visible passes `Idle minimum = 30 minutes`, but adds only 5 minutes to the visible legend.

## Job focus

Job selection modes:

- `None`: no job restriction.
- `Filter`: only matching jobs survive the job dimension filter.
- `Focus`: the selected job becomes `Selected job`, all other running jobs become `Other jobs`, and non-running machine states remain visible.

A focus binding must resolve to exactly one job. A multi-value selection is not guessed; the panel shows a diagnostic instead.

Filter bindings can be literal values or Grafana variable expressions. A JSON-array result is treated as a multi-select binding.

## Legend

The legend is calculated from the exact same transformed intervals that are passed to Canvas.

States report visible duration, percentage, and segment count. Jobs report visible duration, segment count, and distinct `run_id` count when reliable run IDs are available. In multi-machine mode the percentage denominator is selected range duration multiplied by the number of visible machine rows.

## Data quality

The panel deliberately refuses misleading exact totals when normalized intervals for the same machine conflict in time.

It distinguishes normalized machine states, running without a resolved job, explicit Unknown/Gap/Stale classes, source no-data regions, and intervals removed by user filters. Missing telemetry is never silently converted to Idle.

## Colors

Machine states use fixed stable defaults with optional overrides. Jobs use a stable versioned hash of the normalized job key into a fixed palette, so the same job keeps the same color across interruptions and dashboard reloads.

## Development

```bash
npm install
npm run test:ci
npm run typecheck
npm run lint
npm run build
npm run react:detect
```

Repository CI performs these checks on the rewrite branch. Runtime acceptance is separate from build acceptance and must be performed against Grafana 13.1.1 before production deployment.

## Upstream attribution

This repository originated as a fork of `NatelEnergy/grafana-discrete-panel`. The new implementation is a clean React/TypeScript rewrite, but retains the upstream MIT license and attribution. The historical Discrete panel remains the UX reference for horizontal discrete state regions; it is not a runtime dependency.

## Non-goals

This panel does not edit production facts, schedule future jobs, draw Gantt dependencies, control machines, or reconstruct historical intervals from second-by-second points.
