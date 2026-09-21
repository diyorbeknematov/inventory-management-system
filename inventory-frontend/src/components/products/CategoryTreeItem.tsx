import {
  useState,
} from "react";

import {
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import type {
  Category,
} from "../../types/products";

export default function CategoryTreeItem({
  category,
  activeCategoryId,
  onSelect,
  level = 0,
}: {
  category: Category;
  activeCategoryId: string | null;
  onSelect: (id: string) => void;
  level?: number;
}) {
  const [expanded, setExpanded] =
    useState(false);

  const subcategories =
    category.subcategories ?? [];

  const hasChildren =
    subcategories.length > 0;

  const isActive =
    activeCategoryId ===
    category.guid;

  return (
    <div>
      <div
        className="flex items-center"
        style={{
          paddingLeft:
            `${level * 16}px`,
        }}
      >
        {hasChildren ? (
          <button
            onClick={() =>
              setExpanded(
                (prev) => !prev
              )
            }
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            {expanded ? (
              <ChevronDown size={15} />
            ) : (
              <ChevronRight size={15} />
            )}
          </button>
        ) : (
          <div className="w-7 shrink-0" />
        )}

        <button
          onClick={() =>
            onSelect(category.guid)
          }
          className={`min-w-0 flex-1 truncate rounded-lg px-2 py-2 text-left text-sm transition ${
            isActive
              ? "bg-zinc-900 font-medium text-white"
              : "text-zinc-700 hover:bg-zinc-100"
          }`}
        >
          {category.name}
        </button>
      </div>

      {hasChildren &&
        expanded && (
          <div>
            {subcategories.map(
              (subcategory) => (
                <CategoryTreeItem
                  key={
                    subcategory.guid
                  }
                  category={
                    subcategory
                  }
                  activeCategoryId={
                    activeCategoryId
                  }
                  onSelect={
                    onSelect
                  }
                  level={
                    level + 1
                  }
                />
              )
            )}
          </div>
        )}
    </div>
  );
}