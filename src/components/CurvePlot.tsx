import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { coordinateDomain } from '../core/geometry';
import type { Point } from '../core/types';

export interface CurvePlotHandle {
  setCurrentPoint: (point: Point) => void;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface CurvePlotProps {
  points: Point[];
  currentPoint: Point;
  closed: boolean;
  reverse: boolean;
  equalScale: boolean;
  drawing: boolean;
  drawingPoints: Point[];
  onDrawPoint: (point: Point) => void;
}

const WIDTH = 720;
const HEIGHT = 480;
const MARGIN = 46;

function paddedBounds(points: Point[], equalScale: boolean): Bounds {
  const x = coordinateDomain(points, 'x');
  const y = coordinateDomain(points, 'y');
  let xSpan = Math.max(x.maximum - x.minimum, 0.2);
  let ySpan = Math.max(y.maximum - y.minimum, 0.2);
  if (equalScale) {
    const unitPerPixel = Math.max(
      xSpan / (WIDTH - MARGIN * 2),
      ySpan / (HEIGHT - MARGIN * 2),
    );
    xSpan = unitPerPixel * (WIDTH - MARGIN * 2);
    ySpan = unitPerPixel * (HEIGHT - MARGIN * 2);
  }
  const xCentre = (x.minimum + x.maximum) / 2;
  const yCentre = (y.minimum + y.maximum) / 2;
  return {
    minX: xCentre - xSpan * 0.58,
    maxX: xCentre + xSpan * 0.58,
    minY: yCentre - ySpan * 0.58,
    maxY: yCentre + ySpan * 0.58,
  };
}

function pathData(
  points: Point[],
  closed: boolean,
  toSvg: (point: Point) => Point,
): string {
  if (points.length === 0) return '';
  const commands = points.map((point, index) => {
    const svg = toSvg(point);
    return `${index === 0 ? 'M' : 'L'} ${svg.x.toFixed(2)} ${svg.y.toFixed(2)}`;
  });
  if (closed) commands.push('Z');
  return commands.join(' ');
}

export const CurvePlot = forwardRef<CurvePlotHandle, CurvePlotProps>(
  function CurvePlot(
    {
      points,
      currentPoint,
      closed,
      reverse,
      equalScale,
      drawing,
      drawingPoints,
      onDrawPoint,
    },
    ref,
  ) {
    const markerRef = useRef<SVGCircleElement>(null);
    const activePoints = drawing ? drawingPoints : points;
    const bounds = useMemo(
      () =>
        drawing
          ? { minX: -1, maxX: 1, minY: -1, maxY: 1 }
          : paddedBounds(points, equalScale),
      [drawing, equalScale, points],
    );
    const toSvg = (point: Point): Point => ({
      x:
        MARGIN +
        ((point.x - bounds.minX) / (bounds.maxX - bounds.minX)) *
          (WIDTH - MARGIN * 2),
      y:
        HEIGHT -
        MARGIN -
        ((point.y - bounds.minY) / (bounds.maxY - bounds.minY)) *
          (HEIGHT - MARGIN * 2),
    });
    const fromSvg = (point: Point): Point => ({
      x:
        bounds.minX +
        ((point.x - MARGIN) / (WIDTH - MARGIN * 2)) *
          (bounds.maxX - bounds.minX),
      y:
        bounds.minY +
        ((HEIGHT - MARGIN - point.y) / (HEIGHT - MARGIN * 2)) *
          (bounds.maxY - bounds.minY),
    });
    const curvePath = useMemo(
      () => pathData(activePoints, drawing ? false : closed, toSvg),
      // toSvg is deliberately represented by its primitive bounds dependencies.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        activePoints,
        bounds.minX,
        bounds.maxX,
        bounds.minY,
        bounds.maxY,
        closed,
        drawing,
      ],
    );
    const start = toSvg(points[0] ?? { x: 0, y: 0 });
    const initial = toSvg(currentPoint);
    const xAxis =
      bounds.minY <= 0 && bounds.maxY >= 0
        ? toSvg({ x: 0, y: 0 }).y
        : HEIGHT - MARGIN;
    const yAxis =
      bounds.minX <= 0 && bounds.maxX >= 0 ? toSvg({ x: 0, y: 0 }).x : MARGIN;

    useImperativeHandle(
      ref,
      () => ({
        setCurrentPoint(point: Point) {
          const svg = toSvg(point);
          markerRef.current?.setAttribute('cx', svg.x.toFixed(2));
          markerRef.current?.setAttribute('cy', svg.y.toFixed(2));
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [bounds.minX, bounds.maxX, bounds.minY, bounds.maxY],
    );

    function pointerPoint(event: React.PointerEvent<SVGSVGElement>): void {
      if (!drawing) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const svgPoint = {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
      onDrawPoint(fromSvg(svgPoint));
    }

    return (
      <div className="plot-shell">
        <svg
          className={drawing ? 'curve-plot is-drawing' : 'curve-plot'}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          tabIndex={0}
          aria-describedby="plot-instructions"
          onPointerDown={(event) => {
            if (!drawing) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointerPoint(event);
          }}
          onPointerMove={(event) => {
            if (
              drawing &&
              event.currentTarget.hasPointerCapture(event.pointerId)
            )
              pointerPoint(event);
          }}
          onPointerUp={(event) => {
            if (
              drawing &&
              event.currentTarget.hasPointerCapture(event.pointerId)
            ) {
              pointerPoint(event);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        >
          <title>Ordered two-dimensional curve</title>
          <desc>
            The plot shows the curve, its start point and the current listening
            point. The numeric readout follows it.
          </desc>
          <defs aria-hidden="true">
            <pattern
              id="minor-grid"
              width="72"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 72 0 L 0 0 0 48" className="grid-line" fill="none" />
            </pattern>
          </defs>
          <rect
            x={MARGIN}
            y={MARGIN}
            width={WIDTH - MARGIN * 2}
            height={HEIGHT - MARGIN * 2}
            className="plot-bg"
          />
          <rect
            x={MARGIN}
            y={MARGIN}
            width={WIDTH - MARGIN * 2}
            height={HEIGHT - MARGIN * 2}
            fill="url(#minor-grid)"
            aria-hidden="true"
          />
          <line
            x1={MARGIN}
            x2={WIDTH - MARGIN}
            y1={xAxis}
            y2={xAxis}
            className="axis-line"
            aria-hidden="true"
          />
          <line
            y1={MARGIN}
            y2={HEIGHT - MARGIN}
            x1={yAxis}
            x2={yAxis}
            className="axis-line"
            aria-hidden="true"
          />
          <text x={WIDTH - MARGIN + 10} y={xAxis + 5} className="axis-label">
            x
          </text>
          <text x={yAxis + 8} y={MARGIN - 12} className="axis-label">
            y
          </text>
          <path d={curvePath} className="curve-line" aria-hidden="true" />
          {!drawing && (
            <>
              <rect
                x={start.x - 6}
                y={start.y - 6}
                width="12"
                height="12"
                className="start-marker"
                aria-hidden="true"
              />
              <circle
                ref={markerRef}
                cx={initial.x}
                cy={initial.y}
                r="9"
                className="current-marker"
                aria-hidden="true"
              />
            </>
          )}
        </svg>
        <p id="plot-instructions" className="plot-caption">
          {drawing
            ? 'Drawing domain: x −1 to 1 and y −1 to 1. Draw with a pointer, pen or touch. Coordinates can also be entered as text or loaded from a file.'
            : `The square is the start point. The outlined circle is the listening point. Direction: ${reverse ? 'reverse' : 'forward'}.`}
        </p>
      </div>
    );
  },
);
