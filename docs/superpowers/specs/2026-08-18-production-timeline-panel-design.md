# Production Timeline Panel for Grafana 13.1.1 — Design

**Date:** 2026-08-18  
**Status:** approved design captured before implementation  
**Repository:** `kobzevra/grafana-discrete-panel`  
**Target branch:** `rewrite/grafana-13-production-timeline`

## 1. Purpose

Rewrite the legacy Natel Discrete panel fork as a modern, vendor-neutral Grafana panel plugin for the production monitoring project.

The new panel must preserve the useful UX of the historical Discrete panel — horizontal state regions, stable colors, hover details, transition visibility, range-aware statistics — while implementing the stricter `PRODUCTION_TIMELINE_PANEL_REQUIREMENTS_v1.0.md` contract:

- jobs and machine states on the same timeline;
- exact `[from,to)` overlap and clipping semantics;
- visible-duration legend calculations;
- original-duration filters;
- deterministic job colors;
- selected-job / Other-jobs focus mode;
- multiple machine rows on a shared time axis;
- common and machine-specific production dimensions;
- explicit handling of unresolved, stale, gap, and no-data conditions;
- normalized DataFrame input with no vendor-specific parsing in the renderer.

This is a full React rewrite, not an incremental Angular migration.

## 2. Compatibility target

The first production target is **Grafana OSS 13.1.1**.

Initial metadata will declare:

```text
grafanaDependency >=13.1.1
```

The implementation will use current Grafana plugin APIs and package versions compatible with Grafana 13.1.1. Compatibility with older Grafana releases is not a goal of the first version and must not be claimed without separate tests.

The plugin must not depend on:

- Angular panel APIs;
- `PanelCtrl` / `CanvasPanelCtrl`;
- `grafana/app/*` internal imports;
- jQuery;
- Moment.js;
- deprecated `@grafana/toolkit` build flow.

The plugin will use React, `PanelPlugin`, public `@grafana/*` APIs, TypeScript, and modern Grafana plugin tooling.

## 3. Plugin identity and migration policy

The new plugin identity is:

```text
id:   kobzevra-production-timeline-panel
name: Production Timeline
```

The legacy `natel-discrete-panel` ID will not be retained. This avoids implying dashboard-level backward compatibility with the old Angular plugin and creates a clean namespace suitable for private signing.

Consequences:

- existing dashboards using `natel-discrete-panel` are not migrated automatically;
- users add the new panel explicitly;
- old source remains available through Git history;
- MIT license and attribution from the original Natel Discrete project remain in the repository and derivative source notices where required.

## 4. High-level architecture

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
        +--> interval validation
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

The domain transformations are pure TypeScript functions. React is responsible for Grafana integration, options, sizing, mouse interaction, and rendering orchestration. Canvas is responsible only for timeline geometry and hit regions; legend and tooltip are normal React UI.

This separation allows the correctness-critical interval engine to be tested independently from drawing code.

## 5. Planned source boundaries

The implementation should converge on focused modules with responsibilities equivalent to:

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

Exact filenames may change during implementation if the same boundaries remain clear.

No module should mix vendor parsing with visualization semantics.

## 6. Input contract

The panel consumes one or more Grafana DataFrames and maps them into one logical interval model.

### 6.1 Required logical fields

```text
machine_id
state
started_at
ended_at
```

`ended_at` may be null for a current/open interval.

### 6.2 Optional logical fields

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

The panel must not assume that the future schema registry uses these exact physical column names. Panel options therefore map logical fields to actual DataFrame fields.

### 6.3 Time fields

Preferred input is a Grafana field of time type. ISO-8601 string fields may also be selected explicitly. Numeric non-time fields are not heuristically interpreted as seconds or milliseconds.

Internal interval time is represented as epoch milliseconds.

### 6.4 Original duration

For a closed interval:

- use a mapped `original_duration` value when present and valid;
- otherwise derive `ended_at - started_at`.

For an open interval with no explicit duration, the panel uses elapsed duration at evaluation time as the current duration-so-far. It is not presented as a final completed duration.

## 7. Interval semantics

Dashboard range is half-open:

```text
[from,to)
```

A closed interval overlaps the range when:

```text
started_at < to && ended_at > from
```

Visible geometry is:

```text
visible_start = max(started_at, from)
visible_end   = min(ended_at, to)
```

For an open interval:

```text
effective_end = min(to, now)
```

when `to` lies in the future, otherwise `effective_end = to`.

An interval with no positive visible duration is not rendered and contributes nothing to the legend.

Original boundaries and original duration remain available for tooltip and duration filtering.

