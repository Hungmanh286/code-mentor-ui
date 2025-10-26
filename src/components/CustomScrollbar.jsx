import { useState, useEffect, useRef } from 'react';

function CustomScrollbar({ containerId, className = "" }) {
    const [scrollPercentage, setScrollPercentage] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const scrollbarRef = useRef(null);
    const thumbRef = useRef(null);

    useEffect(() => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const updateScrollPercentage = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const maxScroll = scrollHeight - clientHeight;
            const percentage = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
            setScrollPercentage(Math.min(100, Math.max(0, percentage)));
        };

        container.addEventListener('scroll', updateScrollPercentage);
        updateScrollPercentage(); // Initial calculation

        return () => {
            container.removeEventListener('scroll', updateScrollPercentage);
        };
    }, [containerId]);

    const handleScrollbarClick = (e) => {
        if (!scrollbarRef.current) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const rect = scrollbarRef.current.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const scrollbarHeight = rect.height;
        const percentage = (clickY / scrollbarHeight) * 100;

        const { scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        const targetScrollTop = (percentage / 100) * maxScroll;

        container.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
        });
    };

    const handleMouseDown = (e) => {
        setIsDragging(true);
        e.preventDefault();
    };

    const handleMouseMove = (e) => {
        if (!isDragging || !scrollbarRef.current) return;

        const container = document.getElementById(containerId);
        if (!container) return;

        const rect = scrollbarRef.current.getBoundingClientRect();
        const mouseY = e.clientY - rect.top;
        const scrollbarHeight = rect.height;
        const percentage = Math.min(100, Math.max(0, (mouseY / scrollbarHeight) * 100));

        const { scrollHeight, clientHeight } = container;
        const maxScroll = scrollHeight - clientHeight;
        const targetScrollTop = (percentage / 100) * maxScroll;

        container.scrollTop = targetScrollTop;
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            ref={scrollbarRef}
            className={`fixed right-0 top-0 bottom-0 w-3 bg-gray-100 cursor-pointer z-10 ${className}`}
            onClick={handleScrollbarClick}
        >
            {/* Scrollbar thumb */}
            <div
                ref={thumbRef}
                className={`absolute w-full bg-gray-400 rounded transition-colors duration-200 cursor-grab active:cursor-grabbing ${isDragging ? 'bg-gray-600' : 'hover:bg-gray-500'
                    }`}
                style={{
                    height: '20%',
                    top: `${scrollPercentage * 0.8}%`, // 0.8 because thumb height is 20%
                }}
                onMouseDown={handleMouseDown}
            />
        </div>
    );
}

export default CustomScrollbar;