import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";
import { DirhamSign } from "@/components/ui/DirhamSign";
import { formatDirham } from "@/lib/money";

interface CreateOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId?: string;
  unitId?: string;
  unitNumber?: string;
  unitPrice?: number;
  unitArea?: number;
  onOfferCreated?: (offerId: string, dealId?: string) => void;
}

interface Offer {
  leadId: string;
  unitId: string;
  offeredPrice: number;
  discountAmount: number;
  validityDays: number;
}

const DEFAULT_VALIDITY_DAYS = 7;

export default function CreateOfferModal({
  isOpen,
  onClose,
  leadId: initialLeadId,
  unitId: initialUnitId,
  unitNumber: initialUnitNumber,
  unitPrice: initialUnitPrice,
  unitArea: initialUnitArea,
  onOfferCreated,
}: CreateOfferModalProps) {
  const [leadId, setLeadId] = useState(initialLeadId || "");
  const [unitId, setUnitId] = useState(initialUnitId || "");
  const [unitNumber, setUnitNumber] = useState(initialUnitNumber || "");
  const [unitPrice, setUnitPrice] = useState(initialUnitPrice || 0);
  const [unitArea, setUnitArea] = useState(initialUnitArea || 0);
  const [offeredPrice, setOfferedPrice] = useState(initialUnitPrice || 0);
  const [validityDays, setValidityDays] = useState(DEFAULT_VALIDITY_DAYS);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; unitNumber: string; price: number; area: number; type: string }>>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLeads();
      if (initialLeadId) {
        setLeadId(initialLeadId);
      }
      if (initialUnitId) {
        setUnitId(initialUnitId);
        setUnitNumber(initialUnitNumber || "");
        setUnitPrice(initialUnitPrice || 0);
        setOfferedPrice(initialUnitPrice || 0);
        setUnitArea(initialUnitArea || 0);
      }
    }
  }, [isOpen, initialLeadId, initialUnitId]);

  const loadLeads = async () => {
    try {
      setLeadsLoading(true);
      const response = await axios.get("/api/leads");
      setLeads(response.data.data || []);
    } catch (err) {
      console.error("Failed to load leads:", err);
      toast.error("Failed to load leads");
    } finally {
      setLeadsLoading(false);
    }
  };

  const loadUnits = async (q: string = "") => {
    try {
      setUnitsLoading(true);
      const params: any = { limit: 50 };
      if (q) params.search = q;
      const response = await axios.get("/api/units", { params });
      setUnits(response.data.data || []);
    } catch (err) {
      console.error("Failed to load units:", err);
      toast.error("Failed to load units");
    } finally {
      setUnitsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !initialUnitId) {
      loadUnits();
    }
  }, [isOpen, initialUnitId]);

  const discount = unitPrice - offeredPrice;
  const pricePerSqft = unitArea ? Math.round(offeredPrice / unitArea) : 0;
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + validityDays);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!leadId || !unitId || !offeredPrice) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Create offer
      const offerResponse = await axios.post("/api/offers", {
        leadId,
        unitId,
        offeredPrice,
        discountAmount: discount > 0 ? discount : 0,
        validityDays,
      });

      const offerId = offerResponse.data.data?.id;
      toast.success("Offer created successfully");

      // Auto-accept offer to create deal
      if (offerId) {
        try {
          const dealResponse = await axios.patch(`/api/offers/${offerId}/status`, {
            status: "ACCEPTED",
          });

          const dealId = dealResponse.data.data?.deal?.id;
          if (dealId) {
            toast.success("Offer accepted! Deal created.");
            onOfferCreated?.(offerId, dealId);
          } else {
            onOfferCreated?.(offerId);
          }
        } catch (dealErr: any) {
          const msg = dealErr.response?.data?.error || "Offer created but could not auto-accept";
          toast.info(msg);
          onOfferCreated?.(offerId);
        }
      }

      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to create offer";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity" onClick={onClose} />

      {/* Slide-over Modal */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-card shadow-xl z-50 transform transition-transform duration-300 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">Create Offer</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-2xl leading-none">
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Lead Selection */}
          <div>
            <label htmlFor="lead" className="block text-sm font-medium text-foreground mb-2">
              Lead *
            </label>
            <select
              id="lead"
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              disabled={!!initialLeadId || leadsLoading}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition disabled:bg-muted/50"
            >
              <option value="">Select a lead...</option>
              {leads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.firstName} {lead.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Selection */}
          <div>
            <label htmlFor="unit" className="block text-sm font-medium text-foreground mb-2">
              Unit *
            </label>
            <select
              id="unit"
              value={unitId}
              onChange={(e) => {
                const selected = units.find((u) => u.id === e.target.value);
                if (selected) {
                  setUnitId(selected.id);
                  setUnitNumber(selected.unitNumber);
                  setUnitPrice(selected.price);
                  setOfferedPrice(selected.price);
                  setUnitArea(selected.area);
                } else {
                  setUnitId("");
                  setUnitNumber("");
                  setUnitPrice(0);
                  setOfferedPrice(0);
                  setUnitArea(0);
                }
              }}
              disabled={!!initialUnitId || unitsLoading}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition disabled:bg-muted/50"
            >
              <option value="">Select a unit...</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.unitNumber} ({unit.type}) - AED {unit.price.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Details (if selected) */}
          {unitNumber && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Unit:</span>
                <span className="font-medium text-foreground">{unitNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">List Price:</span>
                <span className="font-medium text-foreground">{formatDirham(unitPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Area:</span>
                <span className="font-medium text-foreground">{unitArea.toFixed(2)} sqft</span>
              </div>
              {unitArea > 0 && (
                <div className="flex justify-between text-sm border-t border-border pt-2">
                  <span className="text-muted-foreground">Price/sqft:</span>
                  <span className="font-medium text-foreground">AED {Math.round(unitPrice / unitArea).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Offered Price */}
          <div>
            <label htmlFor="offeredPrice" className="block text-sm font-medium text-foreground mb-2">
              Offered Price (AED) *
            </label>
            <input
              id="offeredPrice"
              type="number"
              value={offeredPrice}
              onChange={(e) => setOfferedPrice(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition"
              required
            />
            {discount > 0 && (
              <p className="text-xs text-success mt-1 font-medium">
                Discount: AED {discount.toLocaleString()}
              </p>
            )}
            {unitArea > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                AED {pricePerSqft.toLocaleString()} per sqft
              </p>
            )}
          </div>

          {/* Validity */}
          <div>
            <label htmlFor="validityDays" className="block text-sm font-medium text-foreground mb-2">
              Valid For (Days)
            </label>
            <input
              id="validityDays"
              type="number"
              min="1"
              value={validityDays}
              onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Expires: {expiryDate.toLocaleDateString("en-AE")}
            </p>
          </div>

          {/* Summary */}
          {offeredPrice > 0 && (
            <div className="bg-info-soft border border-primary/40 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-info-soft-foreground">Offer Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-primary">Sale Price:</span>
                <span className="font-bold text-info-soft-foreground">AED {offeredPrice.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-primary">Your Discount:</span>
                  <span className="font-bold text-success">-AED {discount.toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-muted/50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition flex items-center justify-center gap-2"
              disabled={loading || !leadId || !unitId || !offeredPrice}
            >
              {loading && <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              {loading ? "Creating..." : "Create Offer"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
