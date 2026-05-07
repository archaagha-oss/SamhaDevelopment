import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";

/**
 * Financial data types for dashboard
 */
export interface FinanceSummary {
  totalDue: number;
  collected: number;
  overdue: number;
  atRisk: number;
  collectionRate: string;
}

export interface PaymentBreakdown {
  [key: string]: { count: number; amount: number };
}

export interface ExpectedVsReceived {
  month: string;
  expected: number;
  received: number;
}

export interface OverduePayment {
  id: string;
  paymentId: string;
  dealNumber: string;
  dealId: string;
  dealStage: string;
  leadName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  milestoneLabel: string;
}

export interface BrokerPerformance {
  brokerId: string;
  brokerName: string;
  dealCount: number;
  totalSalePrice: number;
  collectionAmount: number;
  collectionRate: string;
  avgPaymentDays: number;
}

export interface UpcomingPayment {
  date: string;
  count: number;
  totalAmount: number;
  payments: Array<{
    id: string;
    dealNumber: string;
    leadName: string;
    amount: number;
    milestoneLabel: string;
  }>;
}

/**
 * Hook for fetching and managing finance dashboard data
 * Includes caching and error handling
 */
export function useFinanceSummary() {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/finance/summary");
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
 * Hook for payment breakdown data (pie/donut chart)
 */
export function usePaymentBreakdown() {
  const [data, setData] = useState<PaymentBreakdown | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/finance/payment-breakdown");
      setData(response.data.breakdown);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch breakdown";
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
 * Hook for expected vs received data (bar chart)
 */
export function useExpectedVsReceived(months: number = 6) {
  const [data, setData] = useState<ExpectedVsReceived[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/finance/expected-vs-received?months=${months}`);
      setData(response.data.data);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch chart data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [months]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for overdue payments with pagination
 */
export function useOverduePayments(limit: number = 50) {
  const [data, setData] = useState<OverduePayment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetch = useCallback(
    async (pageOffset: number = 0) => {
      try {
        setLoading(true);
        setError(null);
        const response = await axios.get(`/api/finance/overdue-payments?days=0&limit=${limit}&offset=${pageOffset}`);
        setData(response.data.data);
        setTotal(response.data.pagination.total);
        setOffset(pageOffset);
      } catch (err: any) {
        const message = err.response?.data?.error || "Failed to fetch overdue payments";
        setError(message);
        toast.error(message);
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
    nextPage: () => fetch((offset + limit) >= total ? offset : offset + limit),
    prevPage: () => fetch(Math.max(0, offset - limit)),
  };
}

/**
 * Hook for broker performance data
 */
export function useBrokerPerformance(limit: number = 20) {
  const [data, setData] = useState<BrokerPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/finance/broker-performance?limit=${limit}`);
      setData(response.data.data);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch broker performance";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for upcoming payments timeline
 */
export function useUpcomingPayments(days: number = 30) {
  const [data, setData] = useState<UpcomingPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/finance/upcoming-payments?days=${days}`);
      setData(response.data.data);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch upcoming payments";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Hook for metrics by deal stage
 */
export function useMetricsByStage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get("/api/finance/metrics-by-stage");
      setData(response.data.data);
    } catch (err: any) {
      const message = err.response?.data?.error || "Failed to fetch stage metrics";
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
