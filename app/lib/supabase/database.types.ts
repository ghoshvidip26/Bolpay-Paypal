/**
 * Database types for supabase-js. Row shapes mirror
 * supabase/migrations/*.sql (regenerate with the Supabase MCP
 * `generate_typescript_types` or `supabase gen types` after schema changes).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type BusinessRow = {
  id: string;
  name: string;
  currency: string;
  period_anchor: string;
  period_length_days: number;
  created_at: string;
};

export type MemberRow = {
  business_id: string;
  user_id: string;
  role: "owner" | "supervisor" | "worker";
  worker_ref: string | null;
  created_at: string;
};

export type WorkerRow = {
  id: string;
  business_id: string;
  user_id: string | null;
  name: string;
  job_role: string;
  phone: string;
  payout_email: string;
  daily_wage: number;
  joined_on: string;
  status: "active" | "inactive";
  created_at: string;
};

export type AttendanceRow = {
  id: number;
  business_id: string;
  worker_id: string;
  date: string;
  status: "present" | "half" | "absent" | "leave";
  overtime_hours: number;
  units: number;
  updated_by: string | null;
  updated_at: string;
};

export type IncentiveRulesRow = {
  business_id: string;
  working_hours_per_day: number;
  overtime_multiplier: number;
  daily_unit_target: number;
  rate_per_extra_unit: number;
  attendance_threshold: number;
  attendance_bonus: number;
  updated_at: string;
};

export type PayoutRow = {
  id: string;
  business_id: string;
  worker_id: string;
  period_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  breakdown: Json;
  amount: number;
  status: "pending" | "approved" | "rejected";
  submitted_by: string | null;
  submitted_at: string;
  decided_by: string | null;
  decided_at: string | null;
};

export type TransactionRow = {
  id: string;
  business_id: string;
  payout_id: string;
  worker_id: string;
  period_label: string;
  amount: number;
  status: "processing" | "completed" | "failed";
  reference: string;
  failure_reason: string | null;
  paypal_batch_id: string | null;
  paypal_item_id: string | null;
  created_at: string;
  updated_at: string;
};

export type VoiceLogRow = {
  id: number;
  business_id: string;
  user_id: string | null;
  transcript: string;
  intent: Json | null;
  result: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      businesses: Table<BusinessRow, "name">;
      members: Table<MemberRow, "business_id" | "user_id" | "role">;
      workers: Table<WorkerRow, "business_id" | "name" | "daily_wage">;
      attendance: Table<AttendanceRow, "business_id" | "worker_id" | "date" | "status">;
      incentive_rules: Table<IncentiveRulesRow, "business_id">;
      payouts: Table<
        PayoutRow,
        "business_id" | "worker_id" | "period_id" | "period_label" | "period_start" | "period_end" | "breakdown" | "amount"
      >;
      transactions: Table<TransactionRow, "business_id" | "payout_id" | "worker_id" | "period_label" | "amount">;
      voice_logs: Table<VoiceLogRow, "business_id" | "transcript">;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
