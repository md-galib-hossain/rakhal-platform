import { z } from "zod";

/** Mirrors `InviteTeamMemberDto` (backend, RAKHAL-030 email-delivery update). */
export const inviteTeamMemberSchema = z.object({
  email: z.string().trim().email(),
  phone: z
    .string()
    .trim()
    .regex(/^01[0-9]{9}$/)
    .optional()
    .or(z.literal("")),
  name: z.string().trim().max(100).optional(),
  role: z.string().min(1),
});
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

/** Mirrors `UpdateFarmSettingsDto`. */
/** Create a custom role (RFE-101). Mirrors `CreateRoleDto`: a 2-50 char name, an optional
 * description, and *either* a base template to inherit from or an explicit grant list.
 * Reserved system names (Owner/Manager/Worker) are rejected server-side with a 409, mapped
 * back onto the name field. */
export const createRoleFormSchema = z.object({
  name: z.string().trim().min(2, "nameTooShort").max(50, "nameTooLong"),
  description: z.string().trim().max(255, "descriptionTooLong").optional().or(z.literal("")),
  base_role: z.enum(["owner", "manager", "worker"]),
});

export type CreateRoleFormInput = z.infer<typeof createRoleFormSchema>;

/** What actually goes to the API — the form collects a base template, but the dialog lets the
 * user tick the grid before saving, so the request carries concrete keys. */
export interface CreateRoleInput {
  name: string;
  description?: string;
  base_role?: "owner" | "manager" | "worker";
  permission_keys?: string[];
}

export const updateFarmSchema = z.object({
  farm_name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  division: z.string().trim().max(80).optional().or(z.literal("")),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  upazila: z.string().trim().max(80).optional().or(z.literal("")),
  operational_purpose: z.string().trim().max(40).optional().or(z.literal("")),
  timezone: z.string().trim().min(1).max(64).optional(),
});
export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;

const SHED_PURPOSES = ["MILKING", "HEIFER", "DRY", "CALF", "QUARANTINE", "GENERAL"] as const;

/** Mirrors `CreateShedDto`/`UpdateShedDto` (single form covers both create + edit; `name` is the only
 * field the backend actually requires). */
export const shedFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  capacity: z
    .string()
    .trim()
    .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), "Must be a positive whole number")
    .optional()
    .or(z.literal("")),
  purpose: z.enum(SHED_PURPOSES).optional(),
});
export type ShedFormInput = z.infer<typeof shedFormSchema>;

/** Mirrors `CreateSupplierDto`/`UpdateSupplierDto` (single form covers both). */
export const supplierFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(120).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  category: z.string().trim().max(40).optional().or(z.literal("")),
  payment_terms: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});
export type SupplierFormInput = z.infer<typeof supplierFormSchema>;

/** Mirrors `CreateServiceProviderDto`/`UpdateServiceProviderDto` (single form covers both). */
export const serviceProviderFormSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  type: z.enum(["AI_TECHNICIAN", "VETERINARIAN", "OTHER"]),
});
export type ServiceProviderFormInput = z.infer<typeof serviceProviderFormSchema>;
