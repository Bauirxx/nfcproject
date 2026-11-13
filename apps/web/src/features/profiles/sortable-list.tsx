import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';

export interface SortableListLabels {
  dragHandle: string;
  moveUp: string;
  moveDown: string;
}

interface SortableRowProps {
  id: string;
  index: number;
  count: number;
  labels: SortableListLabels;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}

function SortableRow({ id, index, count, labels, onMove, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  // Estilos inline (transform/transition): aplicados pelo React via CSSOM, compatíveis com a CSP estrita.
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn('flex items-start gap-2 rounded-md border bg-card p-3', isDragging && 'relative z-10 opacity-70 shadow-lg')}
    >
      <button
        type="button"
        aria-label={labels.dragHandle}
        className="mt-1 shrink-0 cursor-grab touch-none rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-5" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 flex-col gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={labels.moveUp}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={labels.moveDown}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ChevronDown aria-hidden="true" />
        </Button>
      </div>
    </li>
  );
}

export interface SortableListProps {
  /** Identificadores estáveis, pela ordem atual. */
  ids: string[];
  onMove: (from: number, to: number) => void;
  labels: SortableListLabels;
  renderItem: (id: string, index: number) => ReactNode;
}

/**
 * Lista reordenável por arrastar (dnd-kit) e por botões cima/baixo.
 * Os botões garantem uma alternativa sem arrastar a um único ponteiro e por teclado (WCAG 2.5.7).
 */
export function SortableList({ ids, onMove, labels, renderItem }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onMove(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2">
          {ids.map((id, index) => (
            <SortableRow key={id} id={id} index={index} count={ids.length} labels={labels} onMove={onMove}>
              {renderItem(id, index)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
