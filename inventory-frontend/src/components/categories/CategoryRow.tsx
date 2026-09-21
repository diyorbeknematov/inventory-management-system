import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

import type { Category } from "../../types/category";

export default function CategoryRow({
  category,
  parentName,
  onAddSubcategory,
  onEdit,
  onDelete,
}: {
  category: Category;
  parentName: string;
  onAddSubcategory: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  const [menuPosition, setMenuPosition] = useState({
    top: 0,
    right: 0,
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleMenuToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();

      const menuHeight = 130;
      const spaceBelow = window.innerHeight - rect.bottom;

      let top = rect.bottom + 4;

      if (spaceBelow < menuHeight) {
        top = rect.top - menuHeight - 4;
      }

      setMenuPosition({
        top,
        right: window.innerWidth - rect.right,
      });
    }

    setOpen((value) => !value);
  }

  return (
    <tr className="group transition-colors hover:bg-zinc-50/70">
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600">
            {category.name.charAt(0).toUpperCase()}
          </div>

          <span className="text-sm font-semibold text-zinc-900">
            {category.name}
          </span>
        </div>
      </td>

      <td className="px-4 py-3.5">
        {parentName === "Root" ? (
          <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-500">
            ROOT
          </span>
        ) : (
          <span className="inline-flex rounded-md bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {parentName}
          </span>
        )}
      </td>

      <td className="px-4 py-3.5">
        <span className="block max-w-lg truncate text-sm text-zinc-500">
          {category.description || "—"}
        </span>
      </td>

      <td className="px-4 py-3.5">
        <div className="flex justify-end">
          <button
            ref={buttonRef}
            type="button"
            title="Actions"
            onClick={handleMenuToggle}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <MoreVertical size={17} />
          </button>
        </div>

        {open &&
          createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100] w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
              style={{
                top: menuPosition.top,
                right: menuPosition.right,
              }}
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
              >
                <Pencil size={15} />
                Edit
              </button>

              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
                onClick={() => {
                  setOpen(false);
                  onAddSubcategory();
                }}
              >
                <Plus size={15} />
                Add Subcategory
              </button>

              <div className="my-1 border-t border-zinc-100" />

              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>,
            document.body
          )}
      </td>
    </tr>
  );
}