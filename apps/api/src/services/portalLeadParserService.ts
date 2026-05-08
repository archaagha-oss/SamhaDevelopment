// ============================================================
// Portal Lead Parser — Bayut / Property Finder / Dubizzle
// ============================================================
// Parses portal lead emails (text or HTML) into a normalised lead payload.
// Each portal has its own subject conventions and body layout; we detect
// the portal first, then run a portal-specific extractor. Unparseable
// emails fall back to UNKNOWN with the raw body kept in `notes`.
// ============================================================

export type DetectedPortal = "BAYUT" | "PROPERTY_FINDER" | "DUBIZZLE" | "UNKNOWN";

export interface ParsedPortalLead {
  portal: DetectedPortal;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  message?: string;
  propertyReference?: string; // unit reference number, when present
  rawSubject: string;
  rawBody: string;
}

// ---- portal detection ---------------------------------------------------

export function detectPortal(subject: string, fromAddress: string, body: string): DetectedPortal {
  const s = `${subject} ${fromAddress}`.toLowerCase();
  if (s.includes("bayut")) return "BAYUT";
  if (s.includes("propertyfinder") || s.includes("property finder") || s.includes("propertyfinder.ae"))
    return "PROPERTY_FINDER";
  if (s.includes("dubizzle")) return "DUBIZZLE";

  // Body fallback (some forwarders strip the From header)
  const b = body.toLowerCase();
  if (b.includes("bayut.com")) return "BAYUT";
  if (b.includes("propertyfinder.ae") || b.includes("propertyfinder.com")) return "PROPERTY_FINDER";
  if (b.includes("dubizzle.com")) return "DUBIZZLE";

  return "UNKNOWN";
}

// ---- helpers ------------------------------------------------------------

const FIELD_LABEL_REGEX = (...labels: string[]) =>
  new RegExp(`(?:^|\\n)\\s*(?:${labels.join("|")})\\s*[:\\-]?\\s*(.+?)(?:\\n|$)`, "i");

function pick(body: string, ...labels: string[]): string | undefined {
  const m = body.match(FIELD_LABEL_REGEX(...labels));
  if (!m) return undefined;
  const v = m[1].trim();
  return v.length ? v : undefined;
}

function splitName(full: string | undefined): { firstName: string; lastName: string } {
  if (!full) return { firstName: "", lastName: "" };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalisePhone(raw: string | undefined): string {
  if (!raw) return "";
  // Keep digits, leading +, and a single space between groups
  const trimmed = raw.replace(/[^\d+]/g, "");
  if (!trimmed) return "";
  // UAE local number that drops country code
  if (/^0?5\d{8}$/.test(trimmed)) return `+971${trimmed.replace(/^0/, "")}`;
  if (trimmed.startsWith("+")) return trimmed;
  if (/^\d{10,}$/.test(trimmed)) return `+${trimmed}`;
  return trimmed;
}

// ---- portal-specific extractors ----------------------------------------

function parseBayut(subject: string, body: string): Omit<ParsedPortalLead, "portal" | "rawSubject" | "rawBody"> {
  const fullName = pick(body, "Name", "Full Name", "Lead Name", "Customer Name");
  const { firstName, lastName } = splitName(fullName);
  return {
    firstName,
    lastName,
    phone: normalisePhone(pick(body, "Mobile", "Phone", "Phone Number", "Contact", "Tel")),
    email: pick(body, "Email", "Email Address", "E-mail"),
    message: pick(body, "Message", "Comments", "Inquiry", "Note"),
    propertyReference: pick(body, "Property Reference", "Reference", "Ref", "Property ID", "Listing ID"),
  };
}

function parsePropertyFinder(subject: string, body: string): Omit<ParsedPortalLead, "portal" | "rawSubject" | "rawBody"> {
  const fullName = pick(body, "Name", "Lead Name", "Client Name", "Customer");
  const { firstName, lastName } = splitName(fullName);
  return {
    firstName,
    lastName,
    phone: normalisePhone(pick(body, "Phone", "Mobile", "Phone Number", "Tel")),
    email: pick(body, "Email", "E-mail"),
    message: pick(body, "Message", "Inquiry", "Comments"),
    propertyReference: pick(body, "Reference", "Property Reference", "Listing Reference", "Ref"),
  };
}

function parseDubizzle(subject: string, body: string): Omit<ParsedPortalLead, "portal" | "rawSubject" | "rawBody"> {
  const fullName = pick(body, "Name", "From", "Sender", "Customer Name");
  const { firstName, lastName } = splitName(fullName);
  return {
    firstName,
    lastName,
    phone: normalisePhone(pick(body, "Mobile", "Phone", "Contact Number", "Tel")),
    email: pick(body, "Email", "E-mail"),
    message: pick(body, "Message", "Comments", "Inquiry"),
    propertyReference: pick(body, "Ad ID", "Reference", "Listing ID", "Property Reference"),
  };
}

// ---- public API ---------------------------------------------------------

export function parsePortalLeadEmail(input: {
  subject: string;
  fromAddress: string;
  body: string;
}): ParsedPortalLead {
  const portal = detectPortal(input.subject, input.fromAddress, input.body);
  const base = { rawSubject: input.subject, rawBody: input.body };

  if (portal === "BAYUT") return { portal, ...parseBayut(input.subject, input.body), ...base };
  if (portal === "PROPERTY_FINDER") return { portal, ...parsePropertyFinder(input.subject, input.body), ...base };
  if (portal === "DUBIZZLE") return { portal, ...parseDubizzle(input.subject, input.body), ...base };

  return {
    portal: "UNKNOWN",
    firstName: "",
    lastName: "",
    phone: "",
    ...base,
  };
}
