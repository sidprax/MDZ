import { compareContext } from "./compare.js";
import { extractEvidence } from "./evidence-extractor.js";

export function checkSufficiency(original, reduced, options = {}) {
  const evidence = options.evidence ?? extractEvidence(original);
  const requiredMarkers = options.markers ?? evidence.requiredMarkers;
  const comparison = compareContext(original, reduced, {
    markers: requiredMarkers,
    requireMarkers: false
  });
  const preserved = requiredMarkers.filter((marker) => String(reduced).includes(marker)).length;
  const coverage = requiredMarkers.length === 0 ? 1 : preserved / requiredMarkers.length;
  const sufficient = coverage >= (options.minCoverage ?? 0.65) && comparison.riskLevel !== "high";
  return {
    generatedAt: new Date().toISOString(),
    sufficient,
    coverage,
    requiredMarkers: requiredMarkers.length,
    preservedMarkers: preserved,
    missingMarkers: requiredMarkers.filter((marker) => !String(reduced).includes(marker)).slice(0, 30),
    riskLevel: sufficient ? comparison.riskLevel : "high",
    comparison,
    recommendation: sufficient
      ? "Reduced context is likely sufficient for the next step."
      : "Expand original context before relying on this reduction."
  };
}
