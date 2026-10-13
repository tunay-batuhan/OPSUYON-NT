// Hand-written row types for the tables the UI reads. Regenerate with
// `npx supabase gen types typescript --project-id <ref>` once the CLI is linked.

export type ServiceLine = {
  code: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type Organization = {
  id: string;
  name: string;
  legal_name: string | null;
  tax_office: string | null;
  tax_no: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  status: "active" | "suspended" | "archived";
  notes: string | null;
  created_at: string;
};

export type Project = {
  id: string;
  organization_id: string;
  service_line: string;
  code: string | null;
  name: string;
  address: string | null;
  status: "active" | "paused" | "closed";
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  organizations?: Pick<Organization, "id" | "name"> | null;
};

export type Role = { id: string; code: string; name: string; scope: "staff" | "customer"; description: string | null };
export type Permission = { code: string; module: string; description: string; sort_order: number };

export type Profile = {
  id: string;
  username: string;
  full_name: string;
  kind: "staff" | "customer";
  organization_id: string | null;
  staff_role_id: string | null;
  phone: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type Personnel = {
  id: string;
  employee_no: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  title: string | null;
  service_line: string | null;
  phone: string | null;
  email: string | null;
  hire_date: string | null;
  termination_date: string | null;
  status: "active" | "passive" | "terminated";
  notes: string | null;
};

export type DocumentCategory = {
  code: string;
  name: string;
  scope: "personnel" | "project";
  permission_code: string;
  requires_period: boolean;
  sort_order: number;
};

export type DocumentRow = {
  id: string;
  project_id: string;
  personnel_id: string | null;
  category_code: string;
  title: string;
  description: string | null;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  period_year: number | null;
  period_month: number | null;
  customer_visible: boolean;
  created_at: string;
};

export type Timesheet = {
  id: string;
  project_id: string;
  personnel_id: string;
  period_year: number;
  period_month: number;
  worked_days: number;
  leave_days: number;
  absence_days: number;
  overtime_hours: number;
  note: string | null;
};

export type LeaveBalance = {
  id: string;
  personnel_id: string;
  year: number;
  entitled_days: number;
  carried_days: number;
  used_days: number;
  remaining_days: number;
};

export type Invoice = {
  id: string;
  project_id: string;
  invoice_no: string;
  issue_date: string;
  due_date: string | null;
  period_year: number | null;
  period_month: number | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total: number;
  currency: string;
  status: "draft" | "issued" | "cancelled";
  document_id: string | null;
  notes: string | null;
};

export type Payment = {
  id: string;
  project_id: string;
  invoice_id: string | null;
  paid_on: string;
  amount: number;
  currency: string;
  method: string | null;
  reference: string | null;
  notes: string | null;
};

export type StatementRow = {
  entry_date: string;
  kind: "fatura" | "odeme";
  ref_no: string | null;
  description: string | null;
  debit: number;
  credit: number;
  balance: number;
};

export type Thread = {
  id: string;
  project_id: string;
  subject: string;
  status: "open" | "closed";
  created_by: string | null;
  last_message_at: string;
  created_at: string;
  projects?: { name: string; organizations?: { name: string } | null } | null;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { full_name: string; kind: "staff" | "customer" } | null;
};

export type AuditLog = {
  id: number;
  at: string;
  actor_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  table_name: string;
  record_id: string | null;
};
