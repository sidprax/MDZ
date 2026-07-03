import { compareContext } from "./compare.js";
import { checkSufficiency } from "./sufficiency-checker.js";

export function runQualityHarness(originalText, reducedText, options = {}) {
  const markers = options.markers ?? [];
  const comparison = compareContext(originalText, reducedText, { markers, requireMarkers: markers.length > 0 });
  const sufficiency = checkSufficiency(originalText, reducedText, { minCoverage: options.minCoverage });
  const passed = comparison.passed && sufficiency.sufficient;
  return {
    generatedAt: new Date().toISOString(),
    passed,
    comparison,
    sufficiency,
    checks: {
      markerRetention: comparison.passed,
      evidenceCoverage: sufficiency.sufficient,
      rootCausePreserved: markers.length ? markers.every((marker) => String(reducedText).includes(marker)) : undefined
    },
    recommendation: passed ? "Reduction passed quality checks." : "Expand original context or reduce less aggressively."
  };
}
