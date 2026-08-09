"use client";
import { useEffect, useRef } from "react";
import type {
  Map as MlMap,
  GeoJSONSource,
  MapLayerMouseEvent,
} from "maplibre-gl";
import {
  MAP_CENTER,
  MAP_PITCH,
  MAP_STYLE_URL,
  MAP_ZOOM,
  type GeoPoint,
  type MapDot,
} from "@/lib/mapConfig";

const toFeatureCollection = (dots: MapDot[]) => ({
  type: "FeatureCollection" as const,
  features: dots.map((d) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [d.position.lng, d.position.lat],
    },
    properties: { id: d.id, hot: d.hot, category: d.category },
  })),
});

const toAmbientCollection = (points: GeoPoint[]) => ({
  type: "FeatureCollection" as const,
  features: points.map((p, i) => ({
    type: "Feature" as const,
    geometry: {
      type: "Point" as const,
      coordinates: [p.lng, p.lat],
    },
    properties: { id: `ambient-${i}` },
  })),
});

/**
 * P3 real map pane (ADR-0004): MapLibre GL JS + OpenFreeMap free vector tiles.
 * 3D perspective (pitch) + volumetric buildings (style extrusion layers) +
 * active-wave glow dots + click-to-focus. maplibre-gl is lazy-loaded so the
 * radar feed chunk stays lean.
 *
 * Game-layer hooks (camera journeys / sound / fx) intentionally absent — this
 * component is the stable base those add-ons stack onto later.
 */
export default function MapView({
  dots,
  ambient = [],
  className = "",
  onDotClick,
}: {
  dots: MapDot[];
  /** Static "city life" points (visual density, no interaction). */
  ambient?: GeoPoint[];
  className?: string;
  /** Fired when an active-wave glow dot is clicked (id = wave id). */
  onDotClick?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const dotsRef = useRef<MapDot[]>(dots);
  const ambientRef = useRef<GeoPoint[]>(ambient);
  const onDotClickRef = useRef(onDotClick);
  useEffect(() => {
    dotsRef.current = dots;
  }, [dots]);
  useEffect(() => {
    ambientRef.current = ambient;
  }, [ambient]);

  useEffect(() => {
    let disposed = false;
    let map: MlMap | null = null;
    void import("maplibre-gl").then((m) => {
      if (disposed || !containerRef.current) return;
      map = new m.Map({
        container: containerRef.current,
        style: MAP_STYLE_URL,
        center: [MAP_CENTER.lng, MAP_CENTER.lat],
        zoom: MAP_ZOOM,
        pitch: MAP_PITCH,
      });
      mapRef.current = map;
      map.on("load", () => {
        const ambientPoints = ambientRef.current;
        if (ambientPoints.length) {
          map!.addSource("ambient-dots", {
            type: "geojson",
            data: toAmbientCollection(ambientPoints),
          });
          map!.addLayer({
            id: "wave-ambient",
            type: "circle",
            source: "ambient-dots",
            paint: {
              "circle-radius": 3.5,
              "circle-color": "#3a4380",
              "circle-opacity": 0.35,
              "circle-stroke-width": 0,
            },
          });
        }
        map!.addSource("wave-dots", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map!.addLayer({
          id: "wave-glow",
          type: "circle",
          source: "wave-dots",
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "hot"],
              0,
              8,
              1,
              18,
            ],
            "circle-color": "#00f0ff",
            "circle-opacity": [
              "interpolate",
              ["linear"],
              ["get", "hot"],
              0,
              0.4,
              1,
              0.85,
            ],
            "circle-stroke-color": "#7b61ff",
            "circle-stroke-width": 1.5,
            "circle-blur": 0.5,
          },
        });
        const src = map!.getSource("wave-dots") as GeoJSONSource;
        src.setData(toFeatureCollection(dotsRef.current));
      });
      map.on("click", "wave-glow", (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties?.id;
        const g = e.features?.[0]?.geometry;
        if (g && g.type === "Point") {
          map!.flyTo({
            center: g.coordinates as [number, number],
            zoom: Math.max(map!.getZoom(), 14),
          });
        }
        if (typeof id === "string" && onDotClickRef.current) onDotClickRef.current(id);
      });
      map.on("mouseenter", "wave-glow", () => {
        map!.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "wave-glow", () => {
        map!.getCanvas().style.cursor = "";
      });
    });
    return () => {
      disposed = true;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Push live dot updates (map survives; only the data layer refreshes)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("wave-dots")) return;
    (map.getSource("wave-dots") as GeoJSONSource).setData(
      toFeatureCollection(dots)
    );
  }, [dots]);

  return <div ref={containerRef} className={`select-none ${className}`} />;
}