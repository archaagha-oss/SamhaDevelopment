import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import UnitGallery from "./UnitGallery";
import { formatArea } from "../utils/formatArea";
import { useModalA11y } from "../hooks/useModalA11y";
import { formatAED } from "../lib/format";

interface Unit {
  id: string;
  unitNumber: string;
  floor: number;
  type: string;
  area: number;
  basePrice?: number;
  price: number;
  view: string;
  status: string;
  assignedAgentId?: string;
  bathrooms?: number;
  parkingSpaces?: number;
  internalArea?: number;
  externalArea?: number;
  blockReason?: string;
  blockExpiresAt?: string;
  internalNotes?: string;
  tags?: string[];
  pricePerSqft?: number;
  inquiryCount?: number;
  visitCount?: number;
}

interface StatusHistoryEntry {
  id: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  changedAt: string;
}

interface PriceHistoryEntry {
  id: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason?: string;
  changedAt: string;
}

interface ActiveDeal {
  id: string;
  dealNumber: string;
  stage: string;
  salePrice: number;
  lead: { firstName: string; lastName: string };
}

interface ActiveReservation {
  id: string;
  expiresAt: string;
  lead: { firstName: string; lastName: string };
}

interface Agent {
  id: string;
  name: string;
}

interface Props {
  unit: Unit;
  statusLabels: Record<string, string>;
  agents?: Agent[];
  onClose: () => void;
  onRefresh?: () => void;
  onEditUnit?: (unit: Unit) => void;
  onDeleted?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  NOT_RELEASED: "bg-muted text-muted-foreground",
  AVAILABLE:    "bg-success-soft text-success",
  RESERVED:     "bg-warning-soft text-warning",
  BOOKED:       "bg-stage-active text-stage-active-foreground",
  SOLD:         "bg-destructive-soft text-destructive",
  BLOCKED:      "bg-neutral-200 text-muted-foreground",
  HANDED_OVER:  "bg-chart-5/15 text-chart-5",
};

