/** Keep at least the original three-character budget (two letters + ellipsis). */
export const ellipsizeMeasured = (label: string, width: number, measure: (text: string) => number): string => {
  if (label.length <= 3 || measure(label) <= width) return label;
  for (let budget = label.length; budget >= 3; budget--) {
    const shown = `${label.slice(0, budget - 1).trimEnd()}…`;
    if (measure(shown) <= width || budget === 3) return shown;
  }
  return label;
};
