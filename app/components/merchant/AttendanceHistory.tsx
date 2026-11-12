"use client";

import { useMemo, useRef, useState } from "react";
import type { AgGridReact } from "ag-grid-react";
import type { CellKeyDownEvent, ColDef, ICellRendererParams, RowClickedEvent, ProcessCellForExportParams } from "ag-grid-community";
import { useStore } from "@/app/lib/merchant/store";
import { formatDate } from "@/app/lib/merchant/format";
import type { AttendanceStatus } from "@/app/lib/merchant/types";
import { useToast } from "../feedback/Toaster";
import { DataGrid } from "./DataGrid";
import { Avatar, Button, Card, EmptyState, fieldClass, StatusBadge } from "./ui";

interface HistoryRow {
  id: string;
  date: string;
  worker: string;
  role: string;
  status: AttendanceStatus;
  /** What the Status column shows, filters and exports. */
  statusLabel: string;
  overtimeHours: number;
  units: number;
  /** Only the current period can be edited (the server rejects anything older). */
  editable: boolean;
}

const LABEL: Record<AttendanceStatus, string> = { present: "Present", half: "Half day", absent: "Absent", leave: "On leave" };

function WorkerCell({ data }: ICellRendererParams<HistoryRow>) {
  if (!data) return null;
  return (
    <span className="flex items-center gap-2">
      <Avatar name={data.worker} />
      <span className="font-medium text-slate-900">{data.worker}</span>
    </span>
  );
}

function StatusCell({ data }: ICellRendererParams<HistoryRow>) {
  return data ? <StatusBadge status={data.status} /> : null;
}

/** Every recorded day, for every worker, across pay periods. Click a current-period row to edit that day. */
export function AttendanceHistory({ onOpenDate }: { onOpenDate: (date: string) => void }) {
  const { attendance, workers, period, today } = useStore();
  const toast = useToast();
  const grid = useRef<AgGridReact<HistoryRow>>(null);
  const [search, setSearch] = useState("");

  const rows = useMemo<HistoryRow[]>(() => {
    const byId = new Map(workers.map((w) => [w.id, w]));
    return attendance.map((r) => {
      const w = byId.get(r.workerId);
      return {
        id: `${r.workerId}|${r.date}`,
        date: r.date,
        worker: w?.name ?? "Unknown worker",
        role: w?.role ?? "",
        status: r.status,
        statusLabel: LABEL[r.status],
        overtimeHours: r.overtimeHours,
        units: r.units,
        editable: r.date >= period.start && r.date <= today,
      };
    });
  }, [attendance, workers, period, today]);

  const columns = useMemo<ColDef<HistoryRow>[]>(
    () => [
      { field: "date", headerName: "Date", cellDataType: "dateString", filter: "agDateColumnFilter", valueFormatter: (p) => (p.value ? formatDate(p.value) : ""), sort: "desc", sortIndex: 0, minWidth: 130 },
      { field: "worker", headerName: "Worker", filter: "agTextColumnFilter", cellRenderer: WorkerCell, minWidth: 190, sort: "asc", sortIndex: 1 },
      { field: "role", headerName: "Role", filter: "agTextColumnFilter", minWidth: 120 },
      { field: "statusLabel", headerName: "Status", filter: "agTextColumnFilter", cellRenderer: StatusCell, minWidth: 130 },
      { field: "overtimeHours", headerName: "Overtime (h)", filter: "agNumberColumnFilter", type: "numericColumn", minWidth: 120 },
      { field: "units", headerName: "Units", filter: "agNumberColumnFilter", type: "numericColumn", minWidth: 100 },
    ],
    [],
  );

  function open(row: HistoryRow | undefined) {
    if (row?.editable) onOpenDate(row.date);
  }

  function exportCsv() {
    grid.current?.api.exportDataAsCsv({
      fileName: `attendance-history-${today}.csv`,
      // Raw values: ISO dates and plain numbers import cleanly into a spreadsheet.
      processCellCallback: (p: ProcessCellForExportParams<HistoryRow>) => p.value,
    });
    toast({ tone: "success", title: "Attendance exported", description: "Your current filters and sort were applied." });
  }

  return (
    <Card
      className="mt-5"
      flush
      title={
        <span className="flex items-baseline gap-2">
          Attendance history
          <span className="text-xs font-normal text-slate-500 tabular-nums">{rows.length.toLocaleString()} records</span>
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <input
            type="search"
            aria-label="Search attendance history"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={fieldClass("h-7 w-44 px-2 text-xs")}
          />
          <Button size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            Export CSV
          </Button>
        </div>
      }
    >
      {rows.length === 0 ? (
        <EmptyState>No attendance has been recorded yet.</EmptyState>
      ) : (
        <>
          <DataGrid<HistoryRow>
            gridRef={grid}
            rowData={rows}
            columnDefs={columns}
            getRowId={(p) => p.data.id}
            quickFilterText={search}
            defaultColDef={{ flex: 1, floatingFilter: true }}
            getRowClass={(p) => (p.data?.editable ? "cursor-pointer" : undefined)}
            onRowClicked={(e: RowClickedEvent<HistoryRow>) => open(e.data)}
            onCellKeyDown={(e: CellKeyDownEvent<HistoryRow>) => {
              if (e.event instanceof KeyboardEvent && e.event.key === "Enter") open(e.data);
            }}
          />
          <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            Click a row from {formatDate(period.start)} onward to edit that day. Earlier periods are read-only.
          </p>
        </>
      )}
    </Card>
  );
}
