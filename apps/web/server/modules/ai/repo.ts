import { prisma } from "../../db";

export function listJobsForProject(projectId: string) {
  return prisma.aiJob.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      status: true,
      resultJson: true,
      error: true,
      model: true,
      tokensIn: true,
      tokensOut: true,
      createdAt: true,
      finishedAt: true,
    },
  });
}

export function findJob(id: string) {
  return prisma.aiJob.findUnique({ where: { id } });
}
