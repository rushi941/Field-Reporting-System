import { resolveLineTypeLabel, staBillingUnitForEntries } from "@frs/shared";

export type ReportLineItemView = {
  id: string;
  finalQuantity: number;
  entryType?: string;
  beginSta: string | null;
  endSta: string | null;
  locationDescription: string | null;
  symbolItemType: string | null;
  lineTypeCode?: string | null;
  lineTypeLabel?: string | null;
  taskMaster: { code: string; name: string; unit: string };
};

type LineItemGroup = {
  code: string;
  name: string;
  unit: string;
  totalQty: number;
  items: ReportLineItemView[];
};

function formatLineItemDetail(li: ReportLineItemView): string {
  const parts: string[] = [];
  const lineType =
    li.lineTypeLabel?.trim() || resolveLineTypeLabel(li.lineTypeCode);
  if (lineType) parts.push(lineType);
  if (li.beginSta && li.endSta) {
    parts.push(`${li.beginSta} → ${li.endSta}`);
  }
  if (li.locationDescription) parts.push(li.locationDescription);
  if (li.symbolItemType) parts.push(li.symbolItemType);
  return parts.join(" · ");
}

function groupLineItemsByTask(
  lineItems: ReportLineItemView[],
): LineItemGroup[] {
  const order: string[] = [];
  const map = new Map<string, ReportLineItemView[]>();

  for (const li of lineItems) {
    const key = li.taskMaster.code;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(li);
  }

  return order.map((code) => {
    const items = map.get(code)!;
    const first = items[0]!;
    return {
      code,
      name: first.taskMaster.name,
      unit: staBillingUnitForEntries(first.taskMaster.unit, items),
      totalQty: items.reduce((sum, li) => sum + li.finalQuantity, 0),
      items,
    };
  });
}

type GroupedReportLineItemsProps = {
  lineItems: ReportLineItemView[];
  className?: string;
};

export function GroupedReportLineItems({
  lineItems,
  className,
}: GroupedReportLineItemsProps) {
  const groups = groupLineItemsByTask(lineItems);

  return (
    <ul className={className ?? "space-y-1.5"}>
      {groups.map((group) => {
        const single = group.items.length === 1 ? group.items[0]! : null;
        const singleDetail = single ? formatLineItemDetail(single) : "";

        return (
          <li
            key={group.code}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] text-muted-foreground">
                  {group.code}
                </p>
                <p className="font-medium leading-snug">{group.name}</p>
              </div>
              <p className="shrink-0 tabular-nums font-semibold">
                {group.totalQty.toLocaleString()} {group.unit}
              </p>
            </div>

            {single ? (
              singleDetail ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {singleDetail}
                </p>
              ) : null
            ) : (
              <ul className="mt-1.5 space-y-1 border-t border-border/60 pt-1.5">
                {group.items.map((li) => {
                  const detail = formatLineItemDetail(li);
                  return (
                    <li
                      key={li.id}
                      className="flex items-start justify-between gap-2 text-[11px] text-muted-foreground"
                    >
                      <span className="min-w-0">{detail || "Entry"}</span>
                      <span className="shrink-0 tabular-nums font-medium text-foreground">
                        {li.finalQuantity.toLocaleString()} {group.unit}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
