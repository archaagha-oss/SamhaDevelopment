import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

interface FilterState {
  floor: string;
  type: string;
  minPrice: string;
  maxPrice: string;
}

export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters: FilterState = {
    floor: searchParams.get("floor") || "All",
    type: searchParams.get("type") || "All",
    minPrice: searchParams.get("minPrice") || "",
    maxPrice: searchParams.get("maxPrice") || "",
  };

  const updateFilters = useCallback(
    (newFilters: Partial<FilterState>) => {
      const updated = { ...filters, ...newFilters };
      const params = new URLSearchParams();

      if (updated.floor && updated.floor !== "All") params.set("floor", updated.floor);
      if (updated.type && updated.type !== "All") params.set("type", updated.type);
      if (updated.minPrice) params.set("minPrice", updated.minPrice);
      if (updated.maxPrice) params.set("maxPrice", updated.maxPrice);

      setSearchParams(params);
    },
    [filters, setSearchParams]
  );

  const resetFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  return { filters, updateFilters, resetFilters };
}
