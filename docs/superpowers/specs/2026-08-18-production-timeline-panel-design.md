# Production Timeline Panel for Grafana 13.1.1 — Design

**Date:** 2026-08-18  
**Status:** chat design approved; written spec pending user review  
**Repository:** `kobzevra/grafana-discrete-panel`  
**Target branch:** `rewrite/grafana-13-production-timeline`

## 1. Purpose

Rewrite the legacy Natel Discrete panel fork as a modern, vendor-neutral Grafana panel plugin for the production monitoring project.

The new panel preserves the useful UX of the historical Discrete panel — horizontal state regions, stable colors, hover details, transition visibility, and range-aware statistics — while implementing the stricter `PRODUCTION_TIMELINE_PANEL_REQUIREMENTS_v1.0.md` contract:

- jobs and machine states on the same timeline;
- exact `[from,to)` overlap and clipping semantics;
- visible-duration legend calculations;
- original-duration filters;
- deterministic job colors;
- selected-job / Other-jobs focus mode;
- multiple machine rows on one shared time axis;
- common and machine-specific production dimensions;
- explicit unresolved, stale, gap, and no-data handling;
- normalized DataFrame input with no vendor-specific parsing in the renderer.

This is a full React rewrite, not an incremental Angular migration.

## 2. Compatibility target

The first production target is **Grafana OSS 13.1.1**.

Initial plugin metadata will declare:

```text
grafanaDependency >=13.1.1
```

Compatibility with older Grafana releases is not a first-version goal and must not be claimed without separate tests.

The new plugin must not depend on:

- Angular panel APIs;
- `PanelCtrl` / `CanvasPanelCtrl`;
- `grafana/app/*` internal imports;
- jQuery;
- Moment.js;
- deprecated `@grafana/toolkit` build flow.

It will use React, `PanelPlugin`, public `@grafana/*` APIs, TypeScript, and current Grafana plugin tooling.

## 3. Plugin identity and migration policy

New identity:

```text
id:   kobzevra-production-timeline-panel
name: Production Timeline
```

The legacy `natel-discrete-panel` ID is not retained. The rewrite does not claim dashboard-level backward compatibility with the old Angular plugin.

Consequences:

- existing dashboards using `natel-discrete-panel` are not migrated automatically;
- the new panel is added explicitly;
- old source remains available through Git history;
- MIT license and attribution from the original Natel Discrete project remain in the repository and derivative notices where required.

## 4. Architecture

```text
Grafana PanelPlugin
        |
        v
ProductionTimelinePanel.tsx
        |
        +--> DataFrame adapter
        |      |
        |      v
        |   normalized intervals
        |
        +--> validation / deduplication
        +--> overlap selection + clipping
        +--> source coverage model
        +--> dimension filters
        +--> original-duration filters
        +--> display-class mapping
        +--> job focus transform
        +--> legend aggregation
        |
        +--> Canvas timeline renderer
        +--> React tooltip
        +--> React legend
```

Correctness-critical transformations are pure TypeScript functions. React handles Grafana integration, options, sizing, interaction, and orchestration. Canvas draws geometry only. Tooltip and legend remain React UI.

Planned boundaries are equivalent to:

```text
src/module.ts
src/types.ts
src/components/ProductionTimelinePanel.tsx
src/components/TimelineCanvas.tsx
src/components/TimelineLegend.tsx
src/components/TimelineTooltip.tsx
src/domain/dataFrameAdapter.ts
src/domain/intervals.ts
src/domain/validation.ts
src/domain/filters.ts
src/domain/displayClasses.ts
src/domain/colors.ts
src/domain/legend.ts
src/domain/hitTest.ts
```

Exact filenames may change if the same responsibilities remain isolated.

## 5. Input contract

The panel consumes one or more Grafana DataFrames and maps rows into one logical interval model.

### Required logical fields

```text
machine_id
state
started_at
ended_at
```

`ended_at` is required as a mapped logical field but its row value may be null for a current/open interval.

### Optional logical fields

