import { useEffect, useRef, useState } from "react";
import type { MarkerClusterer } from "@googlemaps/markerclusterer";
import { colorOfLabel } from "@/lib/categories";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MapMarker = { id: string; lat: number; lng: number; category: string; label: string; badge?: string | undefined };

/** True only for real coordinates (expired ones are null/NaN; (0,0) is never a valid place here). */
export const hasCoords = (m: { lat: number | null; lng: number | null }) => Number.isFinite(m.lat) && Number.isFinite(m.lng) && !(m.lat === 0 && m.lng === 0);
export const CATEGORY_COLORS = { Outros: "#123A32" };

let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    w.__ceVaiMapsReady = () => resolve();
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    const channel = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"];
    if (!key) { reject(new Error("missing key")); return; }
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__ceVaiMapsReady&channel=${channel ?? ""}&language=pt-BR&region=BR`;
    s.async = true;
    s.onerror = () => { loader = null; reject(new Error("load failed")); };
    document.head.appendChild(s);
  });
  return loader;
}

export type MapArea = { lat: number; lng: number; radius: number };

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function MapView({ center, user, markers, selectedId, onSelect, onIdle, cluster = false, fit = true, className = "" }: {
  center: { lat: number; lng: number };
  user?: { lat: number; lng: number } | null;
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called after the user stops moving/zooming, with the visible area. */
  onIdle?: (area: MapArea) => void;
  cluster?: boolean;
  /** Auto-fit bounds to markers. Disable when the viewport drives the search. */
  fit?: boolean;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pins = useRef<any[]>([]);
  const clusterer = useRef<MarkerClusterer | null>(null);
  const clustererClass = useRef<typeof MarkerClusterer | null>(null);
  const userPin = useRef<any>(null);
  const idleRef = useRef(onIdle);
  idleRef.current = onIdle;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadMaps(), import("@googlemaps/markerclusterer")]).then(([, module]) => {
      if (!alive || !el.current) return;
      clustererClass.current = module.MarkerClusterer;
      const g = (window as any).google;
      map.current = new g.maps.Map(el.current, {
        center, zoom: 13, disableDefaultUI: true, zoomControl: false, clickableIcons: false, gestureHandling: "greedy",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "transit", stylers: [{ visibility: "off" }] }],
      });
      map.current.addListener("idle", () => {
        const b = map.current.getBounds(); const c = map.current.getCenter();
        if (!b || !c) return;
        const ctr = { lat: c.lat(), lng: c.lng() };
        const ne = b.getNorthEast();
        const radius = Math.round(Math.min(25000, Math.max(300, haversine(ctr, { lat: ne.lat(), lng: ne.lng() }))));
        idleRef.current?.({ ...ctr, radius });
      });
      setReady(true);
    }).catch(() => alive && setFailed(true));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const g = (window as any).google;
    pins.current.forEach((m) => m.setMap(null));
    clusterer.current?.clearMarkers();
    // Places whose coordinates expired (lat/lng null) are never drawn, so nothing lands at (0,0).
    markers = markers.filter(hasCoords);
    pins.current = markers.map((m) => {
      const selected = m.id === selectedId;
      const marker = new g.maps.Marker({
        map: cluster ? null : map.current, position: { lat: m.lat, lng: m.lng }, title: m.label, label: m.badge ? { text: m.badge, fontSize: "13px" } : undefined, zIndex: selected ? 10 : 1,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: selected ? 13 : 9, fillColor: colorOfLabel(m.category), fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 },
      });
      marker.addListener("click", () => onSelect?.(m.id));
      return marker;
    });
    if (cluster) {
      if (!clusterer.current && clustererClass.current) {
        clusterer.current = new clustererClass.current({
          map: map.current,
          algorithmOptions: { maxZoom: 15, radius: 60 } as any,
          renderer: {
            render: ({ count, position }: any) => new g.maps.Marker({
              position, zIndex: 1000 + count,
              label: { text: String(count), color: "#ffffff", fontSize: "13px", fontWeight: "800" },
              icon: { path: g.maps.SymbolPath.CIRCLE, scale: count >= 10 ? 19 : 16, fillColor: "#E86024", fillOpacity: 0.95, strokeColor: "#ffffff", strokeWeight: 3 },
            }),
          },
        });
      }
      clusterer.current?.addMarkers(pins.current);
    }
    if (!fit) return;
    if (markers.length > 1 && !selectedId) {
      const bounds = new g.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      if (user) bounds.extend(user);
      map.current.fitBounds(bounds, 48);
    } else if (markers.length === 1 && markers[0]) {
      map.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
    }
  }, [ready, markers, selectedId, onSelect, user, cluster, fit]);

  // Viewport-driven maps: follow external center changes (e.g. "Minha localização").
  useEffect(() => {
    if (!ready || fit) return;
    map.current.panTo(center);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fit, center.lat, center.lng]);

  useEffect(() => {
    if (!ready) return;
    const g = (window as any).google;
    userPin.current?.setMap(null);
    if (user) userPin.current = new g.maps.Marker({ map: map.current, position: user, title: "Você está aqui", zIndex: 20, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#1A73E8", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 } });
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const m = markers.find((x) => x.id === selectedId);
    if (m && hasCoords(m)) map.current.panTo({ lat: m.lat, lng: m.lng });
  }, [ready, selectedId, markers]);

  // "relative" and "absolute" conflict (relative won, collapsing a full-screen map to 0px); only add it when not positioned.
  return <div className={`${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} bg-muted ${className}`}>
    <div ref={el} className="absolute inset-0" />
    {!ready && <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-muted-foreground">{failed ? "Não foi possível carregar o mapa." : "Carregando mapa…"}</div>}
  </div>;
}
