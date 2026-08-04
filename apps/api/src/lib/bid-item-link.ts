import { prisma, type BidItemFormType, type Prisma } from "@frs/db";
import { isStaFormType, quantityFromStaRange } from "@frs/shared";

type MasterRef = {
  code: string;
  name: string;
  unit: string;
  formType: BidItemFormType;
  conversionFactor?: number | null;
};

function defaultContractedQuantity(input: {
  unit: string;
  formType: string;
  beginSta?: string | null;
  endSta?: string | null;
  conversionFactor?: number | null;
}): number {
  if (
    isStaFormType(input.formType) &&
    input.beginSta?.trim() &&
    input.endSta?.trim()
  ) {
    try {
      const cf = Number(input.conversionFactor ?? 1);
      return quantityFromStaRange(
        input.unit,
        input.beginSta,
        input.endSta,
        cf,
      );
    } catch {
      /* fall through */
    }
  }
  return 1;
}

/** Create or update the contract BidItem and return its id. */
export async function upsertBidItemForProjectTask(
  tx: Prisma.TransactionClient,
  input: {
    projectId: string;
    master: MasterRef;
    contractedQuantity?: number | null;
    beginSta?: string | null;
    endSta?: string | null;
    itemNumber?: string | null;
  },
): Promise<string> {
  const itemNumber = (input.itemNumber ?? input.master.code).trim().toUpperCase();
  const qty =
    input.contractedQuantity != null && input.contractedQuantity > 0
      ? input.contractedQuantity
      : defaultContractedQuantity({
          unit: input.master.unit,
          formType: input.master.formType,
          beginSta: input.beginSta,
          endSta: input.endSta,
          conversionFactor: input.master.conversionFactor,
        });

  const bidItem = await tx.bidItem.upsert({
    where: {
      projectId_itemNumber: {
        projectId: input.projectId,
        itemNumber,
      },
    },
    create: {
      projectId: input.projectId,
      itemNumber,
      description: input.master.name,
      unit: input.master.unit,
      estimatedQuantity: qty,
      formType: input.master.formType,
    },
    update: {
      description: input.master.name,
      unit: input.master.unit,
      formType: input.master.formType,
      ...(input.contractedQuantity != null && input.contractedQuantity > 0
        ? { estimatedQuantity: input.contractedQuantity }
        : {}),
    },
  });

  return bidItem.id;
}

/** Link existing project tasks to bid items (one-time / seed helper). */
export async function backfillBidItemLinks(projectId?: string): Promise<number> {
  const tasks = await prisma.projectTask.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      bidItemId: null,
    },
    include: {
      taskMaster: {
        select: {
          code: true,
          name: true,
          unit: true,
          formType: true,
          conversionFactor: true,
        },
      },
    },
  });

  let linked = 0;
  for (const task of tasks) {
    const bidItemId = await prisma.$transaction(async (tx) => {
      const id = await upsertBidItemForProjectTask(tx, {
        projectId: task.projectId,
        master: {
          code: task.taskMaster.code,
          name: task.taskMaster.name,
          unit: task.taskMaster.unit,
          formType: task.taskMaster.formType,
          conversionFactor:
            task.taskMaster.conversionFactor != null
              ? Number(task.taskMaster.conversionFactor)
              : null,
        },
        beginSta: task.beginSta,
        endSta: task.endSta,
      });
      await tx.projectTask.update({
        where: { id: task.id },
        data: { bidItemId: id },
      });
      return id;
    });
    if (bidItemId) linked += 1;
  }
  return linked;
}
