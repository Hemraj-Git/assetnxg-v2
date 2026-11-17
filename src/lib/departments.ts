// Departments as a tree (owner, 17-11-2026): each sits under at most one
// parent; the database refuses loops. These helpers order and label it for
// screens. Pure, so they're unit-tested.

export type DepartmentNode = {
  id: string;
  name: string;
  parentId: string | null;
};

export type TreeRow<T extends DepartmentNode> = T & {
  depth: number;
  /** "Academics › Marine Engineering", for pickers. */
  path: string;
};

const byName = (a: DepartmentNode, b: DepartmentNode) =>
  a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** Depth-first order, siblings by name. A department whose parent is missing
 *  (not visible) is shown at the top level rather than lost. */
export function departmentTree<T extends DepartmentNode>(rows: readonly T[]): TreeRow<T>[] {
  const ids = new Set(rows.map((r) => r.id));
  const children = new Map<string | null, T[]>();
  for (const r of rows) {
    const key = r.parentId && ids.has(r.parentId) ? r.parentId : null;
    const list = children.get(key) ?? [];
    list.push(r);
    children.set(key, list);
  }

  const out: TreeRow<T>[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, trail: string[]) => {
    for (const r of [...(children.get(parent) ?? [])].sort(byName)) {
      if (seen.has(r.id)) continue; // defensive: never loop on bad data
      seen.add(r.id);
      const path = [...trail, r.name];
      out.push({ ...r, depth, path: path.join(" › ") });
      walk(r.id, depth + 1, path);
    }
  };
  walk(null, 0, []);
  return out;
}

/** The department and every department under it (for "Sits under" choices:
 *  none of these may become its parent). */
export function selfAndDescendants(rows: readonly DepartmentNode[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const r of rows) {
      if (r.parentId && out.has(r.parentId) && !out.has(r.id)) {
        out.add(r.id);
        grew = true;
      }
    }
  }
  return out;
}

/** Departments that can be the parent of `id` (all, when adding a new one). */
export function parentChoices<T extends DepartmentNode>(rows: readonly T[], id: string | null): TreeRow<T>[] {
  const blocked = id ? selfAndDescendants(rows, id) : new Set<string>();
  return departmentTree(rows).filter((r) => !blocked.has(r.id));
}