```text
machine_type
original_duration
job
run_id
display_class
operator
material
customer
manager
profile
print_mode
drop_size
tool
preset
commanded_speed
quality
details
```

Physical field names are configurable. The panel does not assume that the future schema registry uses these exact column names.

Preferred timestamps are Grafana fields of time type. ISO-8601 strings may also be selected explicitly. Numeric non-time fields are not guessed to be seconds or milliseconds. Internal time is epoch milliseconds.

For a closed interval, `original_duration` is used when mapped and valid; otherwise it is derived as `ended_at - started_at`.

For an open interval without explicit duration, elapsed duration at evaluation time is used as duration-so-far and is never presented as final completed duration.

### `display_class` precedence

`display_class` is an optional normalized hint, not an unrestricted visual override.

Reserved explicit quality/state classes such as `gap`, `stale`, `unknown`, and `offline` take precedence when supplied by the read-model. Otherwise job/state classification is derived from normalized `state` and `job` so an arbitrary input string cannot turn a non-running state into a job or hide an unresolved running interval.

The resolved internal `displayClass` is what downstream filters, legend logic, and renderer consume.

## 6. Interval semantics

Dashboard range is half-open:

```text
[from,to)
```

A closed interval overlaps when:

```text
started_at < to && ended_at > from
```

Visible geometry is:

```text
visible_start = max(started_at, from)
visible_end   = min(ended_at, to)
```

For an open interval, the effective end is the earlier of dashboard `to` and current time. Historical ranges therefore clip at `to`; future-ending ranges never draw an open interval beyond `now`.

Intervals with no positive visible duration are not rendered and contribute nothing to the legend. Original boundaries and original/current duration remain available for tooltip and duration filtering.

## 7. Query/read-model responsibility

The panel can clip intervals it receives; it cannot recover intervals omitted by the datasource query.

The production query/read-model must return all intervals overlapping the dashboard range and enough carry-in information to establish state at the left boundary.

Historical geometry is interval-first. The panel does not rebuild long historical states from second-by-second points.

## 8. Validation and deduplication

Accuracy of duration totals is more important than silently rendering malformed data.

Validation rules:

- missing required mapping -> configuration error;
- missing `machine_id` or `started_at` -> invalid row;
- invalid timestamp -> invalid row;
- closed `ended_at <= started_at` -> invalid row;
- conflicting overlapping non-identical intervals for the same machine -> correctness error.

An **exact duplicate** means two normalized rows have the same values for:

```text
machine_id
started_at
ended_at/open marker
state
job
run_id
all mapped filter dimensions
quality/display-class inputs
```

Exact duplicates are deterministically collapsed to one interval before duration aggregation. Rows that overlap in time but differ in any of those identity/semantic values are not treated as duplicates.

If conflicting overlaps make duration aggregation ambiguous, the panel must visibly report the problem and must not present a misleading exact legend total.

Unknown state values remain available in tooltip details and resolve to `unknown` unless the normalized read-model supplies a recognized explicit class.

## 9. Display classes

Default mapping:

```text
running + resolved job     -> job class
running + no resolved job  -> running-unresolved
non-running interval       -> normalized state class
explicit gap/stale/unknown -> corresponding fixed class
```

Recognized fixed classes initially include, when present in normalized data:

```text
offline
idle
setup
ready
queued
running-unresolved
paused
blocked
error
maintenance
unknown
gap
stale
```

The panel never infers Idle from missing telemetry and does not invent states absent from the source/read-model.

## 10. No-data and filtered-out regions

Before dimension filtering, source coverage is computed per machine from valid normalized intervals. Uncovered portions of the dashboard range are source **no-data** regions.

After filters:

- true pre-filter uncovered regions remain identifiable as no-data;
- intervals removed by a user dimension filter are filtered-out, not reclassified as Idle or no-data;
- explicit `gap`, `unknown`, `offline`, and `stale` intervals keep their own semantics.

The initial UI may render filtered-out regions as plain background, but they do not contribute to a no-data legend category.

