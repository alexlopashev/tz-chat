"use client";

import { useState } from "react";
import { partyStyle, changeLabel, leadLabel } from "@/lib/polling-display";
import { historySeries } from "@/lib/agent/evidence";

export function HistoryChart({ data }: { data: Record<string, unknown> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const series = historySeries(data);
  if (!series) return null;
  const dates = series[0].points.map((point) => point.date);
  const start = Date.parse(dates[0]);
  const span = Date.parse(dates.at(-1)!) - start;
  const x = (date: string) => 46 + ((Date.parse(date) - start) / span) * 534;
  const active = Math.min(selected ?? dates.length - 1, dates.length - 1);
  const values = series.flatMap((candidate) =>
    candidate.points.flatMap((point) =>
      point.value === null ? [] : [point.value],
    ),
  );
  const low = Math.max(0, Math.floor((Math.min(...values) - 5) / 5) * 5);
  const high = Math.min(100, Math.ceil((Math.max(...values) + 5) / 5) * 5);
  const y = (value: number) => 220 - ((value - low) / (high - low)) * 190;
  const ticks = Array.from(
    { length: 5 },
    (_, index) => low + ((high - low) * index) / 4,
  );
  const color = (index: number) => partyStyle(series[index].party).color;
  return (
    <figure className="history-chart">
      <figcaption>Published RCP average over time · support (%)</figcaption>
      <div className="chart-inspector" aria-live="polite">
        <div className="chart-date">
          <strong>{dates[active]}</strong>
          <span className="chart-lead">
            {leadLabel(
              series.map((candidate) => ({
                name: candidate.name,
                value: candidate.points[active].value,
              })),
            )}
          </span>
        </div>
        <div className="chart-readings">
          {series.map((candidate, index) => (
            <div key={candidate.name} style={{ borderTopColor: color(index) }}>
              <span>
                {candidate.name} · {partyStyle(candidate.party).label}
              </span>
              <strong style={{ color: color(index) }}>
                {candidate.points[active].value === null
                  ? "Missing"
                  : `${candidate.points[active].value}%`}
              </strong>
              <small>
                {changeLabel(
                  candidate.points[active].value,
                  candidate.points[active - 1]?.value ?? null,
                )}
                <br />
                vs previous observation
              </small>
            </div>
          ))}
        </div>
      </div>
      <svg
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const target =
            start +
            Math.max(
              0,
              Math.min(
                1,
                (((event.clientX - rect.left) / rect.width) * 600 - 46) / 534,
              ),
            ) *
              span;
          const nearest = dates.reduce(
            (best, date, index) =>
              Math.abs(Date.parse(date) - target) <
              Math.abs(Date.parse(dates[best]) - target)
                ? index
                : best,
            0,
          );
          setSelected(nearest);
        }}
        viewBox="0 0 600 265"
        role="img"
        aria-label={`Published RCP average support from ${dates[0]} to ${dates.at(-1)}. Full values are available in the observation table below.`}
      >
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1="46"
              x2="580"
              y1={y(value)}
              y2={y(value)}
              stroke="var(--line)"
            />
            <text x="38" y={y(value) + 4} textAnchor="end">
              {Number(value.toFixed(1))}%
            </text>
          </g>
        ))}
        <line
          x1={x(dates[active])}
          x2={x(dates[active])}
          y1="26"
          y2="220"
          stroke="#a99ab6"
          strokeDasharray="3 4"
        />
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
                stroke={color(index)}
                strokeWidth="3"
                strokeDasharray={index % 2 ? "6 3" : undefined}
              />
              {candidate.points.map((point) =>
                point.value === null ? null : (
                  <circle
                    key={point.date}
                    cx={x(point.date)}
                    cy={y(point.value)}
                    r={point.date === dates[active] ? "5" : "2.5"}
                    fill={color(index)}
                    stroke="white"
                    strokeWidth="1.5"
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
      <label className="chart-scrubber">
        Explore observations
        <input
          type="range"
          min="0"
          max={dates.length - 1}
          value={active}
          onChange={(event) => setSelected(Number(event.target.value))}
          aria-label="Chart observation date"
          aria-valuetext={dates[active]}
        />
      </label>
      <p className="field-help">
        Hover, tap or use the slider to inspect values. Changes are percentage
        points versus the previous returned observation; lead compares the top
        two available candidates. Support axis zoomed to {low}–{high}%. Lines
        connect observations, with gaps for missing values. Dashed lines
        distinguish overlapping series.
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
