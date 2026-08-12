/** Prisma filter: field leads see projects they are rostered on or have assigned tasks. */
export function fieldLeadAccessWhere(userId: string) {
  return {
    OR: [
      { fieldLeads: { some: { userId } } },
      {
        tasks: {
          some: {
            isActive: true,
            assignedToId: userId,
          },
        },
      },
    ],
  };
}

export function isOnProjectFieldLeadRoster(
  fieldLeads: { userId: string }[],
  userId: string,
): boolean {
  return fieldLeads.some((fl) => fl.userId === userId);
}

/** Rostered field leads work all project tasks; others only see tasks assigned to them. */
export function visibleTasksForFieldLead<
  T extends { assignedToId: string | null },
>(tasks: T[], userId: string, onRoster: boolean): T[] {
  if (onRoster) return tasks;
  return tasks.filter((t) => t.assignedToId === userId);
}

export function canFieldLeadWorkOnTask(
  userId: string,
  assignedToId: string | null,
  onRoster: boolean,
): boolean {
  return onRoster || assignedToId === userId;
}
