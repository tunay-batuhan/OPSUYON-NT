import type { ContactStatus, ContactTopic } from "@/lib/schemas-contact";

export type ContactMessage = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  topic: ContactTopic;
  message: string;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
  handled_at: string | null;
  handled_by?: string | null;
};

export const STATUS_TONE = { yeni: "brand", okundu: "neutral", yanitlandi: "success" } as const;
