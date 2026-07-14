import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type RouteView = {
  startLat: number;
  startLng: number;
  startLabel?: string | null;
  endLat: number;
  endLng: number;
  endLabel?: string | null;
  polyline?: [number, number][] | null;
  distanceMeters?: number | null;
};

const startIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#1a7f37;color:#fff;border-radius:999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">A</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const endIcon = new L.DivIcon({
  className: "",
  html: `<div style="background:#c62828;color:#fff;border-radius:999px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">B</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export function RouteMapView({ route }: { route: RouteView }) {
  const center: [number, number] = [route.startLat, route.startLng];
  const miles =
    route.distanceMeters != null
      ? (route.distanceMeters / 1609.34).toFixed(1)
      : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          <strong className="text-foreground">A</strong>{" "}
          {route.startLabel || "Start"}
        </span>
        <span>→</span>
        <span>
          <strong className="text-foreground">B</strong>{" "}
          {route.endLabel || "End"}
        </span>
        {miles && <span>~{miles} mi</span>}
      </div>
      <div className="map-stack h-52 overflow-hidden rounded-md border border-border">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; OSM'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[route.startLat, route.startLng]} icon={startIcon} />
          <Marker position={[route.endLat, route.endLng]} icon={endIcon} />
          {route.polyline && route.polyline.length > 1 && (
            <Polyline
              positions={route.polyline}
              pathOptions={{ color: "#c9a227", weight: 5 }}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
