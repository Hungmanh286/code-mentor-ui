import { scroller } from 'react-scroll';

export const useScrollTo = () => {
    const scrollToElement = (elementName, containerId, options = {}) => {
        scroller.scrollTo(elementName, {
            duration: 800,
            delay: 0,
            smooth: true,
            containerId: containerId,
            offset: 0,
            ...options
        });
    };

    const scrollToTop = (containerId, options = {}) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.scrollTo({
                top: 0,
                behavior: 'smooth',
                ...options
            });
        }
    };

    const scrollToBottom = (containerId, options = {}) => {
        const container = document.getElementById(containerId);
        if (container) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth',
                ...options
            });
        }
    };

    return {
        scrollToElement,
        scrollToTop,
        scrollToBottom
    };
};