"use client";

import { AgGridReact, type AgGridReactProps } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, themeQuartz } from "ag-grid-community";

// Community edition only (MIT). Enterprise features (Excel export, grouping, set filter) are not registered.
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * AG Grid themed from the app's own tokens (slate neutrals, teal-700 accent, IBM Plex, 13px).
 * No AG Grid CSS files are imported: the Theming API injects what it needs.
 */
export const gridTheme = themeQuartz.withParams({
  accentColor: "#0f766e", // teal-700
  backgroundColor: "#ffffff",
  foregroundColor: "#334155", // slate-700
  borderColor: "#e2e8f0", // slate-200
  headerBackgroundColor: "#f8fafc", // slate-50
  headerTextColor: "#64748b", // slate-500
  headerFontWeight: 500,
  headerFontSize: 12,
  fontSize: 13,
  fontFamily: "var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif",
  rowHoverColor: "#f8fafc",
  selectedRowBackgroundColor: "#f0fdfa", // teal-50
  spacing: 6,
  borderRadius: 6,
  wrapperBorder: false, // the surrounding Card already draws the border
  wrapperBorderRadius: 0,
  columnBorder: false,
});

type Props<T> = AgGridReactProps<T> & { gridRef?: React.Ref<AgGridReact<T>> };

/**
 * Shared grid defaults: themed, paginated, sortable, auto-height (no nested scrolling).
 * Pass `getRowId` always: it keeps selection, editing and focus stable when data refreshes.
 */
export function DataGrid<T>({ gridRef, defaultColDef, ...props }: Props<T>) {
  return (
    <AgGridReact<T>
      ref={gridRef}
      theme={gridTheme}
      domLayout="autoHeight"
      pagination
      paginationPageSize={25}
      // The default selector offers 20/50/100; a 25 page size must be in the list or AG Grid warns.
      paginationPageSizeSelector={[10, 25, 50, 100]}
      defaultColDef={{ sortable: true, resizable: true, ...defaultColDef }}
      {...props}
    />
  );
}
