/**
 * Unit API Service with Optimistic Updates
 * Handles unit data fetching, caching, and updates with instant UI feedback
 */

import axios from "axios";
import { toast } from "sonner";

class UnitApiService {
  constructor() {
    this.cache = new Map();
    this.inFlight = new Map();
    this.cacheTTL = 30000; // 30 seconds
  }

  /**
   * Fetch unit with caching and deduplication
   */
  async getUnit(unitId) {
    const cacheKey = `unit:${unitId}`;

    // Check in-flight
    if (this.inFlight.has(cacheKey)) {
      return this.inFlight.get(cacheKey);
    }

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Fetch
    const promise = axios
      .get(`/api/units/${unitId}`)
      .then((res) => {
        this.cache.set(cacheKey, {
          data: res.data,
          timestamp: Date.now(),
        });
        this.inFlight.delete(cacheKey);
        return res.data;
      })
      .catch((err) => {
        this.inFlight.delete(cacheKey);
        throw err;
      });

    this.inFlight.set(cacheKey, promise);
    return promise;
  }

  /**
   * Update unit price with optimistic UI update
   */
  async updatePrice(unitId, newPrice, onOptimisticUpdate) {
    const cacheKey = `unit:${unitId}`;

    try {
      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ price: newPrice });
      }

      // API call
      const response = await axios.patch(`/api/units/${unitId}`, {
        price: newPrice,
      });

      // Invalidate cache
      this.cache.delete(cacheKey);

      toast.success("Price updated");
      return response.data;
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Failed to update price";
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Update unit agent with optimistic UI update
   */
  async updateAgent(unitId, agentId, onOptimisticUpdate) {
    const cacheKey = `unit:${unitId}`;

    try {
      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ assignedAgentId: agentId });
      }

      // API call
      const response = await axios.patch(`/api/units/${unitId}`, {
        assignedAgentId: agentId || null,
      });

      // Invalidate cache
      this.cache.delete(cacheKey);

      toast.success("Agent assigned");
      return response.data;
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Failed to update agent";
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Update unit status with optimistic UI update
   */
  async updateStatus(unitId, newStatus, reason, onOptimisticUpdate) {
    const cacheKey = `unit:${unitId}`;

    try {
      // Optimistic update
      if (onOptimisticUpdate) {
        onOptimisticUpdate({ status: newStatus });
      }

      // API call
      const response = await axios.patch(
        `/api/units/${unitId}/status`,
        {
          newStatus,
          reason,
        }
      );

      // Invalidate cache
      this.cache.delete(cacheKey);

      toast.success("Status updated");
      return response.data;
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Failed to update status";
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Bulk update units
   */
  async bulkUpdate(unitIds, operation, value, reason) {
    try {
      const response = await axios.post("/api/units/bulk-ops", {
        unitIds,
        operation,
        value,
        reason,
      });

      // Invalidate all affected units
      unitIds.forEach((id) => {
        this.cache.delete(`unit:${id}`);
      });

      toast.success(
        `${response.data.succeeded} units updated, ${response.data.failed} failed`
      );
      return response.data;
    } catch (err) {
      const errorMsg =
        err.response?.data?.error || "Bulk update failed";
      toast.error(errorMsg);
      throw err;
    }
  }

  /**
   * Clear unit cache (useful after updates from other sources)
   */
  clearCache(pattern) {
    if (pattern) {
      for (const [key] of this.cache) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      inFlightRequests: this.inFlight.size,
    };
  }
}

// Singleton
export const unitApiService = new UnitApiService();
