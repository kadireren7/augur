"use client";
import { useEffect, useRef } from "react";
import { ColorType, createChart, createSeriesMarkers, HistogramSeries, LineSeries, type IChartApi, type ISeriesApi, type ISeriesMarkersPluginApi, type Time, type UTCTimestamp } from "lightweight-charts";
import { practiceOutcomes, type PracticeOutcome, type PracticeRound } from "@/lib/practice-exchange";
import { practiceChartData } from "@/lib/practice-chart";

const colors = { BUY: "#98e6b2", HOLD: "#86baff", SELL: "#ff997d" };
export function PoolChart({ round }: { round: PracticeRound }) {
  const container = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const manualView = useRef(false);
  const api = useRef<{ chart: IChartApi; lines: Record<PracticeOutcome, ISeriesApi<"Line">>; volume: ISeriesApi<"Histogram">; markers: Record<PracticeOutcome, ISeriesMarkersPluginApi<UTCTimestamp>> } | null>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = createChart(container.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#111f22" }, textColor: "#bccacb", fontFamily: "Inter, sans-serif", fontSize: 13, attributionLogo: true },
      grid: { vertLines: { color: "#ffffff08" }, horzLines: { color: "#ffffff0c" } },
      rightPriceScale: { borderColor: "#ffffff16", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { timeVisible: true, secondsVisible: true, borderColor: "#ffffff16", barSpacing: 35, rightOffset: 1,
        tickMarkFormatter: (time: Time) => typeof time === "number" ? new Date(time * 1000).toLocaleTimeString("en-GB") : "" },
      localization: { timeFormatter: (time: number) => new Date(time * 1000).toLocaleTimeString("en-GB") },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    });
    const lines = Object.fromEntries(practiceOutcomes.map((outcome) => [outcome, chart.addSeries(LineSeries, {
      color: colors[outcome], lineWidth: 2, title: outcome, priceFormat: { type: "custom", minMove: 0.1, formatter: (value: number) => `${value.toFixed(1)}%` },
      crosshairMarkerRadius: 5, priceLineVisible: false,
    })])) as Record<PracticeOutcome, ISeriesApi<"Line">>;
    const volume = chart.addSeries(HistogramSeries, { color: "#507b83", priceFormat: { type: "volume" }, priceLineVisible: false, lastValueVisible: false }, 1);
    chart.panes()[0].setStretchFactor(4);
    chart.panes()[1].setStretchFactor(1);
    const markers = Object.fromEntries(practiceOutcomes.map((outcome) => [outcome, createSeriesMarkers(lines[outcome], [])])) as Record<PracticeOutcome, ISeriesMarkersPluginApi<UTCTimestamp>>;
    chart.subscribeCrosshairMove((event) => {
      if (!readout.current) return;
      if (!event.time) { readout.current.textContent = "Drag to pan · pinch / scroll to zoom"; return; }
      const values = practiceOutcomes.map((outcome) => {
        const point = event.seriesData.get(lines[outcome]);
        return point && "value" in point ? `${outcome} ${point.value.toFixed(1)}%` : "";
      }).filter(Boolean);
      readout.current.textContent = values.join(" · ");
    });
    api.current = { chart, lines, volume, markers };
    const element = container.current;
    const interact = () => { manualView.current = true; };
    let resizeFrame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        if (!manualView.current) chart.timeScale().fitContent();
      });
    });
    observer.observe(element);
    element.addEventListener("pointerdown", interact);
    element.addEventListener("wheel", interact, { passive: true });
    return () => {
      element.removeEventListener("pointerdown", interact);
      element.removeEventListener("wheel", interact);
      observer.disconnect();
      cancelAnimationFrame(resizeFrame);
      api.current = null; chart.remove();
    };
  }, []);
  useEffect(() => {
    if (!api.current) return;
    const { points, markers } = practiceChartData(round), { lines, volume, markers: plugins } = api.current;
    const before = points.length ? [{ time: (points[0].time - 1) as UTCTimestamp }] : [];
    const after = points.length ? [{ time: (points[points.length - 1].time + 1) as UTCTimestamp }] : [];
    for (const outcome of practiceOutcomes) {
      lines[outcome].setData([...before, ...points.map((point) => ({ time: point.time as UTCTimestamp, value: point[outcome] })), ...after]);
      plugins[outcome].setMarkers(markers.filter((marker) => marker.outcome === outcome).map((marker) => ({
        time: marker.time as UTCTimestamp, position: "inBar" as const, shape: "circle" as const, color: colors[outcome], text: `You +${marker.stake}`, size: 1,
      })));
    }
    volume.setData([...before, ...points.map((point) => ({ time: point.time as UTCTimestamp, value: point.volume })), ...after]);
    if (!manualView.current) api.current.chart.timeScale().fitContent();
  }, [round]);
  return <div className="practice-chart interactive-pool-chart">
    <div className="practice-chart-title"><strong>Pool share</strong><span>Demo · not token prices</span></div>
    <div ref={container} className="pool-chart-canvas" role="img" aria-label="Interactive timestamped BUY HOLD SELL pool share chart with stake volume and your position markers"/>
    <div className="pool-chart-footer"><div className="practice-chart-legend">{practiceOutcomes.map((outcome) => <span key={outcome} style={{ color: colors[outcome] }}><i/>{outcome}</span>)}<span>Bars: stake credits</span></div>
      <span ref={readout}>Drag to pan · pinch / scroll to zoom</span>
    </div>
  </div>;
}
