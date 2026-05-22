# OCR 整句關鍵字模糊比對實作計畫

## Summary

依據 `specs/2026-05-22-ocr-fuzzy-sentence-matching.md` 實作 opt-in 的 `fuzzySentence` 整句模糊比對，不新增 npm 相依套件，並保留精準比對優先、規則順序、每行最多匹配一條規則、同一規則只計分一次等既有語意。

本次採用新版規則格式 `{ text, score, matchMode }[]`。`defaultScoreRules.json`、localStorage、JSON 匯入與匯出皆需明確包含合法 `matchMode`，不做舊版 `{ text, score }` 相容轉換。若評分結果存在未決議歧義，計分評語需額外提示尚有未作決議的歧義。

## Scope

- Spec: `specs/2026-05-22-ocr-fuzzy-sentence-matching.md`
- Implemented areas: scoring types, scoring pure functions, score rule persistence, settings UI, score summary UI, OCR panel ambiguity state, responsive CSS.
- Out of scope: new dependencies, package/lockfile changes, semantic similarity, Hanzi shape similarity, regex rules, whitespace or punctuation normalization.

## Plan

1. Update scoring contracts with `matchMode`, fuzzy metadata, ambiguity options, and user ambiguity resolutions.
2. Change default rules and rule persistence to require the new `{ text, score, matchMode }[]` shape.
3. Implement Levenshtein-based fuzzy sentence matching with exact-match priority, threshold checks, candidate ranking, ambiguity output, and one-character conflict detection.
4. Add settings controls for exact vs fuzzy sentence mode and show a non-blocking short-keyword warning.
5. Add line-level score summary display with exact/fuzzy/ambiguous status, similarity, edit distance, and ambiguity candidate selection.
6. Keep ambiguity resolutions as temporary OCR-result state and clear them when OCR input/result state is reset.
7. Verify lint/build and check every implementation task in the spec.

## Validation

- `npm run lint`
- `npm run build`
- Manual verification cases:
  - exact rules keep `includes` behavior.
  - fuzzy long sentence matches one wrong, missing, or extra character.
  - short fuzzy keywords do not match through fuzzy mode.
  - close fuzzy candidates remain uncounted until the user selects one.
  - selecting or clearing an ambiguity changes total score as expected.
  - JSON import/export requires and preserves `matchMode`.

## Approval Status

Approved for implementation by user request. Implementation must not be considered complete until the spec task list is fully checked.
