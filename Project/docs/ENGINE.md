# Canonical financial engine

`src/financial_engine.js` is the canonical source for the existing cash-flow and
valuation engine. The complete file is embedded in `app/index.html` between
`/* BEGIN BASIS FINANCIAL ENGINE */` and `/* END BASIS FINANCIAL ENGINE */`.
The distributed HTML remains usable as one file. Make future engine changes in
the canonical source and regenerate the HTML through the project build script;
the build checks and parity tests detect divergence.

This extraction preserves the existing classic-script interface and strict-mode
semantics. It deliberately retains the small `$` and `el` DOM helpers and the
initial `S = blankState()` declaration to avoid changing browser scope or startup
behavior. Numerical entry points do not call those DOM helpers. The file can be
evaluated in a worker or Node VM without `window` or `document`; those helpers
must remain unused there. This is a first decomposition step, not a complete
separation of the application state and UI from the model implementation.

## Entry points and dependencies

| Entry point | Purpose and contract |
| --- | --- |
| `calc(model)` | Builds the property's monthly arrays, annual reports, valuation, debt schedules and result metadata. |
| `calcPortfolio(portfolio)` | Aggregates dated property calculations and returns monthly and annual portfolio data. Policies are documented in `PORTFOLIO_MATH.md`. |
| `valAt(result, model, overrides)` | Values an existing run at alternate rates, caps, prices or holds. A debt-enabled run requires a callable `result.payoff`. |
| `calcPositions(model, result)` | Produces leased-fee/leasehold comparisons from an existing calculation. |
| `scrubMetrics(model, result)` / `validateModel(model, result)` | Derive review metrics and model diagnostics. |
| `buildDebt(model, months, years, basis, leasingCosts)` | Produces debt data plus a local payoff closure. |
| `debtPayoffAt(loans, index)` | Applies the original payoff reduction directly to loan schedule data; used by the closure and by worker-result hydration. |

The engine uses standard JavaScript `Math`, `Date`, `Intl`, typed arrays, `Map`,
`Set` and `WeakMap`. Its numerical routines have no network, storage or library
dependency. Model factories use `Math.random` for IDs and the current year for
blank defaults; supplied model inputs determine calculation results.

`calc` retains its original conditional call to external `basisValidateModel`.
The validator lives in `src/native_codec.js` and must be available in both the
browser and worker calculation environments for matching malformed-input
behavior. Evaluating the financial source alone does **not** establish that
validation boundary. The parity harness loads the same native codec before the
engine. The codec itself requires browser/Node web APIs such as `TextEncoder`
and `TextDecoder`, even when only its validation functions are used.

## Worker result boundary

`calc` and `buildDebt` retain a `payoff` function, including when there are no
active loans. Functions cannot cross the structured-clone boundary. For a worker
response, omit that one function from the result data; on receipt attach:

```js
result.payoff = index => debtPayoffAt(result.loans, index);
```

`debtPayoffAt` uses the identical reduction, range guards and array indexing
previously captured by the closure. It adds no rounding, interpolation, clamping
or lookup-table approximation. In particular, its behavior for fractional,
out-of-range, undefined and non-finite indexes is intentionally retained. An
index within a loan's active range but absent from its array can produce `NaN`;
an index outside the active range contributes zero. These edge semantics were
tested against pre-extraction outputs, rather than revised in this refactor.

Use structured cloning for the remaining result data. `Float64Array` schedules,
shared array references and `Infinity` loan maturities are meaningful. A JSON
round trip changes their types, loses aliasing and converts infinity to `null`.
The test harness verifies preserved aliases such as `result.noiM ===
result.monthly.noi`. Portfolio, position and sensitivity result data were also
checked for structured-clone compatibility on the tested models.

Serialize worker errors explicitly as data. Portfolio errors may include an
`issues` array; structured cloning an `Error` does not retain that custom field.
Carry `name`, `message` and `issues` in the error response as applicable.

## Input mutation audit

