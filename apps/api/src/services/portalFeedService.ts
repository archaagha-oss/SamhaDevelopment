// ============================================================
// Portal Feed Service — outbound XML for Bayut / Property Finder / Dubizzle
// ============================================================
// All three UAE portals support pulling an XML feed from a public URL on a
// schedule (typical: every 30–60 min). This service queries portal-enabled
// units and renders the feed in each portal's expected schema.
//
// References (public docs):
// - Property Finder "Trakheesi XML" feed
// - Bayut XML feed (compatible subset of PF schema)
// - Dubizzle XML feed (uses dpf namespace)
// ============================================================

import { prisma } from "../lib/prisma";

export type PortalName = "bayut" | "propertyfinder" | "dubizzle";

const SQM_TO_SQFT = 10.7639;

function xmlEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  // Closing-CDATA-safe
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

// Portal property type codes
function mapPropertyType(unitType: string, portal: PortalName): string {
  const t = unitType.toUpperCase();
  if (portal === "dubizzle") {
    // Dubizzle uses "AP" / "VH" / "TH" / "PH"
    if (t === "VILLA") return "VH";
    if (t === "TOWNHOUSE") return "TH";
    if (t === "PENTHOUSE") return "PH";
    return "AP";
  }
  // Bayut & Property Finder use full names
  if (t === "VILLA") return "Villa";
  if (t === "TOWNHOUSE") return "Townhouse";
  if (t === "PENTHOUSE") return "Penthouse";
  return "Apartment";
}

function bedroomCount(unitType: string): number {
  const t = unitType.toUpperCase();
  if (t === "STUDIO") return 0;
  const match = t.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
}

function formatDate(d: Date): string {
  // YYYY-MM-DD HH:mm:ss in UTC
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

interface FeedUnit {
  id: string;
  unitNumber: string;
  type: string;
  area: number;
  price: number;
  view: string;
  bathrooms: number | null;
  parkingSpaces: number | null;
  trakheesiPermit: string | null;
  portalTitle: string | null;
  portalDescription: string | null;
  updatedAt: Date;
  project: {
    name: string;
    location: string;
    description: string | null;
  };
  images: { url: string; sortOrder: number }[];
}

async function loadFeedUnits(): Promise<FeedUnit[]> {
  const rows = await prisma.unit.findMany({
    where: {
      portalEnabled: true,
      status: "AVAILABLE",
      trakheesiPermit: { not: null },
    },
    include: {
      project: { select: { name: true, location: true, description: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  return rows as unknown as FeedUnit[];
}

function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");
}

function absoluteImageUrl(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const base = publicBaseUrl();
  if (!base) return relativeOrAbsolute;
  return `${base}${relativeOrAbsolute.startsWith("/") ? "" : "/"}${relativeOrAbsolute}`;
}

// ---- Property Finder / Bayut format (Trakheesi XML) ----------------------

function renderPFOrBayut(units: FeedUnit[], portal: "bayut" | "propertyfinder"): string {
  const items = units.map((u) => {
    const title = u.portalTitle || `${u.type.replace(/_/g, " ")} in ${u.project.name}`;
    const description = u.portalDescription || u.project.description || title;
    const sizeSqft = Math.round(u.area * SQM_TO_SQFT);
    const images = u.images
      .map((img) => `      <image><url>${xmlEscape(absoluteImageUrl(img.url))}</url></image>`)
      .join("\n");

    return `  <property>
    <reference_number>${xmlEscape(u.id)}</reference_number>
    <permit_number>${xmlEscape(u.trakheesiPermit)}</permit_number>
    <offering_type>RS</offering_type>
    <property_type>${xmlEscape(mapPropertyType(u.type, portal))}</property_type>
    <title_en>${cdata(title)}</title_en>
    <description_en>${cdata(description)}</description_en>
    <price>${u.price}</price>
    <price_on_application>no</price_on_application>
    <size>${sizeSqft}</size>
    <bedroom>${bedroomCount(u.type)}</bedroom>
    <bathroom>${u.bathrooms ?? 1}</bathroom>
    <parking>${u.parkingSpaces ?? 0}</parking>
    <city>Dubai</city>
    <community>${xmlEscape(u.project.location)}</community>
    <sub_community>${xmlEscape(u.project.name)}</sub_community>
    <last_update>${xmlEscape(formatDate(u.updatedAt))}</last_update>
${images ? `    <images>\n${images}\n    </images>` : "    <images></images>"}
  </property>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<list>
${items.join("\n")}
</list>
`;
}

// ---- Dubizzle format ----------------------------------------------------

function renderDubizzle(units: FeedUnit[]): string {
  const items = units.map((u) => {
    const title = u.portalTitle || `${u.type.replace(/_/g, " ")} in ${u.project.name}`;
    const description = u.portalDescription || u.project.description || title;
    const sizeSqft = Math.round(u.area * SQM_TO_SQFT);
    const images = u.images
      .map((img) => `      <dpf:image><dpf:url>${xmlEscape(absoluteImageUrl(img.url))}</dpf:url></dpf:image>`)
      .join("\n");

    return `  <dpf:property>
    <dpf:reference_number>${xmlEscape(u.id)}</dpf:reference_number>
    <dpf:permit_number>${xmlEscape(u.trakheesiPermit)}</dpf:permit_number>
    <dpf:property_type>${xmlEscape(mapPropertyType(u.type, "dubizzle"))}</dpf:property_type>
    <dpf:offering_type>RS</dpf:offering_type>
    <dpf:title_en>${cdata(title)}</dpf:title_en>
    <dpf:description_en>${cdata(description)}</dpf:description_en>
    <dpf:price>${u.price}</dpf:price>
    <dpf:size>${sizeSqft}</dpf:size>
    <dpf:bedroom>${bedroomCount(u.type)}</dpf:bedroom>
    <dpf:bathroom>${u.bathrooms ?? 1}</dpf:bathroom>
    <dpf:city>Dubai</dpf:city>
    <dpf:community>${xmlEscape(u.project.location)}</dpf:community>
    <dpf:sub_community>${xmlEscape(u.project.name)}</dpf:sub_community>
    <dpf:last_update>${xmlEscape(formatDate(u.updatedAt))}</dpf:last_update>
${images ? `    <dpf:images>\n${images}\n    </dpf:images>` : "    <dpf:images></dpf:images>"}
  </dpf:property>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<dpf:list xmlns:dpf="http://www.dubizzle.com/dpf">
${items.join("\n")}
</dpf:list>
`;
}

export async function buildPortalFeed(portal: PortalName): Promise<string> {
  const units = await loadFeedUnits();
  if (portal === "dubizzle") return renderDubizzle(units);
  return renderPFOrBayut(units, portal);
}
