import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
export function useFilterState() {
    const [searchParams, setSearchParams] = useSearchParams();
    const filters = {
        floor: searchParams.get("floor") || "All",
        type: searchParams.get("type") || "All",
        minPrice: searchParams.get("minPrice") || "",
        maxPrice: searchParams.get("maxPrice") || "",
    };
    const updateFilters = useCallback((newFilters) => {
        const updated = { ...filters, ...newFilters };
        const params = new URLSearchParams();
        if (updated.floor && updated.floor !== "All")
            params.set("floor", updated.floor);
        if (updated.type && updated.type !== "All")
            params.set("type", updated.type);
        if (updated.minPrice)
            params.set("minPrice", updated.minPrice);
        if (updated.maxPrice)
            params.set("maxPrice", updated.maxPrice);
        setSearchParams(params);
    }, [filters, setSearchParams]);
    const resetFilters = useCallback(() => {
        setSearchParams(new URLSearchParams());
    }, [setSearchParams]);
    return { filters, updateFilters, resetFilters };
}
