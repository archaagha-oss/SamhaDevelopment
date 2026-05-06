/**
 * Request Deduplication & Response Caching Middleware
 * Prevents duplicate requests and caches responses for improved performance
 */

import { Request, Response, NextFunction } from "express";

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class RequestCache {
  private cache: Map<string, CacheEntry> = new Map();
  private inFlight: Map<string, Promise<any>> = new Map();
  private readonly defaultTTL = 30000; // 30 seconds

  /**
   * Generate cache key from request
   */
  private getCacheKey(req: Request): string {
    const { method, path, query } = req;
    const queryString = new URLSearchParams(query as Record<string, string>).toString();
    return `${method}:${path}${queryString ? "?" + queryString : ""}`;
  }

  /**
   * Check if cached entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * Middleware for automatic caching GET requests
   */
  middleware(ttl = this.defaultTTL) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Only cache GET requests
      if (req.method !== "GET") {
        return next();
      }

      const cacheKey = this.getCacheKey(req);

      // Check if valid cached response exists
      const cached = this.cache.get(cacheKey);
      if (cached && this.isValid(cached)) {
        return res.json(cached.data);
      }

      // Check if request is already in flight — return the promise
      if (this.inFlight.has(cacheKey)) {
        return this.inFlight.get(cacheKey)!.then((data) => res.json(data));
      }

      // Intercept res.json to cache response
      const originalJson = res.json.bind(res);
      res.json = function (data: any) {
        const cacheEntry: CacheEntry = {
          data,
          timestamp: Date.now(),
          ttl,
        };
        RequestCache.instance.cache.set(cacheKey, cacheEntry);
        return originalJson(data);
      };

      // Track in-flight request
      const promise = new Promise((resolve) => {
        const originalSend = res.send.bind(res);
        res.send = function (data: any) {
          RequestCache.instance.inFlight.delete(cacheKey);
          resolve(data);
          return originalSend(data);
        };
      });
      this.inFlight.set(cacheKey, promise);

      next();
    };
  }

  /**
   * Clear cache for a specific pattern (e.g., clear all unit caches)
   */
  clearPattern(pattern: string): number {
    let cleared = 0;
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  /**
   * Get cache stats for monitoring
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      inFlightRequests: this.inFlight.size,
      cacheMemory: JSON.stringify(Array.from(this.cache.values())).length,
    };
  }

  private static instance = new RequestCache();
  static getInstance() {
    return this.instance;
  }
}

export const requestCache = RequestCache.getInstance();
