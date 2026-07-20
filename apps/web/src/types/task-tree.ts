export type TaskNode = {
  id: string;
  code: string;
  name: string;
  unit: string;
  formType: string;
  division: string | null;
  parentId: string | null;
  sortOrder: number;
  color?: string | null;
  widthInches?: number | null;
  conversionFactor?: number | null;
  children: Omit<TaskNode, "children">[];
};
