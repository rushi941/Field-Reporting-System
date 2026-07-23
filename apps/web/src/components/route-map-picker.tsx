import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type RouteValue = {
  label?: string | null;
  startLat: number;
  startLng: number;
  startLabel?: string | null;
  endLat: number;
  endLng: number;
  endLabel?: string | null;
  beginSta?: string | null;
  endSta?: string | null;
  polyline: [number, number][] | null;
  distanceMeters: number | null;
};

type Props = {
  value: RouteValue | null;
  onChange: (value: RouteValue | null) => void;
};

type PlaceHit = {
  display_name: string;
  lat: string;
  lon: string;
};

const startIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#1a7f37;color:#fff;border-radius:999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font:700 13px/1 system-ui;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">A</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const endIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#c62828;color:#fff;border-radius:999px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font:700 13px/1 system-ui;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)">B</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function ClickPins({
  step,
  onPick,
}: {
  step: "start" | "end" | "done";
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (step === "done") return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitRoute({
  start,
  end,
  polyline,
}: {
  start?: [number, number] | null;
  end?: [number, number] | null;
  polyline?: [number, number][] | null;
}) {
  const map = useMap();
  useEffect(() => {
    const pts: [number, number][] = [];
    if (polyline?.length) pts.push(...polyline);
    else {
      if (start) pts.push(start);
      if (end) pts.push(end);
    }
    if (pts.length >= 2) {
      map.fitBounds(L.latLngBounds(pts), { padding: [36, 36], maxZoom: 14 });
    } else if (pts.length === 1) {
      map.setView(pts[0], 14, { animate: true });
    }
  }, [map, start?.[0], start?.[1], end?.[0], end?.[1], polyline]);
  return null;
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, 15, { duration: 0.85 });
  }, [map, target?.[0], target?.[1]]);
  return null;
}

async function reverseLabel(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const data = (await res.json()) as {
      name?: string;
      display_name?: string;
      address?: { road?: string; city?: string; town?: string; state?: string };
    };
    const road = data.address?.road;
    const city = data.address?.city || data.address?.town;
    const state = data.address?.state;
    const short = [road, city, state].filter(Boolean).join(", ");
    return short || data.name || data.display_name?.split(",").slice(0, 3).join(",") ||
      `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}

async function searchPlaces(q: string): Promise<PlaceHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&countrycodes=us&addressdetails=0`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  return (await res.json()) as PlaceHit[];
}

async function fetchOsrmRoute(
  start: [number, number],
  end: [number, number],
): Promise<{ polyline: [number, number][]; distanceMeters: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      routes?: { distance: number; geometry: { coordinates: [number, number][] } }[];
    };
    const route = data.routes?.[0];
    if (!route) return null;
    const polyline = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng] as [number, number],
    );
    return { polyline, distanceMeters: route.distance };
  } catch {
    return null;
  }
}

