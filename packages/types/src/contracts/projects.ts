import { z } from "zod";
import { InviteStatus, ProjectStatus, Role } from "../enums";

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  clientName: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  briefText: z.string().max(100_000).nullable().optional(),
  aiEnabled: z.boolean().optional(),
  createExperimentalBranch: z.boolean().optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientName: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  aiEnabled: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const listActivityQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListActivityQuery = z.infer<typeof listActivityQuerySchema>;

export const memberPermissionsSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  canViewFiles: z.boolean().optional(),
  canDownloadFiles: z.boolean().optional(),
  canViewBrief: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canApproveVersions: z.boolean().optional(),
});
export type MemberPermissionsInput = z.infer<typeof memberPermissionsSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().email().max(320),
  role: z.nativeEnum(Role).default(Role.CLIENT),
  message: z.string().max(1000).nullable().optional(),
  canViewFiles: z.boolean().default(true),
  canDownloadFiles: z.boolean().default(false),
  canViewBrief: z.boolean().default(true),
  canComment: z.boolean().default(true),
  canApproveVersions: z.boolean().default(true),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const requestProjectAccessSchema = z.object({
  projectSlugOrId: z.string().min(1).max(200),
  message: z.string().max(1000).nullable().optional(),
});
export type RequestProjectAccessInput = z.infer<
  typeof requestProjectAccessSchema
>;

export const respondInviteSchema = z.object({
  status: z.enum([InviteStatus.ACCEPTED, InviteStatus.DECLINED]),
  role: z.nativeEnum(Role).optional(),
  canViewFiles: z.boolean().optional(),
  canDownloadFiles: z.boolean().optional(),
  canViewBrief: z.boolean().optional(),
  canComment: z.boolean().optional(),
  canApproveVersions: z.boolean().optional(),
});
export type RespondInviteInput = z.infer<typeof respondInviteSchema>;