## 8. Query/read-model responsibility

The panel can clip intervals that it receives; it cannot recover intervals omitted by the datasource query.

The production query/read-model must therefore return all intervals that overlap the dashboard range and must provide enough carry-in information for current state at the left boundary.

The panel will not recreate long historical states from second-by-second points. Historical geometry is interval-first.

## 9. Validation and correctness policy

Accuracy of duration totals is more important than rendering malformed data silently.

Validation rules:

- missing required mapped field -> panel configuration error;
- missing `machine_id` or `started_at` -> invalid row;
- invalid timestamp -> invalid row;
- closed `ended_at <= started_at` -> invalid row;
- exact duplicate intervals may be deduplicated deterministically;
- conflicting overlapping non-identical intervals for the same machine are a correctness error.

If conflicting overlaps would make duration aggregation ambiguous, the panel must show an explicit error/warning state and must not present a misleading exact legend total.

Unknown source state values are retained in tooltip details but rendered through the explicit `unknown` class unless the normalized read-model supplies a recognized class.

## 10. Display classes

The visual model separates jobs from non-running machine states.

Default mapping:

```text
running + resolved job     -> job class
running + no resolved job  -> running-unresolved state class
non-running interval       -> normalized machine state class
explicit gap/stale/unknown -> corresponding fixed state class
```

The panel does not infer Idle from missing telemetry.

Recognized fixed state classes initially include, where present in normalized data:

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

No source is required to provide every class.

## 11. No-data and filtered-out regions

The renderer must not confuse source gaps with intervals removed by user filters.

Before dimension filtering, the engine computes source coverage per machine from valid normalized intervals. Uncovered portions of the dashboard range are source **no-data** regions.

After filters are applied:

- true pre-filter uncovered regions remain identifiable as `no data`;
- intervals removed by a dimension filter are `filtered out`, not reclassified as Idle or no-data;
- explicit `gap`, `unknown`, `offline`, and `stale` intervals retain their own state semantics.

The initial UI may represent filtered-out regions as plain background, but they must not contribute to a no-data legend category.

## 12. Colors

### 12.1 Machine states

Machine states use fixed default colors keyed by normalized state. The option model permits state-color overrides without changing state identity.

### 12.2 Jobs

Job colors are deterministic and independent of query order, segment number, reload order, or machine row.

The algorithm is:

1. take the canonical/mapped job key as supplied by the normalized read-model;
2. trim surrounding whitespace;
3. hash the resulting UTF-8 key with a stable versioned hash function;
4. map the hash to a fixed curated job palette.

The palette and hash version are part of panel behavior so reloads do not reshuffle colors.

The renderer will not lower-case or otherwise reinterpret job identity; canonical job normalization belongs upstream when required.

## 13. Job focus

Job selection has two distinct modes:

```text
filter  -> remove jobs that do not match
focus   -> keep full production context
```

Focus mode implements the required behavior:

```text
running + selected job -> Selected job
running + other job    -> Other jobs
non-running states     -> unchanged
```

Machine states do not disappear in focus mode.

The focus value can be bound to a Grafana dashboard variable through panel options. If interpolation resolves to zero or multiple selected jobs, focus mode does not guess a single target; it remains inactive and reports the reason in panel diagnostics.

## 14. Dimension filters

The panel supports local filtering against mapped logical dimensions so the visualization contract does not depend on whether a backend stores a dimension as a tag, field, or external index.

Supported dimensions:

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

Filter option values may contain Grafana variable expressions. After `replaceVariables`, the panel accepts a single value or a JSON-array representation for multi-select values.

Empty filter binding means no local restriction.

Missing optional fields do not create fabricated data. A configured active filter that references an absent mapped field produces a visible configuration diagnostic instead of silently matching everything.

Job focus is evaluated after normal dimension filtering.

## 15. Duration filters

Initial panel options expose min/max original-duration filters for:

```text
idle
setup
```

The domain model represents duration rules generically so other classes can be added later without changing interval semantics.

A duration rule always tests original/current duration before clipping. Legend contribution always uses visible clipped duration.

Example:

```text
original Idle = 40m
visible Idle  = 5m
min Idle      = 30m
```

Result: interval remains visible and contributes only 5m to legend totals.

For an open interval, a min/max rule uses elapsed duration-so-far at evaluation time and the tooltip marks the duration as current rather than final.

## 16. Legend semantics

Legend data is produced by the same transformed interval set that drives the Canvas renderer. There is no separate renderer-side duration calculation.

### 16.1 States

Each state shows at minimum:

