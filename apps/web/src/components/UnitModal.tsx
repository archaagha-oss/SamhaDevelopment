import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import UnitGallery from "./UnitGallery";
import { formatArea } from "../utils/formatArea";

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
  NOT_RELEASED: "bg-gray-100 text-gray-500",
  AVAILABLE:    "bg-emerald-100 text-emerald-700",
  RESERVED:     "bg-amber-100 text-amber-700",
  BOOKED:       "bg-violet-100 text-violet-700",
  SOLD:         "bg-red-100 text-red-700",
  BLOCKED:      "bg-slate-200 text-slate-600",
  HANDED_OVER:  "bg-teal-100 text-teal-700",
};

export default function UnitModal({ unit, statusLabels, agents = [], onClose, onRefresh, onEditUnit, onDeleted }: Props) {
  const navigate = useNavigate();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullUnit, setFullUnit] = useState<any>(null);
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
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="
        fixed bg-white shadow-2xl flex flex-col overflow-hidden
        left-0 right-0 bottom-0 top-16 rounded-t-2xl
        sm:left-auto sm:top-0 sm:bottom-0 sm:right-0 sm:rounded-none sm:rounded-l-2xl sm:w-[420px] sm:max-w-full
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 leading-none">Unit {currentUnit.unitNumber}</h2>
            <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[currentUnit.status] || "bg-slate-100 text-slate-600"}`}>
              {statusLabels[currentUnit.status] || currentUnit.status}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto">

        {/* Active Deal Banner */}
        {activeDeal && (
          <div
            className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 cursor-pointer hover:bg-amber-100 transition-colors"
            onClick={() => navigate(`/deals/${activeDeal.id}`)}
          >
            <p className="text-xs font-semibold text-amber-800 mb-1">Active Deal</p>
            <p className="text-sm font-bold text-amber-900">{activeDeal.dealNumber}</p>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-amber-700">{activeDeal.lead.firstName} {activeDeal.lead.lastName}</p>
              <p className="text-xs text-amber-700 font-medium">AED {activeDeal.salePrice.toLocaleString()}</p>
            </div>
            <p className="text-xs text-amber-600 mt-0.5">{activeDeal.stage.replace(/_/g, " ")} →</p>
          </div>
        )}

        {/* Active Reservation Banner */}
        {activeReservation && !activeDeal && (
          <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">Active Reservation</p>
            <p className="text-sm text-blue-800">{activeReservation.lead.firstName} {activeReservation.lead.lastName}</p>
            <p className="text-xs text-blue-600 mt-0.5">Expires {new Date(activeReservation.expiresAt).toLocaleDateString("en-AE")}</p>
          </div>
        )}

        {/* Gallery */}
        {fullUnit?.images && fullUnit.images.length > 0 ? (
          <UnitGallery images={fullUnit.images} />
        ) : (
          <div className="mx-6 mt-4 bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
            <p className="text-sm text-slate-500">📸 No images added yet</p>
            <p className="text-xs text-slate-400 mt-1">Images will appear here</p>
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
                <p className="text-xs text-slate-500 mb-0.5">{label}</p>
                <p className="font-semibold text-slate-800 text-sm">{value}</p>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-xl p-3 mt-1">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Current Price</p>
                <p className="text-xl font-bold text-slate-900">AED {currentUnit.price.toLocaleString("en-AE")}</p>
              </div>
              {currentUnit.basePrice && currentUnit.basePrice !== currentUnit.price && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">Base price</p>
                  <p className="text-sm text-slate-500 line-through">AED {currentUnit.basePrice.toLocaleString("en-AE")}</p>
                </div>
              )}
            </div>
          </div>

          {(currentUnit.pricePerSqft || (currentUnit.inquiryCount ?? 0) > 0 || (currentUnit.visitCount ?? 0) > 0) && (
            <div className="grid grid-cols-3 gap-3 mt-3">
              {currentUnit.pricePerSqft && (
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-blue-600 mb-0.5">Price / sqft</p>
                  <p className="font-semibold text-blue-900">AED {currentUnit.pricePerSqft.toLocaleString()}</p>
                </div>
              )}
              {(currentUnit.inquiryCount ?? 0) > 0 && (
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-amber-600 mb-0.5">Inquiries</p>
                  <p className="font-semibold text-amber-900">{currentUnit.inquiryCount}</p>
                </div>
              )}
              {(currentUnit.visitCount ?? 0) > 0 && (
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                  <p className="text-xs text-emerald-600 mb-0.5">Site Visits</p>
                  <p className="font-semibold text-emerald-900">{currentUnit.visitCount}</p>
                </div>
              )}
            </div>
          )}

          {(currentUnit.bathrooms || currentUnit.parkingSpaces || currentUnit.internalArea || currentUnit.externalArea) && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-600 mb-2">Physical Details</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {currentUnit.bathrooms && <div><span className="text-slate-500">Bathrooms:</span> <span className="font-semibold">{currentUnit.bathrooms}</span></div>}
                {currentUnit.parkingSpaces && <div><span className="text-slate-500">Parking:</span> <span className="font-semibold">{currentUnit.parkingSpaces}</span></div>}
                {currentUnit.internalArea && <div><span className="text-slate-500">Suite:</span> <span className="font-semibold">{formatArea(currentUnit.internalArea)}</span></div>}
                {currentUnit.externalArea && <div><span className="text-slate-500">Balcony:</span> <span className="font-semibold">{formatArea(currentUnit.externalArea)}</span></div>}
              </div>
            </div>
          )}

          {currentUnit.tags && currentUnit.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentUnit.tags.map((tag: string) => (
                <span key={tag} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          )}

          {currentUnit.blockReason && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-800">Block Reason</p>
              <p className="text-sm text-amber-700 mt-1">{currentUnit.blockReason}</p>
              {currentUnit.blockExpiresAt && (
                <p className="text-xs text-amber-600 mt-1">Expires {new Date(currentUnit.blockExpiresAt).toLocaleDateString("en-AE")}</p>
              )}
            </div>
          )}

          {currentUnit.internalNotes && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-800">Notes</p>
              <p className="text-sm text-blue-700 mt-1">{currentUnit.internalNotes}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-4 space-y-2">
          {/* Status-conditional primary CTAs */}
          {isAvailable && (
            <button
              onClick={() => navigate(`/leads?createOfferForUnit=${currentUnit.id}`)}
              className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Offer
            </button>
          )}
          {isReserved && activeDeal && (
            <button
              onClick={() => navigate(`/deals/${activeDeal.id}`)}
              className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Deal
            </button>
          )}
          {isReserved && !activeDeal && (
            <button
              onClick={() => updateStatus("AVAILABLE", "Reservation released")}
              disabled={acting}
              className="w-full py-2.5 text-sm font-semibold border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Release Hold"}
            </button>
          )}
          {isBookedOrSold && activeDeal && (
            <button
              onClick={() => navigate(`/deals/${activeDeal.id}`)}
              className="w-full py-2.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              View Deal
            </button>
          )}

          {canEdit && onEditUnit && (
            <button
              onClick={() => { onEditUnit(currentUnit); onClose(); }}
              className="w-full py-2 text-sm font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"
            >
              Edit Unit
            </button>
          )}
          {agents.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Assign Agent</label>
              <select
                value={currentUnit.assignedAgentId ?? ""}
                onChange={(e) => handleAssignAgent(e.target.value)}
                disabled={assigningAgent}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-400 disabled:opacity-50"
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
              className="w-full py-2 text-sm font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Release to Market"}
            </button>
          )}
          {canBlock && !showBlockInput && (
            <button
              onClick={() => setShowBlockInput(true)}
              className="w-full py-2 text-sm font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              Block Unit
            </button>
          )}
          {showBlockInput && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50 space-y-2">
              <p className="text-xs font-semibold text-red-800">Reason for blocking *</p>
              <input
                autoFocus
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="e.g. Maintenance, Management hold…"
                className="w-full border border-red-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:border-red-400"
              />
              <div className="flex gap-2">
                <button onClick={() => { setShowBlockInput(false); setBlockReason(""); }} className="flex-1 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleBlock} disabled={acting || !blockReason.trim()} className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                  {acting ? "Blocking…" : "Confirm Block"}
                </button>
              </div>
            </div>
          )}
          {canUnblock && (
            <button
              onClick={() => updateStatus("AVAILABLE", "Manually unblocked")}
              disabled={acting}
              className="w-full py-2 text-sm font-medium border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Make Available"}
            </button>
          )}

          {canDelete && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-red-500 rounded-lg transition-colors"
            >
              Delete Unit
            </button>
          )}
          {confirmDelete && (
            <div className="border border-red-200 rounded-lg p-3 bg-red-50">
              <p className="text-xs text-red-700 mb-2">Delete unit {currentUnit.unitNumber}? This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 py-1.5 text-xs bg-white border border-slate-200 rounded text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50">
                  {deleting ? "Deleting…" : "Confirm Delete"}
                </button>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 text-sm transition-colors"
          >
            Close
          </button>
        </div>

        {/* Status History */}
        {history.length > 0 && (
          <div className="px-6 pb-4">
            <button
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className={`transition-transform ${historyOpen ? "rotate-90" : ""}`}>▶</span>
              Status History ({history.length})
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[h.oldStatus] || "bg-slate-100 text-slate-500"}`}>{h.oldStatus.replace(/_/g, " ")}</span>
                      <span className="text-slate-400">→</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[h.newStatus] || "bg-slate-100 text-slate-500"}`}>{h.newStatus.replace(/_/g, " ")}</span>
                      <span className="text-slate-400 ml-auto shrink-0">{new Date(h.changedAt).toLocaleDateString("en-AE")}</span>
                    </div>
                    {h.reason && <p className="text-slate-400 mt-0.5 ml-0.5">{h.reason}</p>}
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
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span className={`transition-transform ${priceHistoryOpen ? "rotate-90" : ""}`}>▶</span>
              Price History ({priceHistory.length})
            </button>
            {priceHistoryOpen && (
              <div className="mt-2 space-y-1.5">
                {priceHistory.map((p) => (
                  <div key={p.id} className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span>AED {p.oldPrice.toLocaleString()} → <strong>AED {p.newPrice.toLocaleString()}</strong></span>
                      <span className="text-slate-400">{new Date(p.changedAt).toLocaleDateString("en-AE")}</span>
                    </div>
                    {p.reason && <p className="text-slate-400 mt-0.5">{p.reason}</p>}
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
