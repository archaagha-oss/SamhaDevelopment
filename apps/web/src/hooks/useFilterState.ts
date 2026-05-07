import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

interface UseFilterStateOptions {
  defaultValues: Record<string, string | boolean | number>;
}

export const useFilterState = (options: UseFilterStateOptions) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Record<string, string | boolean | number>>({});

  // Initialize filters from URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initialFilters = { ...options.defaultValues };

    for (const [key, value] of params.entries()) {
      if (value === "true") initialFilters[key] = true;
      else if (value === "false") initialFilters[key] = false;
      else if (!isNaN(Number(value))) initialFilters[key] = Number(value);
      else initialFilters[key] = value;
    }

    setFilters(initialFilters);
  }, [location.search, options.defaultValues]);

  // Update URL when filters change
  const updateFilter = useCallback((key: string, value: string | boolean | number | null) => {
    setFilters((prev) => {
      const updated = { ...prev };
      if (value === null || value === options.defaultValues[key]) {
        delete updated[key];
      } else {
        updated[key] = value;
      }

      // Build new URL params
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(updated)) {
        if (v !== null && v !== undefined) {
          params.set(k, String(v));
        }
      }

      // Update URL without full page reload
      const queryString = params.toString();
      navigate(`${location.pathname}${queryString ? "?" + queryString : ""}`, { replace: true });

      return updated;
    });
  }, [location.pathname, navigate, options.defaultValues]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(options.defaultValues);
    navigate(location.pathname, { replace: true });
  }, [location.pathname, navigate, options.defaultValues]);

  return { filters, updateFilter, resetFilters };
};