export default function UnitModal({ unit, statusLabels, agents = [], onClose, onRefresh, onEditUnit, onDeleted }: Props) {
  const navigate = useNavigate();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullUnit, setFullUnit] = useState<any>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({ open: true, onClose, containerRef: dialogRef });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlockInput, setShowBlockInput] = useState(false);
  const [assigningAgent, setAssigningAgent] = useState(false);

  useEffect(() => {
    axios.get(`/api/units/${unit.id}`)
      .then((r) => setFullUnit(r.data))
      .catch((err) => {
        console.error("Failed to fetch unit:", err.response?.data || err.message);
        setError(`Failed to load unit details: ${err.response?.data?.error || err.message}`);
      });
  }, [unit.id]);

  const history: StatusHistoryEntry[] = fullUnit?.statusHistory || [];
  const priceHistory: PriceHistoryEntry[] = fullUnit?.priceHistory || [];
  const activeDeal: ActiveDeal | undefined = fullUnit?.deals?.[0];
  const activeReservation: ActiveReservation | undefined = fullUnit?.reservations?.[0];
  const currentUnit = fullUnit || unit;

  const updateStatus = async (newStatus: string, reason?: string) => {
    setActing(true);
    setError(null);
    try {
      await axios.patch(`/api/units/${unit.id}/status`, { newStatus, reason });
      onRefresh?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to set status to ${newStatus}`);
    } finally {
      setActing(false);
    }
  };

  const handleBlock = async () => {
    if (!blockReason.trim()) { setError("A reason is required to block a unit."); return; }
    await updateStatus("BLOCKED", blockReason.trim());
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await axios.delete(`/api/units/${unit.id}`);
      onDeleted?.();
      onRefresh?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete unit");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleAssignAgent = async (agentId: string) => {
    setAssigningAgent(true);
    setError(null);
    try {
      await axios.patch(`/api/units/${unit.id}`, { assignedAgentId: agentId || null });
      onRefresh?.();
      setAssigningAgent(false);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to assign agent");
      setAssigningAgent(false);
    }
  };

  const canRelease  = currentUnit.status === "NOT_RELEASED";
  const canBlock    = ["AVAILABLE", "NOT_RELEASED"].includes(currentUnit.status) && !showBlockInput;
  const canUnblock  = currentUnit.status === "BLOCKED";
  const canEdit     = ["AVAILABLE", "BLOCKED", "NOT_RELEASED"].includes(currentUnit.status);
  const canDelete   = ["AVAILABLE", "NOT_RELEASED"].includes(currentUnit.status) && !activeDeal;

  const isAvailable = currentUnit.status === "AVAILABLE";
  const isReserved  = currentUnit.status === "RESERVED";
  const isBookedOrSold = currentUnit.status === "BOOKED" || currentUnit.status === "SOLD";

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Unit ${currentUnit.unitNumber}`}
        tabIndex={-1}
        className="
          fixed bg-card shadow-2xl flex flex-col overflow-hidden focus:outline-none
          left-0 right-0 bottom-0 top-16 rounded-t-2xl
          sm:left-auto sm:top-0 sm:bottom-0 sm:right-0 sm:rounded-none sm:rounded-l-2xl sm:w-[420px] sm:max-w-full
        ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-foreground leading-none">Unit {currentUnit.unitNumber}</h2>
            <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[currentUnit.status] || "bg-muted text-muted-foreground"}`}>
              {statusLabels[currentUnit.status] || currentUnit.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground text-2xl leading-none p-1 -m-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >×</button>
        </div>

        <div className="flex-1 overflow-y-auto">

        {/* Active Deal Banner */}
        {activeDeal && (
          <div
            className="mx-6 mt-4 bg-warning-soft border border-warning/30 rounded-xl p-3 cursor-pointer hover:bg-warning-soft transition-colors"
            onClick={() => navigate(`/deals/${activeDeal.id}`)}
          >
            <p className="text-xs font-semibold text-warning-soft-foreground mb-1">Active Deal</p>
            <p className="text-sm font-bold text-warning-soft-foreground">{activeDeal.dealNumber}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-warning">{activeDeal.lead.firstName} {activeDeal.lead.lastName}</p>
              <p className="text-xs text-warning font-medium">AED {activeDeal.salePrice.toLocaleString()}</p>
            </div>
            <p className="text-xs text-warning mt-0.5">{activeDeal.stage.replace(/_/g, " ")} →</p>
          </div>
        )}

        {/* Active Reservation Banner */}
        {activeReservation && !activeDeal && (
          <div className="mx-6 mt-4 bg-info-soft border border-primary/40 rounded-xl p-3">
            <p className="text-xs font-semibold text-primary mb-1">Active Reservation</p>
            <p className="text-sm text-primary">{activeReservation.lead.firstName} {activeReservation.lead.lastName}</p>
            <p className="text-xs text-primary mt-0.5">Expires {new Date(activeReservation.expiresAt).toLocaleDateString("en-AE")}</p>
          </div>
        )}

        {/* Gallery */}
        {fullUnit?.images && fullUnit.images.length > 0 ? (
          <UnitGallery images={fullUnit.images} />
        ) : (
          <div className="mx-6 mt-4 bg-muted/50 border border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">📸 No images added yet</p>
            <p className="text-xs text-muted-foreground mt-1">Images will appear here</p>
          </div>
        )}

        {/* Details */}
        <div className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Type",  currentUnit.type.replace(/_/g, " ")],
              ["Floor", `Floor ${currentUnit.floor}`],
              ["Area",  formatArea(currentUnit.area)],
              ["View",  currentUnit.view],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                <p className="font-semibold text-foreground text-sm">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-muted/50 rounded-xl p-3 mt-1">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Current Price</p>
                <p className="text-xl font-bold text-foreground">{formatAED(currentUnit.price)}</p>
              </div>
              {currentUnit.basePrice && currentUnit.basePrice !== currentUnit.price && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Base price</p>
                  <p className="text-sm text-muted-foreground line-through">{formatAED(currentUnit.basePrice)}</p>
                </div>
              )}
            </div>
          </div>

          {(currentUnit.pricePerSqft || (currentUnit.inquiryCount ?? 0) > 0 || (currentUnit.visitCount ?? 0) > 0) && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {currentUnit.pricePerSqft && (
                <div className="bg-info-soft rounded-lg p-2.5 text-center">
                  <p className="text-xs text-primary mb-0.5">Price / sqft</p>
                  <p className="font-semibold text-info-soft-foreground">AED {currentUnit.pricePerSqft.toLocaleString()}</p>
                </div>
              )}
              {(currentUnit.inquiryCount ?? 0) > 0 && (
                <div className="bg-warning-soft rounded-lg p-2.5 text-center">
                  <p className="text-xs text-warning mb-0.5">Inquiries</p>
                  <p className="font-semibold text-warning-soft-foreground">{currentUnit.inquiryCount}</p>
                </div>
              )}
              {(currentUnit.visitCount ?? 0) > 0 && (
                <div className="bg-success-soft rounded-lg p-2.5 text-center">
                  <p className="text-xs text-success mb-0.5">Site Visits</p>
                  <p className="font-semibold text-success-soft-foreground">{currentUnit.visitCount}</p>
                </div>
              )}
            </div>
          )}

          {(currentUnit.bathrooms || currentUnit.parkingSpaces || currentUnit.internalArea || currentUnit.externalArea) && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Physical Details</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {currentUnit.bathrooms && <div><span className="text-muted-foreground">Bathrooms:</span> <span className="font-semibold">{currentUnit.bathrooms}</span></div>}
                {currentUnit.parkingSpaces && <div><span className="text-muted-foreground">Parking:</span> <span className="font-semibold">{currentUnit.parkingSpaces}</span></div>}
                {currentUnit.internalArea && <div><span className="text-muted-foreground">Suite:</span> <span className="font-semibold">{formatArea(currentUnit.internalArea)}</span></div>}
                {currentUnit.externalArea && <div><span className="text-muted-foreground">Balcony:</span> <span className="font-semibold">{formatArea(currentUnit.externalArea)}</span></div>}
              </div>
            </div>
          )}

          {currentUnit.tags && currentUnit.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentUnit.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-info-soft text-primary px-2 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {currentUnit.blockReason && (
            <div className="bg-warning-soft border border-warning/30 rounded-lg p-3">
              <p className="text-xs font-semibold text-warning-soft-foreground">Block Reason</p>
              <p className="text-sm text-warning mt-1">{currentUnit.blockReason}</p>
              {currentUnit.blockExpiresAt && (
                <p className="text-xs text-warning mt-1">Expires {new Date(currentUnit.blockExpiresAt).toLocaleDateString("en-AE")}</p>
              )}
            </div>
          )}

          {currentUnit.internalNotes && (
            <div className="bg-info-soft border border-primary/40 rounded-lg p-3">
              <p className="text-xs font-semibold text-primary">Notes</p>
              <p className="text-sm text-primary mt-1">{currentUnit.internalNotes}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive-soft px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-4 space-y-2">
          {/* Status-conditional primary CTAs */}
          {isAvailable && (
            <button
              onClick={() => navigate(`/leads?createOfferForUnit=${currentUnit.id}`)}
              className="w-full py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Offer
            </button>
          )}
          {isReserved && activeDeal && (
            <button
              onClick={() => navigate(`/deals/${activeDeal.id}`)}
              className="w-full py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              View Deal
            </button>
          )}
          {isReserved && !activeDeal && (
            <button
              onClick={() => updateStatus("AVAILABLE", "Reservation released")}
              disabled={acting}
              className="w-full py-2.5 text-sm font-semibold border border-warning/30 text-warning rounded-lg hover:bg-warning-soft transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Release hold"}
            </button>
          )}
          {isBookedOrSold && activeDeal && (
            <button
              onClick={() => navigate(`/deals/${activeDeal.id}`)}
              className="w-full py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              View Deal
            </button>
          )}

          {canEdit && onEditUnit && (
            <button
              onClick={() => { onEditUnit(currentUnit); onClose(); }}
              className="w-full py-2 text-sm font-medium border border-primary/40 text-primary rounded-lg hover:bg-info-soft transition-colors"
            >
              Edit Unit
            </button>
          )}
          {agents.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Assign Agent</label>
              <select
                value={currentUnit.assignedAgentId ?? ""}
                onChange={(e) => handleAssignAgent(e.target.value)}
                disabled={assigningAgent}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-muted/50 focus:outline-none focus:border-ring disabled:opacity-50"
              >
                <option value="">— Unassigned —</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </div>
          )}
          {canRelease && (
            <button
              onClick={() => updateStatus("AVAILABLE", "Released to market")}
              disabled={acting}
              className="w-full py-2 text-sm font-medium border border-success/30 text-success rounded-lg hover:bg-success-soft transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Release to Market"}
            </button>
          )}
          {canBlock && !showBlockInput && (
            <button
              onClick={() => setShowBlockInput(true)}
              className="w-full py-2 text-sm font-medium border border-destructive/30 text-destructive rounded-lg hover:bg-destructive-soft transition-colors"
            >
              Block Unit
            </button>
          )}
          {showBlockInput && (
            <div className="border border-destructive/30 rounded-lg p-3 bg-destructive-soft space-y-2">
              <p className="text-xs font-semibold text-destructive-soft-foreground">Reason for blocking *</p>
              <input
                autoFocus
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Maintenance, Management hold…"
                className="w-full border border-destructive/30 rounded-lg px-2.5 py-1.5 text-sm bg-card focus:outline-none focus:border-destructive/30"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowBlockInput(false); setBlockReason(""); }} className="flex-1 py-1.5 text-xs bg-card border border-border rounded text-muted-foreground hover:bg-muted/50">Cancel</button>
                <button onClick={handleBlock} disabled={acting || !blockReason.trim()} className="flex-1 py-1.5 text-xs bg-destructive text-white rounded hover:bg-destructive/90 disabled:opacity-50">
                  {acting ? "Blocking…" : "Confirm block"}
                </button>
              </div>
            </div>
          )}
          {canUnblock && (
            <button
              onClick={() => updateStatus("AVAILABLE", "Manually unblocked")}
              disabled={acting}
              className="w-full py-2 text-sm font-medium border border-success/30 text-success rounded-lg hover:bg-success-soft transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Make available"}
            </button>
          )}

          {canDelete && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-destructive rounded-lg transition-colors"
            >
              Delete Unit
            </button>
          )}
          {confirmDelete && (
            <div className="border border-destructive/30 rounded-lg p-3 bg-destructive-soft">
              <p className="text-xs text-destructive mb-2">Delete unit {currentUnit.unitNumber}? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 text-xs bg-card border border-border rounded text-muted-foreground hover:bg-muted/50">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-1.5 text-xs bg-destructive text-white rounded hover:bg-destructive/90 disabled:opacity-50">
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 bg-muted text-foreground font-medium rounded-lg hover:bg-muted text-sm transition-colors"
          >
            Close
          </button>
        </div>

        {/* Status History */}
        {history.length > 0 && (
          <div className="px-6 pb-4">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={`transition-transform ${historyOpen ? "rotate-90" : ""}`}>▶</span>
              Status History ({history.length})
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[h.oldStatus] || "bg-muted text-muted-foreground"}`}>{h.oldStatus.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[h.newStatus] || "bg-muted text-muted-foreground"}`}>{h.newStatus.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">{new Date(h.changedAt).toLocaleDateString("en-AE")}</span>
                    </div>
                    {h.reason && <p className="text-muted-foreground mt-0.5 ml-0.5">{h.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Price History */}
        {priceHistory.length > 0 && (
          <div className="px-6 pb-5">
            <button
              onClick={() => setPriceHistoryOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className={`transition-transform ${priceHistoryOpen ? "rotate-90" : ""}`}>▶</span>
              Price History ({priceHistory.length})
            </button>
            {priceHistoryOpen && (
              <div className="mt-2 space-y-1.5">
                {priceHistory.map((p) => (
                  <div key={p.id} className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span>AED {p.oldPrice.toLocaleString()} → <strong>AED {p.newPrice.toLocaleString()}</strong></span>
                      <span className="text-muted-foreground">{new Date(p.changedAt).toLocaleDateString("en-AE")}</span>
                    </div>
                    {p.reason && <p className="text-muted-foreground mt-0.5">{p.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
