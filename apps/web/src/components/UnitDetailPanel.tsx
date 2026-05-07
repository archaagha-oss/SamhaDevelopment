import React, { useState } from "react";
import { Unit, UnitStatusHistory } from "../types";
import { getStatusColor } from "../utils/statusColors";
import axios from "axios";
import { toast } from "sonner";

interface UnitDetailPanelProps {
  unit: Unit;
  isOpen: boolean;
  onClose: () => void;
  onCreateOffer: (unit: Unit) => void;
  onViewDeal: (dealId: string) => void;
}

const STATUS_LABELS: Record<string, string> = {
  NOT_RELEASED: "Not Released",
  AVAILABLE: "Available",
  ON_HOLD: "On Hold",
  RESERVED: "Reserved",
  BOOKED: "Booked",
  SOLD: "Sold",
  BLOCKED: "Blocked",
  HANDED_OVER: "Handed Over",
};

const UNIT_TYPE_LABELS: Record<string, string> = {
  STUDIO: "Studio",
  ONE_BR: "1 Bedroom",
  TWO_BR: "2 Bedroom",
  THREE_BR: "3 Bedroom",
  FOUR_BR: "4 Bedroom",
  COMMERCIAL: "Commercial",
};

export default function UnitDetailPanel({
  unit,
  isOpen,
  onClose,
  onCreateOffer,
  onViewDeal,
}: UnitDetailPanelProps) {
  const [history, setHistory] = useState<UnitStatusHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const statusColor = getStatusColor(unit.status);

  React.useEffect(() => {
    if (isOpen && unit.id) {
      loadHistory();
    }
  }, [isOpen, unit.id]);

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await axios.get(`/api/units/${unit.id}/history`);
      setHistory(response.data.data || []);
    } catch (error) {
      console.error("Failed to load unit history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const pricePerSqft = unit.area ? Math.round(unit.price / unit.area) : 0;

  const handleReleaseHold = async () => {
    try {
      await axios.patch(`/api/units/${unit.id}`, {
        status: "AVAILABLE",
        holdExpiresAt: null,
      });
      toast.success("Hold released");
      onClose();
    } catch (error) {
      toast.error("Failed to release hold");
    }
  };

  // Determine available actions based on status
  const actionButtons = [];

  if (unit.status === "AVAILABLE") {
    actionButtons.push(
      <button
        key="offer"
        onClick={() => onCreateOffer(unit)}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
      >
        Create Offer
      </button>
    );
  }

  if (["RESERVED", "SOLD", "BOOKED"].includes(unit.status)) {
    const deal = unit.deals?.[0];
    if (deal) {
      actionButtons.push(
        <button
          key="deal"
          onClick={() => onViewDeal(deal.id)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          View Deal
        </button>
      );
    }
  }

  if (unit.status === "ON_HOLD") {
    actionButtons.push(
      <button
        key="release"
        onClick={handleReleaseHold}
        className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition"
      >
        Release Hold
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-over Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 transform transition-transform duration-300 overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Unit {unit.unitNumber}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusColor.badge}`}>
            {STATUS_LABELS[unit.status] || unit.status}
          </div>

          {/* Unit Summary */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Type:</span>
              <span className="text-sm font-medium text-slate-900">
                {UNIT_TYPE_LABELS[unit.type] || unit.type}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Floor:</span>
              <span className="text-sm font-medium text-slate-900">{unit.floor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Area:</span>
              <span className="text-sm font-medium text-slate-900">{unit.area.toFixed(2)} sqft</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-3">
              <span className="text-sm text-slate-600">Price:</span>
              <span className="text-sm font-bold text-slate-900">
                AED {unit.price.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">Price/sqft:</span>
              <span className="text-sm font-medium text-slate-900">AED {pricePerSqft.toLocaleString()}</span>
            </div>
            {unit.parkingSpaces !== undefined && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Parking Spaces:</span>
                <span className="text-sm font-medium text-slate-900">{unit.parkingSpaces}</span>
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Status History</h3>
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 pb-3 border-b border-slate-200 last:border-b-0">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-2 h-2 rounded-full bg-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-600">
                        {STATUS_LABELS[entry.oldStatus] || entry.oldStatus} →{" "}
                        {STATUS_LABELS[entry.newStatus] || entry.newStatus}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(entry.changedAt).toLocaleString()}
                      </p>
                      {entry.reason && (
                        <p className="text-xs text-slate-600 mt-1">{entry.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loadingHistory && (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500">Loading history...</p>
            </div>
          )}

          {history.length === 0 && !loadingHistory && (
            <p className="text-xs text-slate-500">No status history available.</p>
          )}

          {/* Actions */}
          {actionButtons.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-slate-200">
              {actionButtons}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