```text
state
visible duration
percentage
segment count
```

### 16.2 Jobs

Each job shows at minimum:

```text
job
visible duration
run count when run_id is available
segment count
```

Run count is the count of distinct non-empty `run_id` values. If no reliable run ID exists, the UI reports run count as unavailable; it does not equate segment count with run count.

### 16.3 Focus legend

Focus mode explicitly contains:

```text
Selected job: visible duration
Other jobs:   visible duration
```

with state totals alongside them.

### 16.4 Multiple machines

The default aggregate percentage denominator is total visible machine capacity:

```text
range duration * number of visible machine rows
```

This keeps state percentages meaningful when several rows share one time axis. The engine also keeps per-machine totals so future per-row legend layouts do not require semantic changes.

Filtered-out machine time does not get relabeled as another state. Therefore displayed percentages may sum to less than 100% when active filters intentionally remove intervals or source coverage contains no-data.

## 17. Canvas renderer

Canvas 2D is the primary geometry renderer because the panel may contain many interval rectangles and labels.

Requirements:

- one horizontal row per machine;
- one shared time scale;
- device-pixel-ratio-aware drawing;
- stable row ordering;
- segment rectangles clipped to the plot bounds;
- no merging across intervening states;
- optional labels only when sufficient pixel width exists;
- explicit visual treatment for state classes, jobs, no-data background, and selection/focus;
- time ticks use Grafana time-zone-aware formatting.

The renderer must not perform data aggregation. It receives already transformed render segments.

## 18. Hit testing and tooltip

Hit testing is indexed per machine row and sorted by visible start time. Pointer movement must not scan every interval in the panel.

Tooltip for a segment contains at minimum:

```text
machine
display class
state
job when present
visible start
visible end
visible duration
```

When clipping occurred, it additionally exposes:

```text
original start
original end
original/current duration
```

Mapped optional dimensions are shown only when present.

For an open interval, the tooltip indicates that the end/duration is current as of evaluation time.

## 19. Panel options

The first version includes option groups for:

1. logical field mappings;
2. layout: row height, axis visibility, legend visibility;
3. state color overrides;
4. job focus/filter binding;
5. common dimension filter bindings;
6. printer/cutter dimension filter bindings;
7. Idle and Setup min/max duration rules.

The panel does not contain vendor-specific option names beyond the normalized printer/cutter dimensions already present in the project contract.

## 20. Error handling and diagnostics

Configuration and data errors are visible in the panel rather than only in the browser console.

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

A panel with no rows after legitimate filters is not treated as a plugin crash.

## 21. Performance model

The design avoids algorithmic behavior that scales with pixels or performs full-data scans on every mouse move.

Expected complexity:

- DataFrame normalization: O(n);
- grouping/sorting: O(n log n);
- overlap/filter/display transforms: O(n);
- legend aggregation: O(n);
- Canvas draw: O(n) visible segments;
- hit test: O(log n) within a machine row after row lookup.

No dependency on ECharts, Plotly, Vega, or HTML Graphics is introduced.

## 22. Testing strategy

Correctness-critical logic is developed test-first as pure domain code.

The mandatory project scenarios T01-T14 from `PRODUCTION_TIMELINE_PANEL_REQUIREMENTS_v1.0.md` become executable fixtures, including:

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

## 23. Build and compatibility acceptance

Before the branch is considered implementation-complete, it must pass the checks supported by the modern Grafana plugin toolchain, including equivalents of:

```text
unit tests
type checking
lint
production build
Grafana plugin API compatibility scan
React compatibility scan
```

A runtime smoke test must target Grafana 13.1.1 and include at least:

- plugin loads;
- static fixture renders;
- multiple machine rows render;
- dashboard range clipping fixture renders correctly;
- reload preserves deterministic colors and legend values;
- no browser runtime exception during normal interactions.

If the execution environment cannot run the Grafana 13.1.1 runtime itself, that limitation must be reported explicitly rather than replacing the runtime acceptance with a build-only claim.

## 24. Explicit non-goals

The rewrite does not implement:

- interval editing;
- click-to-modify production facts;
- Gantt planning;
- dependency arrows;
- future job scheduling;
- machine control;
- vendor source parsing;
- reconstruction of historical intervals from raw one-second points;
- automatic migration of old `natel-discrete-panel` dashboard JSON.

## 25. Implementation order

Implementation should proceed in dependency order:

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

## 26. Acceptance definition

The rewrite is ready for production pilot only when all of the following are simultaneously true:

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

This acceptance contract is intentionally stricter than simply rendering colored bars.