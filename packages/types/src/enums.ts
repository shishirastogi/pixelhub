/**
 * Domain enums — mirrors the Prisma schema in docs/02-database-schema.md.
 * Keep in sync with `packages/db/prisma/schema.prisma`.
 */

export const Role = {
  OWNER: "OWNER",
  CONTRIBUTOR: "CONTRIBUTOR",
  REVIEWER: "REVIEWER",
  CLIENT: "CLIENT",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const AccountType = {
  DESIGNER: "DESIGNER",
  CLIENT: "CLIENT",
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const InviteDirection = {
  INVITE: "INVITE",
  REQUEST: "REQUEST",
} as const;
export type InviteDirection =
  (typeof InviteDirection)[keyof typeof InviteDirection];

export const InviteStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
} as const;
export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  ON_HOLD: "ON_HOLD",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const RequirementSource = {
  MANUAL: "MANUAL",
  AI_EXTRACTED: "AI_EXTRACTED",
} as const;
export type RequirementSource =
  (typeof RequirementSource)[keyof typeof RequirementSource];

export const RequirementStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  FULFILLED: "FULFILLED",
} as const;
export type RequirementStatus =
  (typeof RequirementStatus)[keyof typeof RequirementStatus];

export const Priority = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" } as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const DeliverableStatus = {
  OPEN: "OPEN",
  SATISFIED: "SATISFIED",
} as const;
export type DeliverableStatus =
  (typeof DeliverableStatus)[keyof typeof DeliverableStatus];

export const LinkType = {
  SATISFIES: "SATISFIES",
  SUPPORTS: "SUPPORTS",
  SUPERSEDED: "SUPERSEDED",
} as const;
export type LinkType = (typeof LinkType)[keyof typeof LinkType];

export const MatchedBy = {
  WATCHER_RULE: "WATCHER_RULE",
  AI: "AI",
  MANUAL: "MANUAL",
} as const;
export type MatchedBy = (typeof MatchedBy)[keyof typeof MatchedBy];

export const BranchKind = {
  MAIN: "MAIN",
  CONCEPT: "CONCEPT",
  REVISION: "REVISION",
  EXPERIMENTAL: "EXPERIMENTAL",
} as const;
export type BranchKind = (typeof BranchKind)[keyof typeof BranchKind];

export const BranchStatus = {
  ACTIVE: "ACTIVE",
  MERGED: "MERGED",
  ABANDONED: "ABANDONED",
  APPROVED: "APPROVED",
} as const;
export type BranchStatus = (typeof BranchStatus)[keyof typeof BranchStatus];

export const FileRole = {
  SOURCE: "SOURCE",
  EXPORT: "EXPORT",
  DELIVERABLE: "DELIVERABLE",
  ASSET: "ASSET",
} as const;
export type FileRole = (typeof FileRole)[keyof typeof FileRole];

export const FileKind = {
  SOURCE: "SOURCE",
  EXPORT: "EXPORT",
  DELIVERABLE: "DELIVERABLE",
  REFERENCE: "REFERENCE",
  BRAND_ASSET: "BRAND_ASSET",
  BRIEF_DOC: "BRIEF_DOC",
  OTHER: "OTHER",
} as const;
export type FileKind = (typeof FileKind)[keyof typeof FileKind];

export const DesignSheetItemType = {
  IMAGE: "IMAGE",
  URL: "URL",
  NOTE: "NOTE",
  COLOR: "COLOR",
  FILE_REF: "FILE_REF",
} as const;
export type DesignSheetItemType =
  (typeof DesignSheetItemType)[keyof typeof DesignSheetItemType];

export const BrandColorRole = {
  PRIMARY: "PRIMARY",
  SECONDARY: "SECONDARY",
  ACCENT: "ACCENT",
  NEUTRAL: "NEUTRAL",
  BACKGROUND: "BACKGROUND",
  TEXT: "TEXT",
} as const;
export type BrandColorRole =
  (typeof BrandColorRole)[keyof typeof BrandColorRole];

export const BrandFontRole = {
  HEADING: "HEADING",
  BODY: "BODY",
  MONO: "MONO",
  OTHER: "OTHER",
} as const;
export type BrandFontRole =
  (typeof BrandFontRole)[keyof typeof BrandFontRole];

export const BrandLogoVariant = {
  PRIMARY: "PRIMARY",
  MONO: "MONO",
  ICON: "ICON",
  WORDMARK: "WORDMARK",
} as const;
export type BrandLogoVariant =
  (typeof BrandLogoVariant)[keyof typeof BrandLogoVariant];

export const BrandRuleType = {
  MIN_CLEAR_SPACE: "MIN_CLEAR_SPACE",
  MIN_SIZE: "MIN_SIZE",
  FORBIDDEN_COLOR: "FORBIDDEN_COLOR",
  FORBIDDEN_FONT: "FORBIDDEN_FONT",
  USAGE_NOTE: "USAGE_NOTE",
} as const;
export type BrandRuleType = (typeof BrandRuleType)[keyof typeof BrandRuleType];

export const Severity = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const BrandCheckType = {
  COLOR: "COLOR",
  FONT: "FONT",
  LOGO: "LOGO",
  RULE: "RULE",
} as const;
export type BrandCheckType = (typeof BrandCheckType)[keyof typeof BrandCheckType];

export const CheckStatus = {
  PASS: "PASS",
  WARNING: "WARNING",
  FAIL: "FAIL",
} as const;
export type CheckStatus = (typeof CheckStatus)[keyof typeof CheckStatus];

export const CommentStatus = {
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

export const TaskSource = {
  MANUAL: "MANUAL",
  AI_EXTRACTED: "AI_EXTRACTED",
  COMMENT: "COMMENT",
  AI_RECOMMENDATION: "AI_RECOMMENDATION",
} as const;
export type TaskSource = (typeof TaskSource)[keyof typeof TaskSource];

export const TaskStatus = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
  CANCELLED: "CANCELLED",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const DecisionStatus = {
  PROPOSED: "PROPOSED",
  DECIDED: "DECIDED",
  SUPERSEDED: "SUPERSEDED",
  REVISITED: "REVISITED",
} as const;
export type DecisionStatus = (typeof DecisionStatus)[keyof typeof DecisionStatus];

export const AiJobType = {
  EXTRACT_REQUIREMENTS: "EXTRACT_REQUIREMENTS",
  GENERATE_TASKS: "GENERATE_TASKS",
  COMPARE_VERSIONS: "COMPARE_VERSIONS",
  BRAND_CHECK: "BRAND_CHECK",
  MATCH_FILE: "MATCH_FILE",
  PROJECT_STATUS_NARRATIVE: "PROJECT_STATUS_NARRATIVE",
} as const;
export type AiJobType = (typeof AiJobType)[keyof typeof AiJobType];

export const AiJobStatus = {
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  SUCCEEDED: "SUCCEEDED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type AiJobStatus = (typeof AiJobStatus)[keyof typeof AiJobStatus];
