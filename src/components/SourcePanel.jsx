import React, { useState, useEffect } from "react";
import "../assets/css/SourcePanel.css";

const SourcePanel = ({ onCollapsedChange, sessionUUID }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [sources, setSources] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState('');
    const [file, setFile] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [loadingContent, setLoadingContent] = useState(false);

    // Thông báo lên App khi trạng thái thu gọn thay đổi
    useEffect(() => {
        if (onCollapsedChange) {
            onCollapsedChange(collapsed);
        }
    }, [collapsed, onCollapsedChange]);

    const toggleAll = (e) => {
        const checked = e.target.checked;
        setSources(sources.map((s) => ({ ...s, checked })));
    };

    const toggleItem = (index) => {
        setSources(
            sources.map((s, i) => (i === index ? { ...s, checked: !s.checked } : s))
        );
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setUploadResult('');
    };

    const handleUpload = async () => {
        if (!file || !sessionUUID) return;
        setUploading(true);
        setUploadResult('');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', sessionUUID);

        try {
            console.log("Uploading file with session:", sessionUUID);
            const res = await fetch('http://0.0.0.0:8686/upload', {
                method: 'POST',
                body: formData,
            });
            console.log("Upload response status:", res.status);
            const data = await res.json();
            console.log("Upload response:", data);
            if (data.file_path) {
                setSources([...sources, { name: file.name, checked: true }]);
                setUploadResult('Tải lên thành công!');
            } else {
                setUploadResult('Lỗi: ' + (data.error || 'Không xác định'));
            }
        } catch (err) {
            console.error("Upload error:", err);
            setUploadResult('Lỗi kết nối!');
        } finally {
            setUploading(false);
            setFile(null);
        }
    };

    const [fileImages, setFileImages] = useState([]);

    const handleViewFile = async (filename) => {
        if (selectedFile === filename) {
            // Toggle off if clicking the same file again
            setSelectedFile(null);
            setFileContent('');
            setFileImages([]);
            return;
        }

        setSelectedFile(filename);
        setLoadingContent(true);
        setFileImages([]);
        setFileContent('');

        try {
            console.log(`Fetching content for file: ${filename}, session: ${sessionUUID}`);
            const res = await fetch(`http://0.0.0.0:8686/view-file?session_id=${sessionUUID}`);
            console.log("Response status:", res.status);
            console.log("Content type:", res.headers.get('content-type'));

            if (res.ok) {
                try {
                    const data = await res.json();
                    console.log("Response data:", Object.keys(data));

                    if (data.images_base64) {
                        // Hiển thị nhiều trang PDF dưới dạng ảnh
                        setFileImages(data.images_base64);
                        console.log("Received multiple images, pages:", data.images_base64.length);
                    } else if (data.image_base64) {
                        // Hiển thị dưới dạng ảnh (một trang)
                        setFileImages([data.image_base64]);
                        console.log("Received single image base64 data");
                    } else if (data.content) {
                        // Hiển thị dưới dạng text
                        setFileContent(data.content);
                    } else if (data.error) {
                        setFileContent(`Lỗi: ${data.error}`);
                    } else {
                        setFileContent('Không thể hiển thị nội dung file');
                    }
                } catch (parseError) {
                    console.error("Error parsing response:", parseError);
                    // Nếu parse JSON lỗi, thử đọc như text
                    const text = await res.text();
                    setFileContent(text || 'Không thể hiển thị nội dung file');
                }
            } else {
                setFileContent('Lỗi: Không thể tải nội dung file');
            }
        } catch (error) {
            console.error('Error fetching file content:', error);
            setFileContent('Lỗi kết nối: Không thể tải nội dung file');
        } finally {
            setLoadingContent(false);
        }
    };

    return (
        <div className={`source-panel ${collapsed ? "collapsed" : ""}`}>
            {/* Header */}
            <div className="source-header">
                {!collapsed && <h3>Nguồn</h3>}
                <button
                    className="collapse-btn"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? "Mở rộng" : "Thu gọn"}
                >
                    {collapsed ? "➡️" : "⬅️"}
                </button>
            </div>

            {/* Content */}
            {!collapsed && (
                <>
                    <div className="source-actions" style={{ fontSize: '0.75rem', gap: '4px', marginBottom: '4px', display: 'flex', height: '30px', alignItems: 'center' }}>
                        <div style={{ height: '24px', display: 'flex', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.75rem', marginRight: '4px' }}>PDF:</label>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="text-xs"
                                style={{ width: '80px', height: '20px', fontSize: '0.75rem' }}
                            />
                            <button
                                onClick={handleUpload}
                                disabled={!file || uploading || !sessionUUID}
                                className="ml-1 border rounded px-1 text-primary-blue hover:bg-gray-200 text-xs"
                                style={{ minWidth: '50px', height: '20px', fontSize: '0.75rem' }}
                            >
                                {uploading ? "Đang tải..." : "Tải lên"}
                            </button>
                            {uploadResult && (
                                <div className="ml-1 text-xs text-green-600" style={{ fontSize: '0.7rem' }}>{uploadResult}</div>
                            )}
                            {!sessionUUID && (
                                <div className="ml-1 text-xs text-yellow-600" style={{ fontSize: '0.7rem' }}>
                                    Chờ session
                                </div>
                            )}
                        </div>
                        <button className="btn text-xs px-1" style={{ minWidth: '40px', height: '20px', fontSize: '0.75rem' }}>🔄</button>
                    </div>

                    <div className="source-list">
                        <label className="select-all">
                            <span>Select all sources</span>
                            <input
                                type="checkbox"
                                checked={sources.every((s) => s.checked)}
                                onChange={toggleAll}
                            />
                        </label>

                        <div className="source-items">
                            {sources.map((s, i) => (
                                <label key={i} className="source-item">
                                    <div
                                        className="source-info"
                                        onClick={() => handleViewFile(s.name)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <span className="file-icon">📄</span>
                                        <span className="file-name">{s.name}</span>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={s.checked}
                                        onChange={() => toggleItem(i)}
                                    />
                                </label>
                            ))}
                        </div>
                    </div>



                    {selectedFile && (
                        <div className="file-content mt-2 p-2 border rounded bg-gray-50" style={{ height: '80vh', maxHeight: '80vh', overflowY: 'auto', width: '100%', flex: '1 0 50%' }}>
                            <h4 className="font-bold mb-1 text-xs">Nội dung: {selectedFile}</h4>
                            {loadingContent ? (
                                <p className="text-xs">Đang tải...</p>
                            ) : fileImages.length > 0 ? (
                                <div className="overflow-y-auto max-h-full flex flex-col gap-2 items-center p-1 border rounded" style={{ scrollbarWidth: 'thin', width: '100%' }}>
                                    {fileImages.map((img, idx) => (
                                        <img
                                            key={idx}
                                            src={`data:image/png;base64,${img}`}
                                            alt={`PDF page ${idx + 1}`}
                                            className="border rounded shadow-sm"
                                            style={{
                                                width: '95%',
                                                objectFit: 'contain',
                                                maxHeight: '500px',
                                                margin: '5px auto'
                                            }}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <pre className="whitespace-pre-wrap text-xs max-h-full overflow-y-auto p-1 bg-white border rounded">
                                    {fileContent}
                                </pre>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default SourcePanel;
