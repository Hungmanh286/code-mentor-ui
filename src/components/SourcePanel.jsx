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
    const [fileImages, setFileImages] = useState([]);
    const [loadingFiles, setLoadingFiles] = useState(false);

    // Thông báo lên App khi trạng thái thu gọn thay đổi
    useEffect(() => {
        if (onCollapsedChange) {
            onCollapsedChange(collapsed);
        }
    }, [collapsed, onCollapsedChange]);

    // Fetch files when session UUID changes and set up polling
    useEffect(() => {
        if (sessionUUID) {
            // Initial fetch
            fetchSessionFiles();

            // Set up polling to refresh files list periodically
            const intervalId = setInterval(() => {
                fetchSessionFiles();
            }, 30000); // Poll every 30 seconds

            // Clean up interval on component unmount or when session changes
            return () => clearInterval(intervalId);
        }
    }, [sessionUUID]);

    // Function to fetch files for the current session
    const fetchSessionFiles = async () => {
        if (!sessionUUID) return;

        setLoadingFiles(true);
        try {
            console.log(`Fetching files for session: ${sessionUUID}`);
            const response = await fetch(`http://0.0.0.0:8686/session-files/${sessionUUID}`);
            console.log("Response status:", response.status);

            if (response.ok) {
                const data = await response.json();
                console.log("Session files response data:", data);

                // Handle array of strings format [file_id1, file_id2, ...]
                if (Array.isArray(data)) {
                    console.log("Response is an array of file IDs");
                    const filesData = data.map(fileId => ({
                        name: `File ${fileId.substring(0, 8)}...`,
                        id: fileId,
                        checked: false
                    }));
                    setSources(filesData);
                }
                // Handle object with files array format {files: [{file_id, filename, active}, ...]}
                else if (data.files && Array.isArray(data.files)) {
                    console.log("Response contains files array");
                    const filesData = data.files.map(file => ({
                        name: file.filename || `File ${file.file_id.substring(0, 8)}`,
                        id: file.file_id,
                        checked: file.active || false
                    }));
                    setSources(filesData);
                }
                // Handle empty or unexpected response
                else {
                    console.log("Unexpected response format:", data);
                    setSources([]);
                }
            } else {
                console.error("Failed to fetch files:", response.statusText);
            }
        } catch (err) {
            console.error("Error fetching session files:", err);
        } finally {
            setLoadingFiles(false);
        }
    };

    // Refresh files list
    const handleRefresh = () => {
        fetchSessionFiles();
    };

    const toggleAll = async (e) => {
        const checked = e.target.checked;
        setSources(sources.map((s) => ({ ...s, checked })));

        // Update active status for all files
        for (const source of sources) {
            await updateFileActiveStatus(source.id, checked);
        }
    };

    const toggleItem = async (index) => {
        const newSources = sources.map((s, i) => (i === index ? { ...s, checked: !s.checked } : s));
        setSources(newSources);

        // Update active status for this specific file
        const source = sources[index];
        await updateFileActiveStatus(source.id, !source.checked);
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setUploadResult('');
    };

    const handleUpload = async () => {
        if (!file || !sessionUUID) return;
        setUploading(true);
        setUploadResult('');

        // Tạo file_id ngẫu nhiên
        const fileId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', sessionUUID);
        formData.append('file_id', fileId);

        try {
            console.log("Uploading file with session:", sessionUUID, "file_id:", fileId);
            const res = await fetch('http://0.0.0.0:8686/upload', {
                method: 'POST',
                body: formData,
            });
            console.log("Upload response status:", res.status);
            const data = await res.json();
            console.log("Upload response:", data);
            if (data.file_path) {
                setUploadResult('Tải lên thành công!');
                // Fetch all files from the session instead of manually adding just this one
                fetchSessionFiles();
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

    const handleViewFile = async (filename, fileId) => {
        if (selectedFile === filename) {
            // Toggle off if clicking the same file again
            setSelectedFile(null);
            setFileContent('');
            setFileImages([]);
            // Update file active status to false when deselecting
            await updateFileActiveStatus(fileId, false);
            return;
        }

        setSelectedFile(filename);
        setLoadingContent(true);
        setFileImages([]);
        setFileContent('');

        try {
            // Update file active status to true when selecting
            await updateFileActiveStatus(fileId, true);

            console.log(`Fetching content for file: ${filename}, session: ${sessionUUID}, fileId: ${fileId}`);
            const res = await fetch(`http://0.0.0.0:8686/view-file?session_id=${sessionUUID}&file_id=${fileId}`);
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

    // Function to update file active status
    const updateFileActiveStatus = async (fileId, active) => {
        if (!fileId || !sessionUUID) return;

        try {
            const formData = new FormData();
            formData.append('file_id', fileId);
            formData.append('active', active);

            console.log(`Updating file active status: fileId=${fileId}, active=${active}`);
            const response = await fetch('http://0.0.0.0:8686/update-file-active', {
                method: 'PUT',
                body: formData,
            });

            const result = await response.json();
            console.log("Update file active status response:", result);
            return result;
        } catch (error) {
            console.error("Error updating file active status:", error);
            return { success: false, error: error.message };
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
                        <button
                            onClick={handleRefresh}
                            className="btn text-xs px-1"
                            style={{ minWidth: '40px', height: '20px', fontSize: '0.75rem' }}
                        >
                            🔄
                        </button>
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
                                        onClick={() => handleViewFile(s.name, s.id)}
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
