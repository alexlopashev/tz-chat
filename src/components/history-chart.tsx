import { historySeries } from "@/lib/agent/evidence";

const colors = [
  "#542779",
  "#246b9b",
  "#5d7438",
  "#8158a0",
  "#a35c19",
  "#426969",
];
export function HistoryChart({ data }: { data: Record<string, unknown> }) {
  const series = historySeries(data);
  if (!series) return null;
  const dates = series[0].points.map((point) => point.date);
  const start = Date.parse(dates[0]);
  const span = Date.parse(dates.at(-1)!) - start;
  const x = (date: string) => 46 + ((Date.parse(date) - start) / span) * 534;
  const y = (value: number) => 220 - value * 1.9;
  return (
    <figure className="history-chart">
      <figcaption>Published RCP average over time · support (%)</figcaption>
      <svg
        viewBox="0 0 600 265"
        role="img"
        aria-label={`Published RCP average support from ${dates[0]} to ${dates.at(-1)}. Full values are available in the observation table below.`}
      >
        {[0, 25, 50, 75, 100].map((value) => (
          <g key={value}>
            <line
              x1="46"
              x2="580"
              y1={y(value)}
              y2={y(value)}
              stroke="var(--line)"
            />
            <text x="38" y={y(value) + 4} textAnchor="end">
              {value}
            </text>
          </g>
        ))}
        {series.map((candidate, index) => {
          let penDown = false;
          const path = candidate.points
            .map((point) => {
              if (point.value === null) {
                penDown = false;
                return "";
              }
              const command = penDown ? "L" : "M";
              penDown = true;
              return `${command}${x(point.date)},${y(point.value)}`;
            })
            .join(" ");
          return (
            <g key={candidate.name}>
              <path
                d={path}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="2"
                strokeDasharray={index % 2 ? "6 3" : undefined}
              />
              {candidate.points.map((point) =>
                point.value === null ? null : (
                  <circle
                    key={point.date}
                    cx={x(point.date)}
                    cy={y(point.value)}
                    r="3"
                    fill={colors[index % colors.length]}
                  >
                    <title>{`${candidate.name}: ${point.value}% on ${point.date}`}</title>
                  </circle>
                ),
              )}
            </g>
          );
        })}
        <text x="46" y="245">
          {dates[0]}
        </text>
        <text x="580" y="245" textAnchor="end">
          {dates.at(-1)}
        </text>
      </svg>
      <ul className="chart-legend">
        {series.map((candidate, index) => (
          <li key={candidate.name}>
            <span
              style={{
                borderColor: colors[index % colors.length],
                borderStyle: index % 2 ? "dashed" : "solid",
              }}
            />
            {candidate.name}
          </li>
        ))}
      </ul>
      <p className="field-help">
        Points show returned observations; lines connect them, with gaps for
        missing values. The support axis runs from 0 to 100%.
      </p>
      <details className="chart-values">
        <summary>View observation table</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Date</th>
                {series.map((candidate) => (
                  <th scope="col" key={candidate.name}>
                    {candidate.name} (%)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date, index) => (
                <tr key={date}>
                  <th scope="row">{date}</th>
                  {series.map((candidate) => (
                    <td key={candidate.name}>
                      {candidate.points[index].value ?? "Missing"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