export function RouteMapPicker({ value, onChange }: Props) {
  const [step, setStep] = useState<"start" | "end" | "done">(
    value ? "done" : "start",
  );
  const [draft, setDraft] = useState<Partial<RouteValue>>(value ?? {});
  const [routing, setRouting] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const searchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (value) {
      setDraft(value);
      setStep("done");
    }
  }, [value]);

  const center = useMemo<[number, number]>(() => {
    if (draft.startLat != null && draft.startLng != null) {
      return [draft.startLat, draft.startLng];
    }
    return [42.0308, -93.6319];
  }, [draft.startLat, draft.startLng]);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    if (query.trim().length < 3) {
      setHits([]);
      return;
    }
    searchTimer.current = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          setHits(await searchPlaces(query.trim()));
        } finally {
          setSearching(false);
        }
      })();
    }, 350);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [query]);

  async function applyPins(
    next: Partial<RouteValue> & {
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
    },
  ) {
    setRouting(true);
    const routed = await fetchOsrmRoute(
      [next.startLat, next.startLng],
      [next.endLat, next.endLng],
    );
    setRouting(false);
    const full: RouteValue = {
      label: next.label ?? "Work route",
      startLat: next.startLat,
      startLng: next.startLng,
      startLabel: next.startLabel ?? "Start",
      endLat: next.endLat,
      endLng: next.endLng,
      endLabel: next.endLabel ?? "End",
      polyline: routed?.polyline ?? [
        [next.startLat, next.startLng],
        [next.endLat, next.endLng],
      ],
      distanceMeters: routed?.distanceMeters ?? null,
    };
    setDraft(full);
    setStep("done");
    onChange(full);
  }

  async function onPick(lat: number, lng: number) {
    const label = await reverseLabel(lat, lng);
    if (step === "start") {
      setDraft((d) => ({
        ...d,
        startLat: lat,
        startLng: lng,
        startLabel: label,
      }));
      setStep("end");
      setFlyTarget([lat, lng]);
      return;
    }
    if (step === "end" && draft.startLat != null && draft.startLng != null) {
      await applyPins({
        ...draft,
        startLat: draft.startLat,
        startLng: draft.startLng,
        endLat: lat,
        endLng: lng,
        endLabel: label,
      });
    }
  }

  async function usePlace(hit: PlaceHit) {
    const lat = Number(hit.lat);
    const lng = Number(hit.lon);
    setQuery("");
    setHits([]);
    setFlyTarget([lat, lng]);
    if (step === "done") setStep("start");
    await onPick(lat, lng);
  }

  function clearRoute() {
    setDraft({});
    setStep("start");
    onChange(null);
  }

  const hasStart = draft.startLat != null && draft.startLng != null;
  const hasEnd = draft.endLat != null && draft.endLng != null;
  const pinning = step !== "done";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Work route on map</p>
          <p className="text-xs text-muted-foreground">
            Search a place or click the map — like Google Maps pins A → B
          </p>
        </div>
        <div className="flex gap-2">
          {step === "done" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep("start")}
            >
              Re-pin
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={clearRoute}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {(
          [
            ["start", "1. Start (A)"],
            ["end", "2. End (B)"],
            ["done", "3. Route"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (key === "done" && !(hasStart && hasEnd)) return;
              setStep(key);
            }}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition",
              step === key
                ? "border-asphalt bg-asphalt text-white"
                : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={
            step === "end"
              ? "Search end place (city, road, landmark)…"
              : "Search start place (city, road, landmark)…"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={step === "done"}
        />
        {searching && (
          <Loader2 className="absolute top-2.5 right-3 size-4 animate-spin text-muted-foreground" />
        )}
        {hits.length > 0 && (
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-card shadow-lg">
            {hits.map((h) => (
              <li key={`${h.lat}-${h.lon}-${h.display_name}`}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => void usePlace(h)}
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-lane" />
                  <span className="line-clamp-2">{h.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className={cn(
          "map-stack h-72 overflow-hidden rounded-md border border-border shadow-sm",
          pinning && "map-pinning",
        )}
      >
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickPins step={step} onPick={(lat, lng) => void onPick(lat, lng)} />
          <FlyTo target={flyTarget} />
          <FitRoute
            start={
              hasStart ? [draft.startLat!, draft.startLng!] : null
            }
            end={hasEnd ? [draft.endLat!, draft.endLng!] : null}
            polyline={draft.polyline}
          />
          {hasStart && (
            <Marker
              position={[draft.startLat!, draft.startLng!]}
              icon={startIcon}
            />
          )}
          {hasEnd && (
            <Marker position={[draft.endLat!, draft.endLng!]} icon={endIcon} />
          )}
          {draft.polyline && draft.polyline.length > 1 && (
            <Polyline
              positions={draft.polyline}
              pathOptions={{ color: "#c9a227", weight: 5, opacity: 0.9 }}
            />
          )}
        </MapContainer>
      </div>

      <p className="text-xs text-muted-foreground">
        {step === "start" && "Click the map or pick a search result for start (A)."}
        {step === "end" && "Now set end (B) — route draws automatically."}
        {step === "done" &&
          (routing
            ? "Building driving route…"
            : draft.distanceMeters != null
              ? `Pinned · ~${(draft.distanceMeters / 1609.34).toFixed(1)} mi driving`
              : "Route pinned")}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Start (A) label</Label>
          <Input
            value={draft.startLabel ?? ""}
            onChange={(e) => {
              const startLabel = e.target.value;
              setDraft((d) => ({ ...d, startLabel }));
              if (value) onChange({ ...value, startLabel });
            }}
            placeholder="Auto-filled from place"
          />
        </div>
        <div className="space-y-1.5">
          <Label>End (B) label</Label>
          <Input
            value={draft.endLabel ?? ""}
            onChange={(e) => {
              const endLabel = e.target.value;
              setDraft((d) => ({ ...d, endLabel }));
              if (value) onChange({ ...value, endLabel });
            }}
            placeholder="Auto-filled from place"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Begin STA</Label>
          <Input
            value={draft.beginSta ?? ""}
            onChange={(e) => {
              const beginSta = e.target.value;
              setDraft((d) => ({ ...d, beginSta }));
              if (value) onChange({ ...value, beginSta });
            }}
            placeholder="e.g. 100+00"
          />
        </div>
        <div className="space-y-1.5">
          <Label>End STA</Label>
          <Input
            value={draft.endSta ?? ""}
            onChange={(e) => {
              const endSta = e.target.value;
              setDraft((d) => ({ ...d, endSta }));
              if (value) onChange({ ...value, endSta });
            }}
            placeholder="e.g. 105+00"
          />
        </div>
      </div>
    </div>
  );
}