## 11. Colors

Machine states use fixed default colors keyed by normalized state. State-color overrides are panel options and do not change state identity.

Job colors are deterministic and independent of query order, segment number, machine row, or dashboard reload.

Algorithm:

1. use the canonical/mapped job key supplied by the read-model;
2. trim surrounding whitespace;
3. hash its UTF-8 bytes with a stable versioned hash;
4. map the hash to a fixed curated job palette.

The renderer does not lower-case or otherwise reinterpret job identity. Canonical job normalization belongs upstream when needed.

## 12. Job filtering and focus

Job selection has two modes:

```text
filter -> remove jobs that do not match
focus  -> preserve full production context
```

Focus mode:

```text
running + selected job -> Selected job
running + other job    -> Other jobs
non-running states     -> unchanged
```

Machine states never disappear merely because job focus is active.

The focus value may be bound to a Grafana dashboard variable. If interpolation resolves to zero or multiple selected jobs, the panel does not guess one target: focus remains inactive and diagnostics explain why.

## 13. Dimension filters

Local filtering is supported for:

```text
machine
job
operator
material
customer
manager
profile
print_mode
drop_size
tool
preset
commanded_speed
```

Filter options may contain Grafana variable expressions. After `replaceVariables`, a binding accepts either one scalar value or a JSON-array representation for multi-select values.

Empty binding means no local restriction. If an active configured filter refers to an absent mapped field, the panel shows a configuration diagnostic instead of silently matching everything.

Job focus is evaluated after normal dimension filters.

## 14. Duration filters

Initial options expose min/max original-duration filters for:

```text
idle
setup
```

The domain representation is generic so more state classes can be added later without changing interval semantics.

Rules are tested against full original duration before clipping. Legend contribution always uses visible clipped duration.

Example:

```text
original Idle = 40m
visible Idle  = 5m
min Idle      = 30m
```

The interval remains visible and contributes only 5m to legend totals.

For an open interval, min/max uses elapsed duration-so-far at evaluation time and the UI marks that duration as current, not final.

## 15. Legend semantics

The legend is calculated from the same transformed interval set used by the renderer. Canvas has no independent duration logic.

State entries contain at minimum:

```text
state
visible duration
percentage
segment count
```

Job entries contain at minimum:

```text
job
visible duration
run count when run_id is reliable
segment count
```

Run count is the number of distinct non-empty `run_id` values. If reliable run IDs are absent, run count is shown as unavailable; segment count is not substituted.

Focus mode explicitly shows:

```text
Selected job: visible duration
Other jobs:   visible duration
```

with machine state totals alongside them.

For multiple machines, the default aggregate percentage denominator is:

```text
range duration * number of visible machine rows
```

The engine also retains per-machine totals. Because filtered-out time is not relabeled as another state, displayed state percentages may sum to less than 100% when filters remove intervals or source no-data exists.

## 16. Canvas renderer

Canvas 2D is the primary geometry renderer.

Requirements:

- one horizontal row per machine;
- one shared time scale;
- device-pixel-ratio-aware drawing;
- deterministic row ordering;
- plot-bound clipping;
- no merging across intervening states;
- labels only when sufficient pixel width exists;
- distinct treatment for states, jobs, no-data, and focus selection;
- Grafana time-zone-aware tick formatting.

The renderer receives transformed render segments and does no aggregation.

## 17. Hit testing and tooltip

Hit testing is indexed by machine row and visible start time. Pointer movement must not linearly scan every interval in the panel.

Tooltip minimum:

```text
machine
display class
state
job when present
visible start
visible end
visible duration
```

When clipping occurred it also shows original start/end and original/current duration. Optional mapped dimensions appear only when present. Open intervals are explicitly marked current.

## 18. Panel options

First-version option groups:

1. logical field mappings;
2. row height, time-axis visibility, legend visibility;
3. state color overrides;
4. job filter/focus mode and binding;
5. common dimension filter bindings;
6. printer/cutter dimension filter bindings;
7. Idle and Setup min/max duration rules.

