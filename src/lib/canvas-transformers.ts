import { VenueLayoutDetail, VenueSeat, VenueZone } from "@/types/api";
import type { SeatMetadataExtended, VenueTableDetail } from "@/types/venue-extended";
import { CustomFabricObject, Zone, RemoteSeatPayload } from "@/types/canvas";
import { Circle, Rect, Polygon, Group, Point } from "fabric";

const DEFAULT_SEAT_SIZE = 28;
const DEFAULT_SEAT_COLOR = "#0EA5E9";
const DEFAULT_SEAT_STROKE = "#1e293b";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Transform DB seat to Fabric-ready payload
 */
export const mapSeatFromDb = (seat: VenueSeat): RemoteSeatPayload => {
  const metadata = (seat.metadata ?? {}) as SeatMetadataExtended;
  const canvasMeta = metadata.canvas;
  const canvasLabel = canvasMeta?.label;
  const tableId = metadata.tableId;

  return {
    id: seat.id,
    label: seat.label,
    name: canvasLabel ?? seat.label,
    zoneId: seat.zoneId,
    seatType: mapSeatTypeFromApi(seat.seatType),
    status: mapSeatStatusFromApi(seat.status),
    price: seat.basePrice ?? undefined,
    tableId,
    metadata: seat.metadata ?? null,
  };
};

/**
 * Transform DB zone to canvas Zone
 */
export const mapZoneFromDb = (zone: VenueZone): Zone => {
  const metadata = zone.metadata ?? {};
  const canvasMeta = isRecord(metadata["canvas"]) ? metadata["canvas"] : undefined;
  const typeValue = typeof canvasMeta?.type === "string" ? canvasMeta.type as Zone["type"] : undefined;
  const capacityMeta = isRecord(metadata) && typeof metadata["capacity"] === "number" ? metadata["capacity"] : undefined;
  const capacityValue = capacityMeta ?? (typeof canvasMeta?.capacity === "number" ? canvasMeta.capacity : undefined);
  const visibleValue = typeof canvasMeta?.visible === "boolean" ? canvasMeta.visible : true;

  return {
    id: zone.id,
    name: zone.name,
    color: zone.color ?? undefined,
    price: zone.basePrice ?? undefined,
    capacity: capacityValue,
    type: typeValue ?? "section",
    visible: visibleValue,
  };
};

/**
 * Reconstruct table Group from DB table + seats
 */
export const reconstructTableFromDb = (
  table: VenueTableDetail,
  seats: VenueSeat[]
): Group => {
  const tableMeta = table.metadata as Record<string, unknown> | null;
  const tableSeats = seats.filter((s) => {
    const meta = s.metadata as SeatMetadataExtended | null;
    return meta?.tableId === table.id;
  });

  const seatObjects: CustomFabricObject[] = tableSeats.map((seat) => {
    const meta = seat.metadata as SeatMetadataExtended;
    const offsetX = meta.offsetX ?? 0;
    const offsetY = meta.offsetY ?? 0;
    const angle = meta.angle ?? 0;
    const shape = meta.shape ?? "circle";
    const radius = meta.radius ?? DEFAULT_SEAT_SIZE / 2;
    const fill = meta.fill ?? DEFAULT_SEAT_COLOR;
    const stroke = meta.stroke ?? DEFAULT_SEAT_STROKE;

    let seatObj: CustomFabricObject;
    if (shape === "square" || shape === "rect") {
      seatObj = new Rect({
        left: table.centerX + offsetX,
        top: table.centerY + offsetY,
        width: meta.canvas?.size?.width ?? DEFAULT_SEAT_SIZE,
        height: meta.canvas?.size?.height ?? DEFAULT_SEAT_SIZE,
        angle,
        fill,
        stroke,
        strokeWidth: meta.strokeWidth ?? 1,
        rx: meta.cornerRadius ?? 4,
        ry: meta.cornerRadius ?? 4,
      }) as any as CustomFabricObject;
    } else {
      seatObj = new Circle({
        left: table.centerX + offsetX,
        top: table.centerY + offsetY,
        radius,
        angle,
        fill,
        stroke,
        strokeWidth: meta.strokeWidth ?? 1,
      }) as any as CustomFabricObject;
    }

    seatObj.id = seat.id;
    seatObj.name = seat.label;
    seatObj._customType = "seat";
    seatObj.tableId = table.id;
    seatObj.status = seat.status as any;
    seatObj.seatType = mapSeatTypeFromApi(seat.seatType) as any;
    return seatObj;
  });

  const group = new Group(seatObjects as any, {
    left: table.centerX,
    top: table.centerY,
    angle: table.rotation,
  });

  (group as any)._customType = "table";
  (group as any).tableId = table.id;
  (group as any).shape = table.shape;
  (group as any).seatCount = table.seatCount;

  return group;
};

/**
 * Reconstruct zone polygon from metadata
 */
export const reconstructZonePolygon = (zone: Zone): Polygon | null => {
  const metadata = zone as any;
  const points = metadata.points as Array<{ x: number; y: number }> | undefined;
  if (!points || points.length < 3) return null;

  const poly = new Polygon(points.map((p) => new Point(p.x, p.y)), {
    fill: zone.color ?? "rgba(14, 165, 233, 0.1)",
    stroke: zone.color ?? "#0EA5E9",
    strokeWidth: 2,
    selectable: true,
    objectCaching: false,
  });

  (poly as any)._customType = "zone";
  (poly as any).zoneId = zone.id;
  (poly as any).name = zone.name;
  return poly;
};

const mapSeatTypeFromApi = (value?: string | null) => {
  switch ((value ?? "").toLowerCase()) {
    case "vip": return "vip";
    case "accessible": return "accessible";
    case "blocked":
    case "companion": return "blocked";
    default: return "regular";
  }
};

const mapSeatStatusFromApi = (value?: string | null) => {
  switch ((value ?? "").toLowerCase()) {
    case "reserved": return "reserved";
    case "sold": return "sold";
    case "blocked": return "blocked";
    case "selected": return "selected";
    default: return "available";
  }
};