The reviewed property and portfolio paths do not write to their supplied model
objects. Deeply frozen inputs pass all 18 extraction parity scenarios. A separate
read-only mutation-trap audit also exercised sample, year-only recovery,
area-schedule/index/inflation-start and separate/joint-exit portfolio models.
Joint portfolio projections already deep-clone a model before extending its
analysis horizon.

The engine does mutate internal caches: `NUMC` stores parsed numeric text with a
100,000-entry limit; `LINE_IB` records inflation offsets in a `WeakMap` keyed by
line objects; `IDX_CACHE` stores parsed inflation indexes in a `WeakMap`. These
caches are per engine instance, are not part of a model or result, and should not
be sent through the worker protocol. This is tested evidence for the reviewed
paths, not a proof of immutability for every possible JavaScript object.

## Exact extraction evidence

The starting point was the reviewed v0.7.2 application on 2026-10-16. Its
139,126-byte body from the first `const $=` to the `PROPERTY FILE` marker was
copied verbatim, with only explicit boundary comments and an independent
`"use strict"` directive added. The original body SHA-256 was
`8b45c5a94ee790f6ec892f696a585d8cc691768b3b0b3fc7bc2717b02b96464b`.
The saved original body prefixed with `"use strict";\n` had SHA-256
`25dab2c502539c97283890d8447603c8429ddb074f340fd78fdb525dd3c9da74`.
The sole subsequent engine refactor factors the original payoff reduction into
`debtPayoffAt`; its numerical behavior remains unchanged.

The complete canonical file, including its markers, strict-mode directive and
that helper, has SHA-256
`ec41e2e17b0be2eca3dce0c20e4aff2303d0269f1496aad0bd2657fc42cfa936`
at the 2026-10-16 verification snapshot. This representation has a different
boundary from the historical HTML-body hashes above. A fresh comparison with
the immutable reviewed 0.7.1 and 0.7.2 archives found exactly unchanged sample
annual/monthly/debt arrays, PV components and both IRRs in nominal, effective
and annual modes. Archive identities and the historical original-upload
comparison are retained in `FINANCIAL_VALIDATION.md`.

`tests/engine_parity.test.cjs` has 22 checks. The committed fingerprints in
`tests/fixtures/engine-parity.json` were captured from the saved **pre-extraction**
source, not generated from the extracted implementation during ordinary tests.
They cover the supplied sample in nominal, effective and annual modes; flat
rent, steps/free rent, proration, occupied expenses, NNN and year-only recovery;
zero discount, interest-only/amortizing/zero-rate/paid-off debt; future floating
and maturing debt; area/index/inflation-start changes; and staggered separate
and joint portfolio exits.

Each property fingerprint covers the complete result graph, position/scrub
outputs, diagnostics, sensitivity valuation and original payoff probes. The
canonical encoding preserves typed-array identities, alias relationships,
non-finite numbers, negative zero, undefined fields and function presence/name.
Function source text is excluded, while payoff calls are evaluated separately.
Random IDs use reproducible xorshift32 seed `123456789` in each isolated VM.
All fingerprints match exactly, without numerical tolerances, on Node 24.19.0.
The separate payoff test checks the pure helper against the retained closure on
structured-cloned loan data at ordinary, negative, fractional, start, maturity,
end-of-array and non-finite indexes.

Run `node tests/engine_parity.test.cjs` for this evidence and `npm test` for the
full project suite. The existing independently specified financial, portfolio
and recovery tests remain separate. These checks establish targeted extraction
parity; they do not certify every underwriting path or replace browser/worker
workflow testing. Future intentional numerical changes require new independently
specified expected results and an explanation before baseline fingerprints change.

## Accuracy changes after extraction

Version 0.7.19 corrects gross-up below 10% occupancy and recognizes actual debt
draws/advances within the selected hold when producing levered returns, including
price and hold sensitivities. It adds a finding for a valuation date outside the
first analysis month without altering the existing fractional-month convention.
The original extraction fingerprints remain unchanged; new independent cases
cover the corrected scenarios. See [financial evidence](FINANCIAL_VALIDATION.md)
and [the 0.7.19 review](ACCURACY_0_7_19.md) before interpreting historical
byte-identity statements as applying to the current engine.
