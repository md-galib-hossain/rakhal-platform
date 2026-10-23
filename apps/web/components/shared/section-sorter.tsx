"use client"; // dnd-kit sensors + pointer/keyboard handlers for reordering page sections

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronDown, ChevronUp, GripVertical, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Sections differ a lot in height, so the pointer position decides the target; closest-center is the fallback
// for when the pointer is in a gap between sections.
const collisionDetection: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length > 0 ? hits : closestCenter(args);
};

export interface SortableSection {
  id: string;
  label: string;
}

/**
 * Where a sticky layout-edit toolbar pins: below the app top bar (`Topbar` is `sticky top-2.5 h-16`,
 * so 0.625 + 4 + 0.625rem), under it in z-order (topbar is z-30).
 */
export const LAYOUT_TOOLBAR_STICKY = "sticky top-[5.25rem] z-20";

/** Reset / Cancel / Save, rendered by the page in its own toolbar row in place of "Customize Layout". */
export function LayoutEditControls({
  onReset,
  onCancel,
  onSave,
}: {
  onReset: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onReset}
        className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
        title="Reset to the default order"
      >
        <RotateCcw className="mr-1 size-3.5" aria-hidden />
        Reset
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onCancel} className="h-9 px-3">
        <X className="mr-1 size-3.5" aria-hidden />
        Cancel
      </Button>
      <Button type="button" size="sm" onClick={onSave} className="h-9 px-3 font-medium">
        <Check className="mr-1 size-4" aria-hidden />
        Save layout
      </Button>
    </div>
  );
}

function SortableItem({
  section,
  index,
  count,
  onMove,
  children,
}: {
  section: SortableSection;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative rounded-2xl motion-reduce:!transition-none",
        isDragging && "z-30 opacity-95 shadow-2xl ring-2 ring-primary/70",
      )}
    >
      {/* Floating tab on the section's top edge: content keeps its exact position and size. */}
      <div className="absolute -top-4 left-4 z-10 flex h-8 items-center gap-1 rounded-full border border-border bg-card pl-1 pr-1.5 shadow-md">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${section.label}. Press space to lift, arrow keys to move, space to drop.`}
          className={cn(
            "flex size-6 touch-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary",
            isDragging ? "cursor-grabbing" : "cursor-grab",
          )}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className="max-w-[40vw] truncate text-xs font-medium text-foreground sm:max-w-xs">
          {index + 1}. {section.label}
        </span>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronUp className="size-4" aria-hidden />
          <span className="sr-only">Move {section.label} up</span>
        </button>
        <button
          type="button"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronDown className="size-4" aria-hidden />
          <span className="sr-only">Move {section.label} down</span>
        </button>
      </div>
      <div className="pointer-events-none w-full select-none" aria-hidden>
        {children}
      </div>
    </li>
  );
}

interface SectionSorterProps {
  sections: readonly SortableSection[];
  /** Draft order (section ids), owned by the page; saved by the page's toolbar. */
  order: readonly string[];
  onChange: (order: string[]) => void;
  /** The real section UI, shown (non-interactive) under each handle tab. */
  renderSection: (id: string) => React.ReactNode;
}

/**
 * Reorder mode for a page: the real sections stay exactly where they are (non-interactive),
 * each with a small handle tab on its top edge, so the user arranges the actual layout.
 * dnd-kit provides pointer, touch and keyboard sensors, window auto-scroll and screen-reader
 * announcements. The page owns the draft and the Save / Cancel controls (`LayoutEditControls`),
 * so a stray drag or Cancel never touches the saved layout.
 */
export function SectionSorter({ sections, order, onChange, renderSection }: SectionSorterProps) {
  const byId = new Map(sections.map((s) => [s.id, s]));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onChange(arrayMove([...order], from, to));
  }

  function move(id: string, delta: -1 | 1) {
    const from = order.indexOf(id);
    const to = from + delta;
    if (from >= 0 && to >= 0 && to < order.length) onChange(arrayMove([...order], from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={[...order]} strategy={verticalListSortingStrategy}>
        <ul className="m-0 flex list-none flex-col gap-5 p-0">
          {order.map((id, index) => {
            const section = byId.get(id);
            return section ? (
              <SortableItem
                key={id}
                section={section}
                index={index}
                count={order.length}
                onMove={(delta) => move(id, delta)}
              >
                {renderSection(id)}
              </SortableItem>
            ) : null;
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
