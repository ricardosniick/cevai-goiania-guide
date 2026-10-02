import { useEffect, useRef, useState } from "react";
import { colorOfLabel } from "@/lib/categories";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type MapMarker = { id: string; lat: number; lng: number; category: string; label: string; badge?: string };

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

export function MapView({ center, user, markers, selectedId, onSelect, className = "" }: {
  center: { lat: number; lng: number };
  user?: { lat: number; lng: number } | null;
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const pins = useRef<any[]>([]);
  const userPin = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadMaps().then(() => {
      if (!alive || !el.current) return;
      const g = (window as any).google;
      map.current = new g.maps.Map(el.current, {
        center, zoom: 13, disableDefaultUI: true, zoomControl: false, clickableIcons: false, gestureHandling: "greedy",
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }, { featureType: "transit", stylers: [{ visibility: "off" }] }],
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
    pins.current = markers.map((m) => {
      const selected = m.id === selectedId;
      const marker = new g.maps.Marker({
        map: map.current, position: { lat: m.lat, lng: m.lng }, title: m.label, label: m.badge ? { text: m.badge, fontSize: "13px" } : undefined, zIndex: selected ? 10 : 1,
        icon: { path: g.maps.SymbolPath.CIRCLE, scale: selected ? 13 : 9, fillColor: colorOfLabel(m.category), fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 },
      });
      marker.addListener("click", () => onSelect?.(m.id));
      return marker;
    });
    if (markers.length > 1 && !selectedId) {
      const bounds = new g.maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      if (user) bounds.extend(user);
      map.current.fitBounds(bounds, 48);
    } else if (markers.length === 1 && markers[0]) {
      map.current.setCenter({ lat: markers[0].lat, lng: markers[0].lng });
    }
  }, [ready, markers, selectedId, onSelect, user]);

  useEffect(() => {
    if (!ready) return;
    const g = (window as any).google;
    userPin.current?.setMap(null);
    if (user) userPin.current = new g.maps.Marker({ map: map.current, position: user, title: "Você está aqui", zIndex: 20, icon: { path: g.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#1A73E8", fillOpacity: 1, strokeColor: "#ffffff", strokeWeight: 3 } });
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const m = markers.find((x) => x.id === selectedId);
    if (m) map.current.panTo({ lat: m.lat, lng: m.lng });
  }, [ready, selectedId, markers]);

  return <div className={`relative bg-muted ${className}`}>
    <div ref={el} className="absolute inset-0" />
    {!ready && <div className="absolute inset-0 grid place-items-center text-sm font-semibold text-muted-foreground">{failed ? "Não foi possível carregar o mapa." : "Carregando mapa…"}</div>}
  </div>;
}
