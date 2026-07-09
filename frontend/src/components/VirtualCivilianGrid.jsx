import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';

const MIN_CARD_WIDTH = 310;
const GRID_GAP_PX = 18;
const ROW_ESTIMATE_PX = 292;

function getColumnCount(width) {
  if (width < 768) return 1;
  return Math.max(1, Math.floor((width + GRID_GAP_PX) / (MIN_CARD_WIDTH + GRID_GAP_PX)));
}

export default function VirtualCivilianGrid({ records, renderCard }) {
  const parentRef = useRef(null);
  const [layout, setLayout] = useState({ scrollMargin: 0, columnCount: 1 });

  useLayoutEffect(() => {
    const node = parentRef.current;
    if (!node) return undefined;

    const update = () => {
      setLayout({
        scrollMargin: node.offsetTop,
        columnCount: getColumnCount(node.offsetWidth),
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [records.length]);

  const rowCount = useMemo(
    () => Math.ceil(records.length / layout.columnCount),
    [records.length, layout.columnCount],
  );

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 4,
    scrollMargin: layout.scrollMargin,
  });

  return (
    <div ref={parentRef} className="civilian-grid-virtual">
      <div
        className="civilian-grid-virtual-spacer"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const start = virtualRow.index * layout.columnCount;
          const rowRecords = records.slice(start, start + layout.columnCount);

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              className="civilian-grid civilian-grid-row"
              style={{
                '--civilian-cols': layout.columnCount,
                transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
              }}
            >
              {rowRecords.map(r => renderCard(r))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
