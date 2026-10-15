import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../db";

const authorSelect = {
  select: {
    id: true,
    name: true,
    email: true,
    accountType: true,
    company: true,
    avatarUrl: true,
  },
} as const;

const fileSelect = {
  select: {
    id: true,
    fileName: true,
    path: true,
    extension: true,
    mimeType: true,
  },
} as const;

const versionSelect = {
  select: {
    id: true,
    number: true,
    label: true,
  },
} as const;

const commentInclude = {
  author: authorSelect,
  file: fileSelect,
  version: versionSelect,
};

export function findVersionWithProject(id: string) {
  return prisma.version.findUnique({
    where: { id },
    include: { branch: { select: { projectId: true } } },
  });
}

export function findFile(id: string) {
  return prisma.file.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, projectId: true },
  });
}

export function findComment(id: string) {
  return prisma.comment.findUnique({
    where: { id },
    include: commentInclude,
  });
}

export function findParentComment(id: string) {
  return prisma.comment.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
}

export function findCommentsForVersion(versionId: string) {
  return prisma.comment.findMany({
    where: { versionId },
    orderBy: { createdAt: "asc" },
    include: commentInclude,
  });
}

export function findCommentsForFile(fileId: string) {
  return prisma.comment.findMany({
    where: { fileId },
    orderBy: { createdAt: "asc" },
    include: commentInclude,
  });
}

export function findCommentsForProject(projectId: string) {
  return prisma.comment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: commentInclude,
  });
}

export function createComment(
  data: Prisma.CommentUncheckedCreateInput,
  db: Db = prisma,
) {
  return db.comment.create({ data, include: commentInclude });
}

export function updateComment(
  id: string,
  data: Prisma.CommentUncheckedUpdateInput,
  db: Db = prisma,
) {
  return db.comment.update({ where: { id }, data, include: commentInclude });
}
