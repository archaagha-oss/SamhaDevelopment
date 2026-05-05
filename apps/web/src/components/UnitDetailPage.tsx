import { useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { useUnit } from "../hooks/useUnit";
import { useUpdateUnit } from "../hooks/useUpdateUnit";
import { formatArea } from "../utils/formatArea";
import { useAgents } from "../hooks/useAgents";
import UnitHeader from "./UnitHeader";
import UnitStatusActions from "./UnitStatusActions";
import UnitCommercialPanel from "./UnitCommercialPanel";
import UnitHistory from "./UnitHistory";
import UnitGallery from "./UnitGallery";
import UnitFloorPlans from "./UnitFloorPlans";
import UnitActivityLogger from "./UnitActivityLogger";
import UnitSimilarUnits from "./UnitSimilarUnits";
import ImageUploadModal from "./ImageUploadModal";
import { ApiError, ErrorType } from "../types/errors";
import { UnitImage } from "../types";

export default function UnitDetailPage() {
  const { projectId, unitId } = useParams<{ projectId: string; unitId: string }>();
  const navigate = useNavigate();
  const { data: unit, isLoading, error: queryError, refetch } = useUnit(unitId!);
  const { data: agents = [] } = useAgents();
  const updateUnit = useUpdateUnit(unitId!);

  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewingFloorPlan, setViewingFloorPlan] = useState<UnitImage | null>(null);

  // Inline price editing
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceValue, setPriceValue] = useState("");

  // Inline notes editing
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

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

  const agentName = agents.find((a) => a.id === unit.assignedAgentId)?.name;
  const priceTrend = unit.basePrice && unit.basePrice !== unit.price
    ? ((unit.price - unit.basePrice) / unit.basePrice * 100).toFixed(1)
    : null;

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

            {/* Key Info Bar */}
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

            {/* Property Specs */}
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
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">Payment Plan</p>
                  {unit.paymentPlan ? (
                    <p className="text-sm font-semibold text-slate-800">{unit.paymentPlan}</p>
                  ) : (
                    <button
                      onClick={() => {
                        const val = prompt("Enter payment plan (e.g. 60/40):");
                        if (val) updateUnit.mutateAsync({ paymentPlan: val });
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add
                    </button>
                  )}
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

            {/* Pricing */}
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

            {/* Gallery */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              {unit.images && unit.images.length > 0 ? (
                <UnitGallery
                  images={unit.images}
                  onDelete={handleDeleteImage}
                  onUpload={() => setShowUploadModal(true)}
                />
              ) : (
                <div className="p-8 text-center">
                  <p className="text-2xl mb-2">📸</p>
                  <p className="text-sm text-slate-500 mb-3">No images yet</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    Upload First Image
                  </button>
                </div>
              )}
            </div>

            {/* Floor Plans */}
            {unit.images && unit.images.length > 0 && (
              <UnitFloorPlans
                images={unit.images}
                onOpenFloorPlan={setViewingFloorPlan}
              />
            )}

            {/* Physical Details */}
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

            {/* Tags & Notes */}
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

            {/* History */}
            <UnitHistory unitId={unit.id} createdAt={unit.createdAt} />

            {/* Activity Logger */}
            <UnitActivityLogger unitId={unit.id} interests={unit.interests ?? []} />
          </div>

          {/* ── RIGHT COLUMN (1/3) ── */}
          <div className="space-y-4">

            {/* 1. Status Actions */}
            <UnitStatusActions unit={unit} onError={setApiError} />

            {/* 2. Commercial Context (Deal / Reservation / Leads) */}
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

      {/* Floor Plan Viewer */}
      {viewingFloorPlan && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setViewingFloorPlan(null)}
        >
          <div className="bg-black rounded-lg max-w-4xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <img
                src={viewingFloorPlan.url}
                alt={viewingFloorPlan.caption || "Floor Plan"}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
              <button
                onClick={() => setViewingFloorPlan(null)}
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg transition-colors"
              >
                ✕
              </button>
              {viewingFloorPlan.caption && (
                <div className="bg-slate-900 px-4 py-3 text-sm text-slate-100">{viewingFloorPlan.caption}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
