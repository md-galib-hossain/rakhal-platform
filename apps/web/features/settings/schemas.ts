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
