import { useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useUnit } from "../hooks/useUnit";
import { useUpdateUnit, useDeleteUnit } from "../hooks/useUpdateUnit";
import { formatArea } from "../utils/formatArea";
import { useAgents } from "../hooks/useAgents";
import UnitHeader from "./UnitHeader";
import UnitStatusActions from "./UnitStatusActions";
import UnitCommercialPanel from "./UnitCommercialPanel";
import UnitHistory from "./UnitHistory";
import UnitGallery from "./UnitGallery";
import UnitActivityLogger from "./UnitActivityLogger";
import UnitSimilarUnits from "./UnitSimilarUnits";
import ImageUploadModal from "./ImageUploadModal";
import ActiveDealSummaryCard from "./ActiveDealSummaryCard";
import PaymentPlanCard from "./PaymentPlanCard";
import { ApiError, ErrorType } from "../types/errors";
import { UnitImage } from "../types";

const DELETE_BLOCKING_STATUSES = ["ON_HOLD", "RESERVED", "BOOKED", "SOLD", "HANDED_OVER"] as const;

export default function UnitDetailPage() {
  const { projectId, unitId } = useParams<{ projectId: string; unitId: string }>();
  const navigate = useNavigate();
  const { data: unit, isLoading, error: queryError, refetch } = useUnit(unitId!);
  const { data: agents = [] } = useAgents();
  const updateUnit = useUpdateUnit(unitId!);
  const deleteUnit = useDeleteUnit(unitId!);

  const [apiError, setApiError]       = useState<ApiError | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewingImage, setViewingImage]       = useState<UnitImage | null>(null);

  // Inline price editing
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue]     = useState("");

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue]     = useState("");

  // Delete confirmation
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteAck, setDeleteAck]               = useState("");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (queryError || !unit) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(`/projects/${projectId}`)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-4">
          ← Back to Project
        </button>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">{queryError instanceof Error ? queryError.message : "Unit not found"}</p>
        </div>
      </div>
    );
  }

  const handleDeleteImage = async (imageId: string) => {
    try {
      await axios.delete(`/api/units/${unitId}/images/${imageId}`);
      await refetch();
    } catch {
      setApiError({ message: "Failed to delete image", code: 500, type: ErrorType.SERVER });
    }
  };

  const handleSavePrice = async () => {
    const parsed = parseInt(priceValue.replace(/,/g, ""));
    if (!parsed || parsed <= 0) return;
    try {
      await updateUnit.mutateAsync({ price: parsed });
      setEditingPrice(false);
    } catch (err: any) {
      setApiError(err);
    }
  };

  const handleSaveNotes = async () => {
    try {
      await updateUnit.mutateAsync({ internalNotes: notesValue });
      setEditingNotes(false);
    } catch (err: any) {
      setApiError(err);
    }
  };

  const handleAgentChange = async (agentId: string) => {
    try {
      await updateUnit.mutateAsync({ assignedAgentId: agentId || undefined });
    } catch (err: any) {
      setApiError(err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUnit.mutateAsync();
      navigate(`/projects/${projectId}`);
    } catch (err: any) {
      setApiError(err);
      setConfirmingDelete(false);
    }
  };

  const agentName  = agents.find((a) => a.id === unit.assignedAgentId)?.name;
  const priceTrend = unit.basePrice && unit.basePrice !== unit.price
    ? ((unit.price - unit.basePrice) / unit.basePrice * 100).toFixed(1)
    : null;

  // Media: floor plan first as hero
  const images       = unit.images ?? [];
  const floorPlans   = images.filter((i) => i.type === "FLOOR_PLAN");
  const photos       = images.filter((i) => i.type === "PHOTO");
  const heroImage    = floorPlans[0] ?? photos[0] ?? null;
  const heroIsPlan   = !!floorPlans[0];

  const deleteBlocked = DELETE_BLOCKING_STATUSES.includes(unit.status as typeof DELETE_BLOCKING_STATUSES[number])
                     || (unit.deals?.length ?? 0) > 0
                     || (unit.reservations?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <UnitHeader
        unitNumber={unit.unitNumber}
        status={unit.status}
        projectId={projectId!}
        projectName={unit.project?.name}
      />

      {/* Error Banner */}
      {apiError && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
            <p className="text-red-700 text-sm">{apiError.message}</p>
            <button onClick={() => setApiError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-4">×</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-3 gap-5">

          {/* ── LEFT COLUMN (2/3) ── */}
          <div className="col-span-2 space-y-4">

            {/* 1. Active deal / reservation / interest summary — top-of-page primary context */}
            <ActiveDealSummaryCard unit={unit} />

            {/* 2. Floor-plan hero (or photo fallback with "Add floor plan" CTA) */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {heroImage ? (
                <button
                  type="button"
                  onClick={() => setViewingImage(heroImage)}
                  className="relative block w-full group"
                  title="Click to view full size"
                >
                  <img
                    src={heroImage.url}
                    alt={heroImage.caption || (heroIsPlan ? "Floor plan" : "Unit photo")}
                    className="w-full h-[420px] object-contain bg-slate-50"
                    loading="lazy"
                  />
                  <span className="absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-900/75 text-white">
                    {heroIsPlan ? "📐 Floor plan" : "📷 Photo"}
                  </span>
                  <span className="absolute top-3 right-3 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/85 text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to enlarge
                  </span>
                  {!heroIsPlan && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setShowUploadModal(true); }}
                      className="absolute bottom-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md shadow-md"
                    >
                      + Add floor plan
                    </button>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="w-full h-[280px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                >
                  <span className="text-4xl">📐</span>
                  <span className="text-sm font-semibold text-slate-700">Add floor plan</span>
                  <span className="text-xs text-slate-400">Floor plan helps clients picture the unit fastest</span>
                </button>
              )}

              {/* Photo carousel below hero */}
              {images.length > 0 && (
                <UnitGallery
                  images={images}
                  onDelete={handleDeleteImage}
                  onUpload={() => setShowUploadModal(true)}
                />
              )}
            </div>

            {/* 3. Key Info Bar */}
            <div className="bg-white rounded-lg border border-slate-200 px-5 py-4">
              <div className="grid grid-cols-5 divide-x divide-slate-100">
                <div className="px-3 first:pl-0">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Type</p>
                  <p className="text-sm font-semibold text-slate-900">{unit.type.replace(/_/g, " ")}</p>
                </div>
                <div className="px-3">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Floor</p>
                  <p className="text-sm font-semibold text-slate-900">{unit.floor}</p>
                </div>
                <div className="px-3">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">View</p>
                  <p className="text-sm font-semibold text-slate-900">{unit.view}</p>
                </div>
                <div className="px-3">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Total Area</p>
                  <p className="text-sm font-semibold text-slate-900">{formatArea(unit.area)}</p>
                </div>
                <div className="px-3">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Price / sqft</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {unit.pricePerSqft ? `AED ${unit.pricePerSqft.toLocaleString()}` : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 4. Property Specs */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Property Specs</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Purpose</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {unit.project?.purpose === "RENT" ? "Rent" : "Sale"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Furnishing</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {unit.project?.furnishing?.replace(/_/g, " ") ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Completion</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {unit.project?.completionStatus?.replace(/_/g, " ") ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Project</p>
                  <p className="text-sm font-semibold text-slate-800">{unit.project?.name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Handover</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {unit.project?.handoverDate
                      ? new Date(unit.project.handoverDate).toLocaleDateString("en-AE", { month: "long", year: "numeric" })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 5. Pricing */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Current Price</p>
                {!editingPrice && (
                  <button
                    onClick={() => { setEditingPrice(true); setPriceValue(unit.price.toString()); }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingPrice ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-slate-500">AED</span>
                  <input
                    type="number"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-lg font-bold focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSavePrice}
                    disabled={updateUnit.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingPrice(false)} className="px-3 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50">
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-end gap-3">
                  <p className="text-2xl font-bold text-slate-900">
                    AED {unit.price.toLocaleString("en-AE")}
                  </p>
                  {priceTrend && (
                    <span className={`text-sm font-semibold mb-0.5 ${parseFloat(priceTrend) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {parseFloat(priceTrend) >= 0 ? "▲" : "▼"} {Math.abs(parseFloat(priceTrend))}% from base
                    </span>
                  )}
                </div>
              )}

              {unit.basePrice && unit.basePrice !== unit.price && (
                <p className="text-xs text-slate-400 mt-1">
                  Base: <span className="line-through">AED {unit.basePrice.toLocaleString("en-AE")}</span>
                </p>
              )}
            </div>

            {/* 6. Payment plan decomposition */}
            <PaymentPlanCard unitId={unit.id} paymentPlan={unit.paymentPlan} price={unit.price} />

            {/* 7. Physical Details */}
            {(unit.bathrooms || unit.parkingSpaces !== undefined || unit.internalArea || unit.externalArea) && (
              <div className="bg-white rounded-lg border border-slate-200 p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Physical Details</p>
                <div className="grid grid-cols-4 gap-4">
                  {unit.bathrooms && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Bathrooms</p>
                      <p className="text-lg font-bold text-slate-900">{unit.bathrooms}</p>
                    </div>
                  )}
                  {unit.parkingSpaces !== undefined && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Parking</p>
                      <p className="text-lg font-bold text-slate-900">{unit.parkingSpaces}</p>
                    </div>
                  )}
                  {unit.internalArea && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Suite Area</p>
                      <p className="text-sm font-semibold text-slate-900">{formatArea(unit.internalArea)}</p>
                    </div>
                  )}
                  {unit.externalArea && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Balcony</p>
                      <p className="text-sm font-semibold text-slate-900">{formatArea(unit.externalArea)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. Tags & Notes */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              {unit.tags && unit.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {unit.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Internal Notes</p>
                  {!editingNotes && (
                    <button
                      onClick={() => { setEditingNotes(true); setNotesValue(unit.internalNotes || ""); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveNotes}
                        disabled={updateUnit.isPending}
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button onClick={() => setEditingNotes(false)} className="px-3 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-700 bg-slate-50 px-3 py-2.5 rounded-lg min-h-[2.5rem]">
                    {unit.internalNotes || <span className="text-slate-400">No notes added</span>}
                  </p>
                )}
              </div>
            </div>

            {/* 9. History */}
            <UnitHistory unitId={unit.id} createdAt={unit.createdAt} />

            {/* 10. Activity Logger */}
            <UnitActivityLogger unitId={unit.id} interests={unit.interests ?? []} />

            {/* 11. Danger Zone — delete moved out of the table per UX call */}
            <div className="bg-white rounded-lg border border-red-200 p-5">
              <div className="flex items-start gap-3">
                <span className="text-red-500 text-lg leading-none mt-0.5">⚠</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">Danger zone</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Permanently remove this unit. Allowed only when there's no active deal or reservation.
                  </p>
                  {deleteBlocked && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mt-2 inline-block">
                      Locked — unit is {unit.status.replace(/_/g, " ").toLowerCase()}{(unit.deals?.length ?? 0) > 0 ? " and has an active deal" : ""}.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => { setConfirmingDelete(true); setDeleteAck(""); }}
                  disabled={deleteBlocked || deleteUnit.isPending}
                  className="px-3 py-2 border border-red-300 text-red-700 text-xs font-semibold rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Delete unit
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN (1/3) ── */}
          <div className="space-y-4">

            {/* 1. Status Actions */}
            <UnitStatusActions unit={unit} onError={setApiError} />

            {/* 2. Commercial Context (interested leads, create-deal CTA) */}
            <UnitCommercialPanel unit={unit} />

            {/* 3. Agent Assignment */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Assigned Agent</p>
              {agentName && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {agentName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{agentName}</span>
                </div>
              )}
              <select
                value={unit.assignedAgentId ?? ""}
                onChange={(e) => handleAgentChange(e.target.value)}
                disabled={updateUnit.isPending}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:outline-none focus:border-blue-400 disabled:opacity-50"
              >
                <option value="">— Unassigned —</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* 4. Block Info (if BLOCKED) */}
            {unit.status === "BLOCKED" && unit.blockReason && (
              <div className="bg-amber-50 rounded-lg border border-amber-200 p-5">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Block Reason</p>
                <p className="text-sm text-amber-800">{unit.blockReason}</p>
                {unit.blockExpiresAt && (
                  <div className="mt-3 bg-amber-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-semibold text-amber-800">
                      Expires: {new Date(unit.blockExpiresAt).toLocaleDateString("en-AE")}
                    </p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {Math.ceil((new Date(unit.blockExpiresAt).getTime() - Date.now()) / 86400000)} days remaining
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 5. Stats */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Activity</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-lg px-3 py-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{unit.inquiryCount ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Inquiries</p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-3 text-center">
                  <p className="text-2xl font-bold text-slate-900">{unit.visitCount ?? 0}</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Site Visits</p>
                </div>
              </div>
            </div>

            {/* 6. Similar Units */}
            <UnitSimilarUnits
              currentUnitId={unit.id}
              projectId={unit.projectId}
              type={unit.type}
            />

            {/* 7. Last Update */}
            <div className="bg-white rounded-lg border border-slate-200 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last Updated</p>
              <p className="text-sm text-slate-700 mt-2">{new Date(unit.updatedAt).toLocaleDateString("en-AE")}</p>
            </div>
          </div>
        </div>
      </div>

      {showUploadModal && (
        <ImageUploadModal
          unitId={unitId!}
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={() => { setShowUploadModal(false); refetch(); }}
        />
      )}

      {/* Hero / floor-plan / image lightbox */}
      {viewingImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={viewingImage.caption || "Unit image"}
        >
          <div className="bg-black rounded-lg max-w-5xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <img
                src={viewingImage.url}
                alt={viewingImage.caption || "Unit image"}
                className="w-full h-auto max-h-[85vh] object-contain"
              />
              <span className="absolute top-4 left-4 text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-900/70 text-white">
                {viewingImage.type === "PHOTO" ? "📷 Photo" : viewingImage.type === "FLOOR_PLAN" ? "📐 Floor plan" : "📍 Floor map"}
              </span>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
              {viewingImage.caption && (
                <div className="bg-slate-900 px-4 py-3 text-sm text-slate-100">{viewingImage.caption}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmingDelete && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
          onClick={() => !deleteUnit.isPending && setConfirmingDelete(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
        >
          <div className="bg-white rounded-lg max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <p id="delete-confirm-title" className="text-base font-semibold text-slate-900">Delete unit {unit.unitNumber}?</p>
            <p className="text-sm text-slate-600 mt-2">
              This will permanently remove the unit, its images, status history, and activities.
              Type <span className="font-mono font-semibold">{unit.unitNumber}</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteAck}
              onChange={(e) => setDeleteAck(e.target.value)}
              placeholder={unit.unitNumber}
              className="mt-3 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:border-red-400"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleteUnit.isPending}
                className="px-3 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteUnit.isPending || deleteAck !== unit.unitNumber}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteUnit.isPending ? "Deleting…" : "Delete unit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
