import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Unit } from "../types";
import UnitMatrixGrid from "./UnitMatrixGrid";
import CreateOfferModal from "./CreateOfferModal";

interface UnitsPageProps {
  projectId?: string;
}

/**
 * UnitsPage - Main unit management page
 *
 * Features:
 * - Unit matrix grid with floor grouping and color-coded status
 * - Filter by floor, type, and price range
 * - Click unit to view details in slide-over panel
 * - Create offers directly from unit detail panel
 * - View deals for reserved/sold units
 *
 * Performance:
 * - Lazy loads units (50 per page)
 * - Memoized grid cells to prevent unnecessary re-renders
 * - Responsive design: 1 col mobile, 3 tablet, 6 desktop
 */
export default function UnitsPage({ projectId }: UnitsPageProps): JSX.Element {
  const navigate = useNavigate();
  const [showCreateOfferModal, setShowCreateOfferModal] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const handleCreateOffer = useCallback((unit: Unit): void => {
    setSelectedUnit(unit);
    setShowCreateOfferModal(true);
  }, []);

  const handleViewDeal = useCallback((dealId: string): void => {
    navigate(`/deals/${dealId}`);
  }, [navigate]);

  const handleOfferCreated = useCallback((offerId: string): void => {
    setShowCreateOfferModal(false);
    setSelectedUnit(null);
    toast.success("Offer created successfully!");
  }, []);

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Page Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900">Units</h1>
        <p className="text-sm text-slate-600 mt-1">
          Browse and manage all units across your projects
        </p>
      </div>

      {/* Matrix Grid */}
      <div className="flex-1 overflow-hidden">
        <UnitMatrixGrid
          projectId={projectId}
          onCreateOffer={handleCreateOffer}
          onViewDeal={handleViewDeal}
        />
      </div>

      {/* Create Offer Modal - will be implemented in Task 1.3 */}
      {/* {showCreateOfferModal && selectedUnit && (
        <CreateOfferModal
          unit={selectedUnit}
          isOpen={showCreateOfferModal}
          onClose={() => {
            setShowCreateOfferModal(false);
            setSelectedUnit(null);
          }}
          onSuccess={handleOfferCreated}
        />
      )} */}
    </div>
  );
}
