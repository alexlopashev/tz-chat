export function partyStyle(party?: string | null) {
  const key = party?.trim().toLowerCase();
  if (["d", "dem", "democrat", "democratic"].includes(key ?? ""))
    return { label: "D", color: "#2443db" };
  if (["r", "rep", "republican", "gop"].includes(key ?? ""))
    return { label: "R", color: "#d51c32" };
  if (["i", "ind", "independent"].includes(key ?? ""))
    return { label: "I", color: "#087d79" };
  return { label: party || "Party unspecified", color: "#79539b" };
}
export function changeLabel(value: number | null, previous: number | null) {
  if (value === null || previous === null) return "Change unavailable";
  const diff = Math.round((value - previous) * 100) / 100;
  return `${diff > 0 ? "+" : ""}${diff} pp`;
}
export function leadLabel(points: { name: string; value: number | null }[]) {
  if (points.length < 2 || points.some((point) => point.value === null))
    return "Lead unavailable · incomplete data";
  const ranked = [...points].sort((a, b) => b.value! - a.value!);
  const gap = Math.round((ranked[0].value! - ranked[1].value!) * 100) / 100;
  return gap === 0
    ? "Tied"
    : `${ranked[0].name} +${gap} pp vs ${ranked[1].name}`;
}
