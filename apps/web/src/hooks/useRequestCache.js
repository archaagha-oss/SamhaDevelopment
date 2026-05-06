import { useRef, useCallback } from "react";

/**
 * useRequestCache — Client-side request deduplication & caching
 *
 * Deduplicates identical requests in-flight and caches responses
 * Usage:
 * const { cachedFetch } = useRequestCache();
 * const data = await cachedFetch('/api/units/123', { ttl: 30000 });
 */
export function useRequestCache() {
  const cache = useRef(new Map());
  const inFlight = useRef(new Map());

  const cachedFetch = useCallback(
    async (url, options = {}) => {
      const { ttl = 30000, ...fetchOptions } = options;

      // Generate cache key
      const cacheKey = `${fetchOptions.method || "GET"}:${url}`;

      // Check in-flight requests first (deduplication)
      if (inFlight.current.has(cacheKey)) {
        return inFlight.current.get(cacheKey);
      }

      // Check cache
      const cached = cache.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }

      // Fetch and cache
      const promise = fetch(url, fetchOptions)
        .then((res) => res.json())
        .then((data) => {
          cache.current.set(cacheKey, {
            data,
            timestamp: Date.now(),
          });
          inFlight.current.delete(cacheKey);
          return data;
        })
        .catch((err) => {
          inFlight.current.delete(cacheKey);
          throw err;
        });

      inFlight.current.set(cacheKey, promise);
      return promise;
    },
    []
  );

  const clearCache = useCallback((pattern) => {
    if (pattern) {
      for (const [key] of cache.current) {
        if (key.includes(pattern)) {
          cache.current.delete(key);
        }
      }
    } else {
      cache.current.clear();
    }
  }, []);

  return { cachedFetch, clearCache };
}
