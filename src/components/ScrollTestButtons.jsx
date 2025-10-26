import { useScrollTo } from '../hooks/useScrollTo';

function ScrollTestButtons() {
    const { scrollToElement, scrollToTop, scrollToBottom } = useScrollTo();

    return (
        <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded shadow-lg border">
            <h3 className="text-sm font-semibold mb-3">Test Scroll</h3>

            {/* Source Panel Controls */}
            <div className="mb-4">
                <p className="text-xs font-medium mb-2">Source Panel:</p>
                <div className="space-y-1">
                    <button
                        onClick={() => scrollToTop('source-panel-container')}
                        className="block w-full text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                    >
                        Top
                    </button>
                    <button
                        onClick={() => scrollToElement('source-bottom', 'source-panel-container')}
                        className="block w-full text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                    >
                        Bottom
                    </button>
                </div>
            </div>

            {/* Chat Controls */}
            <div className="mb-4">
                <p className="text-xs font-medium mb-2">Chat:</p>
                <div className="space-y-1">
                    <button
                        onClick={() => scrollToTop('chat-container')}
                        className="block w-full text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                    >
                        Top
                    </button>
                    <button
                        onClick={() => scrollToElement('chat-bottom', 'chat-container')}
                        className="block w-full text-xs px-2 py-1 bg-green-100 text-green-700 rounded"
                    >
                        Bottom
                    </button>
                </div>
            </div>

            {/* Studio Dashboard Controls */}
            <div>
                <p className="text-xs font-medium mb-2">Studio:</p>
                <div className="space-y-1">
                    <button
                        onClick={() => scrollToTop('studio-dashboard-container')}
                        className="block w-full text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded"
                    >
                        Top
                    </button>
                    <button
                        onClick={() => scrollToElement('studio-bottom', 'studio-dashboard-container')}
                        className="block w-full text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded"
                    >
                        Bottom
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ScrollTestButtons;