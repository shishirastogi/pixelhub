import { requireCurrentUser } from "@/server/auth/session";
import { ALL_ROLES, authorizeProject } from "@/server/auth/permissions";
import { listTasks } from "@/server/modules/tasks/service";
import { listRequirements } from "@/server/modules/requirements/service";
import TasksTab from "@/components/tasks/TasksTab";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  params,
}: {
  params: { slug: string };
}) {
  const user = await requireCurrentUser();
  const { project } = await authorizeProject(user.id, params.slug, ALL_ROLES);

  const [taskList, requirements] = await Promise.all([
    listTasks(user.id, params.slug, {}),
    listRequirements(user.id, params.slug, {}),
  ]);
  const tasks = Array.isArray(taskList) ? taskList : [];

  return (
    <TasksTab
      projectId={project.id}
      initialTasks={tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        source: task.source,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        createdAt: task.createdAt.toISOString(),
        checklistJson: task.checklistJson,
        requirement: task.requirement
          ? { id: task.requirement.id, title: task.requirement.title }
          : null,
        assignee: task.assignee
          ? { id: task.assignee.id, name: task.assignee.name }
          : null,
      }))}
      requirements={requirements
        .filter(
          (requirement) =>
            requirement.status === "ACCEPTED" ||
            requirement.status === "FULFILLED",
        )
        .map((requirement) => ({
          id: requirement.id,
          title: requirement.title,
        }))}
    />
  );
}
