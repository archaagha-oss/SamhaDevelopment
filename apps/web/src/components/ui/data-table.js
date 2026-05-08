import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as React from "react";
import { flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable, } from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { cn } from "@/lib/utils";
export function DataTable({ columns, data, getRowId, enablePagination = true, pageSize = 25, onSelectionChange, rowSelection: rowSelectionProp, setRowSelection: setRowSelectionProp, emptyMessage = "No results.", className, toolbar, }) {
    const [sorting, setSorting] = React.useState([]);
    const [columnFilters, setColumnFilters] = React.useState([]);
    const [internalSelection, setInternalSelection] = React.useState({});
    const rowSelection = rowSelectionProp ?? internalSelection;
    const setRowSelection = setRowSelectionProp ?? setInternalSelection;
    const table = useReactTable({
        data,
        columns,
        getRowId,
        state: { sorting, columnFilters, rowSelection },
        enableRowSelection: true,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
        initialState: enablePagination ? { pagination: { pageSize } } : undefined,
    });
    React.useEffect(() => {
        if (!onSelectionChange)
            return;
        onSelectionChange(table.getSelectedRowModel().rows.map((r) => r.original));
    }, [rowSelection, onSelectionChange, table]);
    return (_jsxs("div", { className: cn("space-y-3", className), children: [toolbar && toolbar(table), _jsx("div", { className: "rounded-md border", children: _jsxs(Table, { children: [_jsx(TableHeader, { children: table.getHeaderGroups().map((hg) => (_jsx(TableRow, { children: hg.headers.map((header) => {
                                    const canSort = header.column.getCanSort();
                                    const sortDir = header.column.getIsSorted();
                                    return (_jsx(TableHead, { className: canSort ? "cursor-pointer select-none" : "", children: header.isPlaceholder ? null : (_jsxs("div", { className: "flex items-center gap-2", onClick: canSort ? header.column.getToggleSortingHandler() : undefined, children: [flexRender(header.column.columnDef.header, header.getContext()), canSort && (sortDir === "asc" ? _jsx(ChevronUp, { className: "h-3.5 w-3.5" }) :
                                                    sortDir === "desc" ? _jsx(ChevronDown, { className: "h-3.5 w-3.5" }) :
                                                        _jsx(ChevronsUpDown, { className: "h-3.5 w-3.5 opacity-40" }))] })) }, header.id));
                                }) }, hg.id))) }), _jsx(TableBody, { children: table.getRowModel().rows?.length ? (table.getRowModel().rows.map((row) => (_jsx(TableRow, { "data-state": row.getIsSelected() && "selected", children: row.getVisibleCells().map((cell) => (_jsx(TableCell, { children: flexRender(cell.column.columnDef.cell, cell.getContext()) }, cell.id))) }, row.id)))) : (_jsx(TableRow, { children: _jsx(TableCell, { colSpan: columns.length, className: "h-24 text-center text-muted-foreground", children: emptyMessage }) })) })] }) }), enablePagination && table.getPageCount() > 1 && (_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: [Object.keys(rowSelection).length, " of ", table.getFilteredRowModel().rows.length, " selected"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-sm text-muted-foreground", children: ["Page ", table.getState().pagination.pageIndex + 1, " of ", table.getPageCount()] }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => table.previousPage(), disabled: !table.getCanPreviousPage(), children: "Previous" }), _jsx(Button, { variant: "outline", size: "sm", onClick: () => table.nextPage(), disabled: !table.getCanNextPage(), children: "Next" })] })] }))] }));
}
