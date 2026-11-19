import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Lightbulb, Trash2 } from 'lucide-react';
import "../assets/css/SourcePanel.css";
import CustomScrollbar from './CustomScrollbar';
import { API_URL } from '@/config';

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
    const [cropMode, setCropMode] = useState(false);
    const [cropData, setCropData] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [cropSelection, setCropSelection] = useState(null);
    const [loadingFileStatus, setLoadingFileStatus] = useState({});
    const [zoomLevel, setZoomLevel] = useState(100);
    const [croppedAreas, setCroppedAreas] = useState([]);
    const canvasRef = useRef(null);
    const isInitialLoad = useRef(true); // Track if this is the first load (page reload)

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

            // Set up polling to refresh files list periodically - disabled to prevent overriding checked state
            // const intervalId = setInterval(() => {
            //     fetchSessionFiles();
            // }, 30000); // Poll every 30 seconds

            // Clean up interval on component unmount or when session changes
            // return () => clearInterval(intervalId);
        }
    }, [sessionUUID]);

    // Function to fetch files for the current session
    const fetchSessionFiles = async () => {
        if (!sessionUUID) return;

        setLoadingFiles(true);
        try {
            console.log(`Fetching files for session: ${sessionUUID}`);
            const response = await fetch(`${API_URL}/session-files/${sessionUUID}`);
            console.log("Response status:", response.status);

            if (response.ok) {
                const data = await response.json();
                console.log("Session files response data:", data);

                // Handle new API format: array of {file_id, file_name}
                // Always set checked to false on fetch (clean state on reload)
                if (Array.isArray(data)) {
                    const filesData = data.map(file => ({
                        name: file.file_name || `File ${file.file_id.substring(0, 8)}...`,
                        id: file.file_id,
                        checked: false // Always start unchecked
                    }));
                    setSources(filesData);

                    // On initial load (page reload), reset all files to inactive in backend
                    if (isInitialLoad.current && filesData.length > 0) {
                        console.log('Page reloaded - resetting all files to inactive in backend');
                        isInitialLoad.current = false;
                        // Reset all files to inactive
                        for (const file of filesData) {
                            await updateFileActiveStatus(file.id, false);
                        }
                    }
                } else {
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
        const fileId = sources[index].id;
        const newCheckedState = !sources[index].checked;

        setLoadingFileStatus(prev => ({ ...prev, [fileId]: 'loading' }));

        // Update active status for this specific file
        await updateFileActiveStatus(fileId, newCheckedState);

        // Update sources state with new checked state
        const newSources = sources.map((s, i) => (i === index ? { ...s, checked: newCheckedState } : s));
        setSources(newSources);

        setLoadingFileStatus(prev => ({ ...prev, [fileId]: 'done' }));
        setTimeout(() => {
            setLoadingFileStatus(prev => {
                const copy = { ...prev };
                delete copy[fileId];
                return copy;
            });
        }, 1200); // Hiển thị dấu tích 1.2s rồi ẩn
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
            const res = await fetch(`${API_URL}/upload`, {
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
            setSelectedFile(null);
            setFileContent('');
            setFileImages([]);
            setZoomLevel(100);
            setCroppedAreas([]);
            return;
        }

        setSelectedFile(filename);
        setLoadingContent(true);
        setFileImages([]);
        setFileContent('');
        setZoomLevel(100);
        setCroppedAreas([]);

        try {
            console.log(`Fetching content for file: ${filename}, session: ${sessionUUID}, fileId: ${fileId}`);
            const res = await fetch(`${API_URL}/view-file?session_id=${sessionUUID}&file_id=${fileId}`);
            console.log("Response status:", res.status);
            console.log("Content type:", res.headers.get('content-type'));

            if (res.ok) {
                try {
                    const data = await res.json();
                    console.log("Response data:", Object.keys(data));

                    if (data.images_base64) {
                        setFileImages(data.images_base64);
                        console.log("Received multiple images, pages:", data.images_base64.length);
                    } else if (data.image_base64) {
                        setFileImages([data.image_base64]);
                        console.log("Received single image base64 data");
                    } else if (data.content) {
                        setFileContent(data.content);
                    } else if (data.error) {
                        setFileContent(`Lỗi: ${data.error}`);
                    } else {
                        setFileContent('Không thể hiển thị nội dung file');
                    }
                } catch (parseError) {
                    console.error("Error parsing response:", parseError);
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
            const response = await fetch(`${API_URL}/update-file-active`, {
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

    // Function to handle uploading cropped images
    const handleUploadCropped = async (croppedBlob, sessionId, currentFileId) => {
        try {
            const formData = new FormData();
            formData.append("file", croppedBlob, "cropped_image.png");
            formData.append("session_id", sessionId);
            formData.append("file_id", currentFileId);

            console.log(`Uploading cropped image for session: ${sessionId}, file_id: ${currentFileId}`);
            const response = await fetch(`${API_URL}/upload-crop`, {
                method: "POST",
                body: formData,
            });

            const result = await response.json();
            console.log("Upload cropped image response:", result);

            if (response.ok) {
                // Refresh files list to show the new cropped image
                fetchSessionFiles();
                return { success: true, result };
            } else {
                console.error("Failed to upload cropped image:", result);
                return { success: false, error: result.error || 'Upload failed' };
            }
        } catch (error) {
            console.error("Error uploading cropped image:", error);
            return { success: false, error: error.message };
        }
    };

    // Handle image click to start cropping
    const handleImageClick = (e, imageIndex) => {
        if (!cropMode) return;

        const img = e.target;
        const rect = img.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (!cropData) {
            // Start cropping
            setCropData({
                startX: x,
                startY: y,
                imageIndex: imageIndex,
                imageRect: rect,
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                displayWidth: img.offsetWidth,
                displayHeight: img.offsetHeight
            });
            setCropSelection({
                startX: x,
                startY: y,
                endX: x,
                endY: y,
                imageIndex: imageIndex
            });
        } else {
            // End cropping and process
            const endX = x;
            const endY = y;

            // Calculate crop area in display coordinates
            const cropArea = {
                x: Math.min(cropData.startX, endX),
                y: Math.min(cropData.startY, endY),
                width: Math.abs(endX - cropData.startX),
                height: Math.abs(endY - cropData.startY),
                imageIndex: imageIndex
            };

            if (cropArea.width > 10 && cropArea.height > 10) {
                processCrop(cropArea, img);

                // Save cropped area for display - replace previous crop, don't accumulate
                setCroppedAreas([{
                    imageIndex: imageIndex,
                    x: Math.min(cropData.startX, endX),
                    y: Math.min(cropData.startY, endY),
                    width: Math.abs(endX - cropData.startX),
                    height: Math.abs(endY - cropData.startY)
                }]);
            }

            setCropData(null);
            setCropSelection(null);
            // Don't turn off crop mode - setCropMode(false);
        }
    };

    // Handle mouse move for crop selection
    const handleMouseMove = (e, imageIndex) => {
        if (!cropMode || !cropData || cropData.imageIndex !== imageIndex) return;

        const img = e.target;
        const rect = img.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Ensure coordinates are within image bounds
        const boundedX = Math.max(0, Math.min(x, img.offsetWidth));
        const boundedY = Math.max(0, Math.min(y, img.offsetHeight));

        setCropSelection({
            ...cropSelection,
            endX: boundedX,
            endY: boundedY
        });
    };

    // Process the crop and upload
    const processCrop = async (cropArea, imgElement) => {
        try {
            // Create a new image to ensure proper loading
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Get the actual displayed size of the image
                const displayedWidth = imgElement.offsetWidth;
                const displayedHeight = imgElement.offsetHeight;

                // Calculate scale factors from displayed size to natural size
                const scaleX = img.naturalWidth / displayedWidth;
                const scaleY = img.naturalHeight / displayedHeight;

                // Debug logging
                console.log('Image dimensions:', {
                    natural: { width: img.naturalWidth, height: img.naturalHeight },
                    displayed: { width: displayedWidth, height: displayedHeight },
                    scale: { x: scaleX, y: scaleY },
                    cropArea: cropArea
                });

                // Calculate the actual crop coordinates in the natural image size
                // Add extra padding to ensure all text is captured
                const widthPadding = Math.round(60 * scaleX); // Add padding for width
                const heightPadding = Math.round(20 * scaleY); // Add padding for height

                const actualCropX = Math.max(0, Math.round(cropArea.x * scaleX) - widthPadding);
                const actualCropY = Math.max(0, Math.round(cropArea.y * scaleY) - heightPadding);
                const actualCropWidth = Math.min(
                    img.naturalWidth - actualCropX,
                    Math.round(cropArea.width * scaleX) + (widthPadding * 2)
                );
                const actualCropHeight = Math.min(
                    img.naturalHeight - actualCropY,
                    Math.round(cropArea.height * scaleY) + (heightPadding * 2)
                );

                console.log('Actual crop coordinates:', {
                    x: actualCropX,
                    y: actualCropY,
                    width: actualCropWidth,
                    height: actualCropHeight,
                    widthPadding: widthPadding,
                    heightPadding: heightPadding
                });

                // Set canvas size to the actual crop dimensions
                canvas.width = actualCropWidth;
                canvas.height = actualCropHeight;

                // Draw the cropped portion from the original image
                ctx.drawImage(
                    img,
                    actualCropX, actualCropY, actualCropWidth, actualCropHeight,
                    0, 0, actualCropWidth, actualCropHeight
                );                // Convert to blob and upload
                canvas.toBlob(async (blob) => {
                    if (blob && sessionUUID) {
                        // Get the current file ID from the selected file
                        const currentFileId = sources.find(s => s.name === selectedFile)?.id;
                        if (currentFileId) {
                            const result = await handleUploadCropped(blob, sessionUUID, currentFileId);
                            if (result.success) {
                                console.log('Crop uploaded successfully');
                            } else {
                                console.error('Failed to upload crop:', result.error);
                            }
                        } else {
                            console.error('Could not find current file ID for cropping');
                        }
                    }
                }, 'image/png', 1.0);
            };

            // Set the image source to trigger loading
            img.src = imgElement.src;

        } catch (error) {
            console.error('Error processing crop:', error);
            alert('Lỗi khi xử lý crop: ' + error.message);
        }
    };

    const handleDeleteFile = async (fileId) => {
        if (!fileId) return;
        if (!window.confirm(`Bạn có chắc muốn xóa file ${fileId.substring(0, 8)}...?`)) return;
        setLoadingFileStatus(prev => ({ ...prev, [fileId]: 'loading' }));
        try {
            const response = await fetch(`${API_URL}/delete-file/${fileId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                throw new Error('Xóa file thất bại');
            }
            await fetchSessionFiles();
        } catch (err) {
            alert('Lỗi khi xóa file!');
        } finally {
            setLoadingFileStatus(prev => {
                const copy = { ...prev };
                delete copy[fileId];
                return copy;
            });
        }
    };

    return (
        <div className="flex flex-col h-full relative">
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

            {/* Source content container with custom scroll */}
            <div
                id="source-panel-content-container"
                className="flex-1 overflow-y-scroll"
                style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                }}
            >
                <style>
                    {`#source-panel-content-container::-webkit-scrollbar { display: none; }`}
                </style>

                {/* Source content */}
                <div className="p-4">
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
                                    className="btn text-xs px-2 py-1 border rounded hover:bg-gray-200 transition-colors"
                                    style={{
                                        minWidth: '40px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                    title="Làm mới danh sách file"
                                >
                                    <RefreshCw size={14} />
                                </button>
                                <button
                                    onClick={() => {
                                        setCropMode(!cropMode);
                                        if (cropMode) {
                                            // Clear cropped areas when turning off crop mode
                                            setCroppedAreas([]);
                                            setCropData(null);
                                            setCropSelection(null);
                                        }
                                    }}
                                    className={`btn text-xs px-2 py-1 border rounded transition-colors ${cropMode ? 'bg-amber-500 text-white hover:bg-amber-600' : 'hover:bg-gray-200'}`}
                                    style={{
                                        minWidth: '40px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px'
                                    }}
                                    title={cropMode ? "Tắt chế độ giải thích" : "Bật chế độ giải thích"}
                                >
                                    <Lightbulb size={14} />
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
                                        <div key={i} className="source-item" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div
                                                className="source-info"
                                                style={{ cursor: 'pointer', flex: 1 }}
                                            >
                                                <span className="file-icon">📄</span>
                                                <span className="file-name" onClick={() => handleViewFile(s.name, s.id)}>{s.name}</span>
                                            </div>
                                            {loadingFileStatus[s.id] === 'loading' ? (
                                                <span className="loading-spinner" style={{ width: 18, height: 18, display: 'inline-block' }}>
                                                    <svg viewBox="0 0 50 50" style={{ width: '100%', height: '100%', animation: 'spin 1s linear infinite' }}>
                                                        <circle cx="25" cy="25" r="20" fill="none" stroke="#007bff" strokeWidth="5" strokeDasharray="31.4 31.4" />
                                                    </svg>
                                                </span>
                                            ) : (
                                                <>
                                                    <input
                                                        type="checkbox"
                                                        checked={s.checked}
                                                        onChange={(e) => { e.stopPropagation(); toggleItem(i); }}
                                                        style={{ marginLeft: '4px', position: 'relative', zIndex: 20 }}
                                                    />
                                                    <button
                                                        onClick={() => handleDeleteFile(s.id)}
                                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                                        style={{ marginLeft: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
                                                        title="Xóa file"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>



                            {selectedFile && (
                                <div className="file-content mt-2 p-2 border rounded bg-gray-50" style={{ height: '80vh', maxHeight: '80vh', overflowY: 'auto', width: '100%', flex: '1 0 50%' }}>
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-bold text-xs">Nội dung: {selectedFile}</h4>
                                        {fileImages.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setZoomLevel(Math.max(50, zoomLevel - 10))}
                                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-200"
                                                    title="Zoom out"
                                                >
                                                    -
                                                </button>
                                                <span className="text-xs font-semibold min-w-[45px] text-center">
                                                    {zoomLevel}%
                                                </span>
                                                <button
                                                    onClick={() => setZoomLevel(Math.min(200, zoomLevel + 10))}
                                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-200"
                                                    title="Zoom in"
                                                >
                                                    +
                                                </button>
                                                <button
                                                    onClick={() => setZoomLevel(100)}
                                                    className="px-2 py-1 text-xs border rounded hover:bg-gray-200"
                                                    title="Reset zoom"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    {loadingContent ? (
                                        <p className="text-xs">Đang tải...</p>
                                    ) : fileImages.length > 0 ? (
                                        <div className="overflow-y-auto max-h-full flex flex-col gap-2 items-center p-1 border rounded" style={{ scrollbarWidth: 'thin', width: '100%' }}>
                                            {cropMode && (
                                                <div className="text-xs text-amber-700 mb-2 p-2 bg-amber-50 rounded border border-amber-200">
                                                    💡 Chế độ giải thích đang bật. Click để chọn vùng cần giải thích, click lần nữa để hoàn tất.
                                                </div>
                                            )}
                                            {fileImages.map((img, idx) => (
                                                <div
                                                    key={idx}
                                                    style={{
                                                        position: 'relative',
                                                        width: `${zoomLevel}%`,
                                                        margin: '5px auto',
                                                        display: 'inline-block'
                                                    }}
                                                >
                                                    <img
                                                        src={`data:image/png;base64,${img}`}
                                                        alt={`PDF page ${idx + 1}`}
                                                        className="border rounded shadow-sm"
                                                        style={{
                                                            width: '100%',
                                                            objectFit: 'contain',
                                                            maxHeight: 'none',
                                                            cursor: cropMode ? 'crosshair' : 'default'
                                                        }}
                                                        onClick={(e) => handleImageClick(e, idx)}
                                                        onMouseMove={(e) => handleMouseMove(e, idx)}
                                                    />
                                                    {/* Current crop selection overlay (while selecting) */}
                                                    {cropMode && cropSelection && cropSelection.imageIndex === idx && (
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                left: Math.min(cropSelection.startX, cropSelection.endX),
                                                                top: Math.min(cropSelection.startY, cropSelection.endY),
                                                                width: Math.abs(cropSelection.endX - cropSelection.startX),
                                                                height: Math.abs(cropSelection.endY - cropSelection.startY),
                                                                border: '2px dashed #f59e0b',
                                                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                                pointerEvents: 'none',
                                                                zIndex: 10
                                                            }}
                                                        />
                                                    )}
                                                    {/* Previously cropped area overlay (after crop completed) */}
                                                    {croppedAreas.filter(area => area.imageIndex === idx).map((area, areaIdx) => (
                                                        <div
                                                            key={areaIdx}
                                                            style={{
                                                                position: 'absolute',
                                                                left: area.x,
                                                                top: area.y,
                                                                width: area.width,
                                                                height: area.height,
                                                                border: '2px solid #f59e0b',
                                                                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                                                pointerEvents: 'none',
                                                                zIndex: 9
                                                            }}
                                                        />
                                                    ))}
                                                </div>
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
            </div>

            {/* Custom scrollbar for source content */}
            <CustomScrollbar containerId="source-panel-content-container" />
        </div>
    );
};

export default SourcePanel;
