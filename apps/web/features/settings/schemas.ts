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
export const updateFarmSchema = z.object({
  farm_name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  division: z.string().trim().max(80).optional().or(z.literal("")),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  upazila: z.string().trim().max(80).optional().or(z.literal("")),
  operational_purpose: z.string().trim().max(40).optional().or(z.literal("")),
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

/** Mirrors `CreateFeedGroupDto`/`UpdateFeedGroupDto`. */
export const feedGroupFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});
export type FeedGroupFormInput = z.infer<typeof feedGroupFormSchema>;

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
