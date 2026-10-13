import { useEffect } from 'react';
import { useDragLayer } from 'react-dnd';

const findScroller = (target, delta) => {
  for (let element = target instanceof Element ? target : null; element; element = element.parentElement) {
    if (!/(auto|scroll)/.test(getComputedStyle(element).overflowY)) continue;
    if (delta > 0 && element.scrollTop + element.clientHeight < element.scrollHeight - 1) return element;
    if (delta < 0 && element.scrollTop > 0) return element;
  }
  return document.scrollingElement;
};

export default function useClassDragScroll() {
  const isDragging = useDragLayer((monitor) => monitor.isDragging());
  useEffect(() => {
    if (!isDragging) return;
    let pointer = null;
    let frame;
    let lastTime = 0;
    const onDragOver = (event) => { pointer = { x: event.clientX, y: event.clientY }; };
    const onWheel = (event) => {
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (!delta) return;
      const scroller = findScroller(event.target, delta);
      if (scroller) {
        event.preventDefault();
        scroller.scrollTop += delta;
      }
    };
    const tick = (time) => {
      const elapsed = Math.min(time - (lastTime || time), 32);
      lastTime = time;
      if (pointer && document.visibilityState === 'visible') {
        const target = document.elementFromPoint(pointer.x, pointer.y);
        let top = 0;
        let bottom = window.innerHeight;
        for (let element = target; element; element = element.parentElement) {
          if (/(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight) {
            const rect = element.getBoundingClientRect();
            top = Math.max(0, rect.top);
            bottom = Math.min(window.innerHeight, rect.bottom);
            break;
          }
        }
        const edge = Math.min(100, (bottom - top) / 3);
        const direction = pointer.y < top + edge ? -1 : pointer.y > bottom - edge ? 1 : 0;
        if (direction) {
          const distance = direction < 0 ? pointer.y - top : bottom - pointer.y;
          const speed = Math.max(0, Math.min(1, 1 - distance / edge));
          const scroller = findScroller(target, direction);
          if (scroller) scroller.scrollTop += direction * speed * elapsed * 0.9;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    document.addEventListener('dragover', onDragOver, true);
    document.addEventListener('wheel', onWheel, { capture: true, passive: false });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('dragover', onDragOver, true);
      document.removeEventListener('wheel', onWheel, true);
    };
  }, [isDragging]);
}
