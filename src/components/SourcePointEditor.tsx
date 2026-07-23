import { useMemo, useRef, useState } from 'react';
import type { Point } from '../core/types';

interface SourcePointEditorProps {
  points: Point[];
  closed: boolean;
  onMoveToPoint: (index: number) => void;
  onReplacePoints: (points: Point[], message: string) => void;
  onAnnounce: (message: string) => void;
}

function boundedIndex(value: number, count: number): number {
  return Math.min(Math.max(0, Math.round(value)), Math.max(0, count - 1));
}

export function SourcePointEditor({
  points,
  closed,
  onMoveToPoint,
  onReplacePoints,
  onAnnounce,
}: SourcePointEditorProps) {
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [jumpPoint, setJumpPoint] = useState(1);
  const [editIndex, setEditIndex] = useState(0);
  const [editX, setEditX] = useState(points[0]?.x ?? 0);
  const [editY, setEditY] = useState(points[0]?.y ?? 0);
  const [newX, setNewX] = useState(0);
  const [newY, setNewY] = useState(0);
  const editNumberRef = useRef<HTMLInputElement>(null);
  const editXRef = useRef<HTMLInputElement>(null);

  const pageCount = Math.max(1, Math.ceil(points.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visiblePoints = useMemo(
    () =>
      points
        .slice(safePage * pageSize, safePage * pageSize + pageSize)
        .map((point, offset) => ({
          point,
          index: safePage * pageSize + offset,
        })),
    [pageSize, points, safePage],
  );

  function selectForEditing(index: number): void {
    const safeIndex = boundedIndex(index, points.length);
    const point = points[safeIndex];
    if (!point) return;
    setEditIndex(safeIndex);
    setEditX(point.x);
    setEditY(point.y);
    window.setTimeout(() => editXRef.current?.focus(), 0);
  }

  function replaceEditedPoint(): void {
    if (!Number.isFinite(editX) || !Number.isFinite(editY)) return;
    const next = points.map((point, index) =>
      index === editIndex ? { x: editX, y: editY } : point,
    );
    onReplacePoints(next, `Point ${editIndex + 1} updated.`);
  }

  function moveEditedPoint(direction: -1 | 1): void {
    const target = editIndex + direction;
    if (target < 0 || target >= points.length) return;
    const next = [...points];
    [next[editIndex], next[target]] = [next[target]!, next[editIndex]!];
    setEditIndex(target);
    onReplacePoints(
      next,
      `Point ${editIndex + 1} moved ${direction < 0 ? 'earlier' : 'later'} to position ${target + 1}.`,
    );
  }

  function duplicateEditedPoint(): void {
    const point = points[editIndex];
    if (!point) return;
    const next = [...points];
    next.splice(editIndex + 1, 0, { ...point });
    setEditIndex(editIndex + 1);
    onReplacePoints(next, `Point ${editIndex + 1} duplicated.`);
  }

  function deleteEditedPoint(): void {
    if (points.length <= 2) return;
    const next = points.filter((_, index) => index !== editIndex);
    const nextIndex = Math.min(editIndex, next.length - 1);
    setEditIndex(nextIndex);
    const nextPoint = next[nextIndex];
    if (nextPoint) {
      setEditX(nextPoint.x);
      setEditY(nextPoint.y);
    }
    onReplacePoints(next, `Point ${editIndex + 1} deleted.`);
    window.setTimeout(() => editNumberRef.current?.focus(), 0);
  }

  function addPoint(): void {
    if (!Number.isFinite(newX) || !Number.isFinite(newY)) return;
    onReplacePoints(
      [...points, { x: newX, y: newY }],
      `Point ${points.length + 1} added to the end of the curve.`,
    );
    setEditIndex(points.length);
    setEditX(newX);
    setEditY(newY);
  }

  function changePage(next: number): void {
    const bounded = Math.min(Math.max(0, next), pageCount - 1);
    setPage(bounded);
    onAnnounce(`Source-point table page ${bounded + 1} of ${pageCount}.`);
  }

  function jumpToPoint(): void {
    const index = boundedIndex(jumpPoint - 1, points.length);
    setPage(Math.floor(index / pageSize));
    setJumpPoint(index + 1);
    onAnnounce(`Showing source point ${index + 1}.`);
  }

  return (
    <details className="point-editor">
      <summary>Inspect and edit source points</summary>
      <div className="details-content">
        <p>
          The table keeps the supplied point order. Editing, deleting and
          reordering use native controls and stop audio.
        </p>
        <div className="table-toolbar">
          <label htmlFor="point-page-size">Points per page</label>
          <select
            id="point-page-size"
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.currentTarget.value));
              setPage(0);
            }}
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
          </select>
          <label htmlFor="jump-point">Jump to point number</label>
          <input
            id="jump-point"
            type="number"
            min="1"
            max={points.length}
            step="1"
            value={jumpPoint}
            onChange={(event) =>
              setJumpPoint(event.currentTarget.valueAsNumber || 1)
            }
          />
          <button type="button" onClick={jumpToPoint}>
            Show point
          </button>
        </div>
        <div
          className="table-scroll"
          tabIndex={0}
          aria-label="Scrollable source-point table"
        >
          <table>
            <caption>
              Ordered source points, page {safePage + 1} of {pageCount}
            </caption>
            <thead>
              <tr>
                <th scope="col">Point</th>
                <th scope="col">X</th>
                <th scope="col">Y</th>
                <th scope="col">Segment</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visiblePoints.map(({ point, index }) => (
                <tr key={`${index}-${point.x}-${point.y}`}>
                  <th scope="row">{index + 1}</th>
                  <td>{point.x.toPrecision(7)}</td>
                  <td>{point.y.toPrecision(7)}</td>
                  <td>
                    {index < points.length - 1
                      ? `${index + 1} to ${index + 2}`
                      : closed
                        ? `${index + 1} to 1 (closing)`
                        : 'Final point'}
                  </td>
                  <td>
                    <div className="button-row table-actions">
                      <button
                        type="button"
                        onClick={() => onMoveToPoint(index)}
                      >
                        Move to point {index + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => selectForEditing(index)}
                      >
                        Edit point {index + 1}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="pagination button-row">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => changePage(safePage - 1)}
          >
            Previous page
          </button>
          <span>
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage === pageCount - 1}
            onClick={() => changePage(safePage + 1)}
          >
            Next page
          </button>
        </div>

        <fieldset className="point-form">
          <legend>Edit one point</legend>
          <div className="field-grid">
            <label htmlFor="edit-point-number">Point number</label>
            <input
              ref={editNumberRef}
              id="edit-point-number"
              type="number"
              min="1"
              max={points.length}
              step="1"
              value={editIndex + 1}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value))
                  selectForEditing(boundedIndex(value - 1, points.length));
              }}
            />
            <label htmlFor="edit-point-x">
              X value for point {editIndex + 1}
            </label>
            <input
              ref={editXRef}
              id="edit-point-x"
              type="number"
              step="any"
              value={editX}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value)) setEditX(value);
              }}
            />
            <label htmlFor="edit-point-y">
              Y value for point {editIndex + 1}
            </label>
            <input
              id="edit-point-y"
              type="number"
              step="any"
              value={editY}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value)) setEditY(value);
              }}
            />
          </div>
          <div className="button-row point-actions">
            <button type="button" onClick={replaceEditedPoint}>
              Update point {editIndex + 1}
            </button>
            <button
              type="button"
              disabled={editIndex === 0}
              onClick={() => moveEditedPoint(-1)}
            >
              Move point {editIndex + 1} earlier
            </button>
            <button
              type="button"
              disabled={editIndex === points.length - 1}
              onClick={() => moveEditedPoint(1)}
            >
              Move point {editIndex + 1} later
            </button>
            <button type="button" onClick={duplicateEditedPoint}>
              Duplicate point {editIndex + 1}
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={points.length <= 2}
              onClick={deleteEditedPoint}
            >
              Delete point {editIndex + 1}
            </button>
          </div>
          {points.length <= 2 && (
            <p className="fine-print">
              Delete is unavailable because a curve needs at least two points.
            </p>
          )}
        </fieldset>

        <fieldset className="point-form">
          <legend>Add a point to the end</legend>
          <div className="field-grid">
            <label htmlFor="new-point-x">New point X value</label>
            <input
              id="new-point-x"
              type="number"
              step="any"
              value={newX}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value)) setNewX(value);
              }}
            />
            <label htmlFor="new-point-y">New point Y value</label>
            <input
              id="new-point-y"
              type="number"
              step="any"
              value={newY}
              onChange={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value)) setNewY(value);
              }}
            />
          </div>
          <button type="button" onClick={addPoint}>
            Add point
          </button>
        </fieldset>
      </div>
    </details>
  );
}
