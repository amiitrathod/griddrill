# Formula engine spike

Engine: HyperFormula 2.7 under the GPL-v3 licence key. It evaluates formulas on the learner's device, so no answer data leaves the browser.

Functions missing or different, with the replacement in `lib/grid/engine.ts`:
- VLOOKUP and MATCH: replaced to match Excel's exact and binary-search approximate behaviour.
- XLOOKUP: custom implementation (exact match, optional not-found value).
- CONCAT, TEXTJOIN, VALUE: custom, registered in the plugin.

Known gaps: dynamic arrays (FILTER, SORT, UNIQUE), LET and LAMBDA, pivot tables and charts. Lessons avoid them.
