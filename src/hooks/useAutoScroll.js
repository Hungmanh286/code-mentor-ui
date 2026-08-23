import { useEffect, useLayoutEffect, useRef } from 'react';

const NEAR_BOTTOM = 80;

/**
 * Giữ khung chat luôn ở đáy khi có nội dung mới — trừ khi người dùng đã tự
 * cuộn lên để đọc lại, lúc đó không giật họ về nữa.
 *
 * Bản cũ thao tác trên document.documentElement trong khi phần cuộn thật là
 * một div lồng bên trong, nên trên thực tế không bao giờ cuộn: đo được
 * scrollTop = 0 với scrollHeight 2074px.
 *
 * @param {...any} deps Đổi giá trị nào thì kiểm tra lại vị trí cuộn.
 * @returns ref để gắn vào chính phần tử có overflow-y: auto.
 */
function useAutoScroll(...deps) {
  const containerRef = useRef(null);
  const pinnedRef = useRef(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
      pinnedRef.current = distance <= NEAR_BOTTOM;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Nội dung stream về từng mẩu nên chiều cao đổi liên tục mà không phải lúc
  // nào cũng đi kèm một lần render của React — theo dõi bằng ResizeObserver.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight;
    });
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el && pinnedRef.current) el.scrollTop = el.scrollHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return containerRef;
}

export default useAutoScroll;