The option model remains vendor-neutral beyond normalized dimensions already required by the project contract.

## 19. Diagnostics

Configuration and data problems are visible inside the panel rather than only in browser console output.

Diagnostics distinguish at least:

```text
missing required mapping
mapped field not found
invalid rows
conflicting overlaps
configured filter field absent
job focus ambiguous
no rows after filters
no source data in range
```

A legitimate empty result after filters is not treated as a plugin crash.

## 20. Performance model

The design avoids pixel-dependent data work and full scans on every pointer move.

Expected complexity:

```text
DataFrame normalization       O(n)
grouping/sorting              O(n log n)
interval/filter transforms    O(n)
legend aggregation            O(n)
Canvas drawing                O(n visible segments)
hit test                      O(log n within a row)
```

No ECharts, Plotly, Vega, or HTML Graphics dependency is introduced.

## 21. Testing strategy

Correctness-bearing domain logic is implemented test-first.

The project scenarios T01-T14 become executable fixtures:

```text
T01 range starts inside job
T02 range ends inside job
T03 interval crosses both boundaries
T04 interrupted job
T05 job focus
T06 focus legend
T07 original-duration filter vs visible duration
T08 common dimensions
T09 printer dimensions
T10 cutter dimensions
T11 stable job colors
T12 legend consistency
T13 unknown/gap handling
T14 reload stability
```

Additional tests cover:

- open/current interval;
- exact duplicate deduplication;
- conflicting overlap rejection;
- absent optional fields;
- invalid timestamps;
- multi-machine percentage denominator;
- run count distinct from segment count;
- ambiguous multi-value job focus;
- filtered-out regions not becoming no-data.

## 22. Build and compatibility acceptance

Before implementation is considered complete, the branch must pass the checks supported by the modern Grafana plugin toolchain, including equivalents of:

```text
unit tests
type checking
lint
production build
Grafana plugin API compatibility scan
React compatibility scan
```

Runtime smoke testing targets Grafana 13.1.1 and includes:

- plugin loads;
- static fixture renders;
- multiple machine rows render;
- boundary-clipping fixture renders correctly;
- reload preserves deterministic colors and legend values;
- normal interaction produces no browser runtime exception.

If the execution environment cannot run Grafana 13.1.1 itself, that limitation must be reported explicitly instead of replacing runtime acceptance with a build-only claim.

## 23. Non-goals

The rewrite does not implement:

- interval editing;
- click-to-modify production facts;
- Gantt planning or dependency arrows;
- future job scheduling;
- machine control;
- vendor source parsing;
- historical interval reconstruction from raw one-second points;
- automatic migration of old `natel-discrete-panel` dashboard JSON.

## 24. Implementation order

```text
modern Grafana 13 plugin skeleton
-> types/options contract
-> interval fixtures and pure domain engine
-> DataFrame adapter
-> clipping/filter/focus/legend logic
-> deterministic colors
-> React panel shell
-> Canvas renderer
-> tooltip/legend UI
-> option editors
-> compatibility/build checks
-> Grafana 13.1.1 runtime smoke test
-> documentation/package cleanup
```

TDD applies to each correctness-bearing domain step before renderer integration.

## 25. Acceptance definition

The rewrite is ready for production pilot only when all are true:

```text
Grafana 13.1.1 plugin loads
interval timeline renders
state colors are stable
job colors are deterministic
pause/resume keeps the same job color
range boundary clipping is correct
tooltip start/end/duration is correct
state legend uses visible duration
job legend uses visible duration
Selected job / Other jobs works
non-running states remain visible
Idle/Setup min/max uses original duration
common filters work
printer/cutter filters work when mapped data exists
legend matches filtered visible geometry
unknown/gap/no-data are not silently converted to Idle
conflicting overlaps cannot produce misleading totals
reload does not alter semantics
renderer contains no vendor-specific parser logic
Grafana core is not patched
legacy Angular/runtime dependencies are removed
```

This acceptance contract is intentionally stricter than merely rendering colored bars.