import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";

/**
 * Broker Commission Dashboard Data Types
 */
export interface CommissionSummary {
  totalEarned: number;
  approved: number;
  pending: number;
  paid: number;
  totalDeals: number;
  approvedDeals: number;
  pendingDeals: number;
  paidDeals: number;
}

export interface CommissionUnlockStatus {
  id: string;
  dealNumber: string;
  stage: string;
  leadName: string;
  unitNumber: string;
  unlockStatus: "LOCKED" | "PENDING" | "UNLOCKED" | "NOT_DUE";
  unlockReason: string;
  spaSignedDate: string | null;
  oqoodRegisteredDate: string | null;
  oqoodDeadline: string | null;
  commission: { id: string; status: string; amount: number } | null;
}

export interface PendingApproval {
  id: string;
  dealNumber: string;
  dealId: string;
  brokerName: string;
  leadName: string;
  amount: number;
  rate: number;
  status: string;
  reason: string;
}

export interface ApprovedCommission {
  id: string;
  dealNumber: string;
  brokerName: string;
  leadName: string;
  amount: number;
  status: string;
  paidStatus: "PAID" | "PENDING";
  paidDate: string | null;
  approvedDate: string | null;
}

export interface BrokerPerformanceData {
  agentId: string;
  agentName: string;
  dealCount: number;
  totalEarned: number;
  approved: number;
  pending: number;
  approvalRate: string;
}

/**
 * Hook for commission summary data
 */
export function useCommissionSummary() {
  const [data, setData] = useState<CommissionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/broker-dashboard/commission-summary");
      setData(response.data.summary);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch summary";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for commission unlock status
 */
export function useCommissionUnlockStatus() {
  const [data, setData] = useState<CommissionUnlockStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/broker-dashboard/unlock-status");
      setData(response.data.data);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch unlock status";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for pending approvals queue (FINANCE/ADMIN only)
 */
export function usePendingApprovals(limit: number = 50) {
  const [data, setData] = useState<PendingApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetch = useCallback(
    async (pageOffset: number = 0) => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`/api/broker-dashboard/pending-approvals?limit=${limit}&offset=${pageOffset}`);
        setData(response.data.data);
        setTotal(response.data.pagination.total);
        setOffset(pageOffset);
      } catch (err: any) {
        if (err.response?.status === 403) {
          setError("Not authorized");
        } else {
          const message = err.response?.data?.error || "Failed to fetch approvals";
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    total,
    loading,
    error,
    offset,
    limit,
    pageCount: Math.ceil(total / limit),
    goToPage: (page: number) => fetch(page * limit),
  };
}

/**
 * Hook for approved commissions with payment tracking
 */
export function useApprovedCommissions(limit: number = 50) {
  const [data, setData] = useState<ApprovedCommission[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetch = useCallback(
    async (pageOffset: number = 0) => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`/api/broker-dashboard/approved-commissions?limit=${limit}&offset=${pageOffset}`);
        setData(response.data.data);
        setTotal(response.data.pagination.total);
        setOffset(pageOffset);
      } catch (err: any) {
        const message = err.response?.data?.error || "Failed to fetch commissions";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    total,
    loading,
    error,
    offset,
    limit,
    pageCount: Math.ceil(total / limit),
    goToPage: (page: number) => fetch(page * limit),
  };
}

/**
 * Hook for broker performance data (FINANCE/ADMIN only)
 */
export function useBrokerPerformance() {
  const [data, setData] = useState<BrokerPerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/broker-dashboard/performance");
      setData(response.data.data);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setError("Not authorized to view performance data");
      } else {
        const message = err.response?.data?.error || "Failed to fetch performance";
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for commission approval action
 */
export function useApproveCommission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (commissionId: string, notes?: string) => {
    try {
      setLoading(true);
      setError(null);
      await axios.patch(`/api/commissions/${commissionId}/approve`, { notes });
      toast.success("Commission approved");
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to approve commission";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { approve, loading, error };
}

/**
 * Hook for commission rejection action
 */
export function useRejectCommission() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reject = useCallback(async (commissionId: string, reason: string) => {
    try {
      setLoading(true);
      setError(null);
      await axios.patch(`/api/commissions/${commissionId}/reject`, { reason });
      toast.success("Commission rejected");
      return true;
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to reject commission";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { reject, loading, error };
}
