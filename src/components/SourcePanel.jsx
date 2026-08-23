import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '../api';

const IconFile = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" />
    </svg>
);

/**
 * Công tắc bật/tắt một nguồn.
 *
 * Rãnh trượt 40×24 nằm trong một nút 44×44 để đạt ngưỡng vùng chạm trên
 * mobile. Không bọc rãnh trong <span>: span là phần tử inline nên bỏ qua
 * width/height, công tắc sẽ cao 0px và không bấm được.
 */
function Toggle({ on, busy, label, onToggle, disabled }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={label}
            disabled={disabled}
            onClick={onToggle}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-surface transition-colors disabled:cursor-wait"
        >
            <span className={`block w-10 h-6 rounded-full relative transition-colors ${on ? 'bg-accent' : 'bg-hairline'}`}>
                <span
                    className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-all
                                ${on ? 'left-[19px]' : 'left-[3px]'} ${busy ? 'opacity-60' : ''}`}
                />
            </span>
        </button>
    );
}

const SourcePanel = ({ sessionUUID, onStatsChange }) => {
    const [sources, setSources] = useState([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [pendingIds, setPendingIds] = useState({});

    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState(null);
    const fileInputRef = useRef(null);

    const [selected, setSelected] = useState(null); // { id, name }
    const [fileContent, setFileContent] = useState('');
    const [fileImages, setFileImages] = useState([]);
    const [loadingContent, setLoadingContent] = useState(false);

    const [cropMode, setCropMode] = useState(false);
    const [cropData, setCropData] = useState(null);
    const [cropSelection, setCropSelection] = useState(null);

    // ── Danh sách nguồn ────────────────────────────────────────────────────
    const fetchSessionFiles = useCallback(async () => {
        if (!sessionUUID) return;
        setLoadingFiles(true);
        try {
            const response = await apiFetch(`/session-files/${encodeURIComponent(sessionUUID)}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            // Backend trả mảng object [{ file_id, file_name }]; vẫn chấp nhận
            // mảng chuỗi file_id hoặc dạng { files: [...] } để không vỡ khi
            // API đổi.
            const toSource = (item, prevChecked) => {
                const id = typeof item === 'string' ? item : (item?.file_id ?? item?.id);
                if (!id) return null;
                const name = typeof item === 'string'
                    ? `File ${item.substring(0, 8)}…`
                    : (item.file_name || item.filename || `File ${String(id).substring(0, 8)}…`);
                return {
                    id,
                    name,
                    checked: typeof prevChecked[id] !== 'undefined' ? prevChecked[id] : (item?.active || false),
                };
            };

            setSources((prev) => {
                const prevChecked = {};
                prev.forEach((s) => { prevChecked[s.id] = s.checked; });
                const rawList = Array.isArray(data) ? data : (Array.isArray(data?.files) ? data.files : null);
                return rawList ? rawList.map((item) => toSource(item, prevChecked)).filter(Boolean) : [];
            });
        } catch (err) {
            console.error('Không tải được danh sách nguồn:', err);
        } finally {
            setLoadingFiles(false);
        }
    }, [sessionUUID]);

    useEffect(() => { fetchSessionFiles(); }, [fetchSessionFiles]);

    useEffect(() => {
        onStatsChange?.({ total: sources.length, active: sources.filter((s) => s.checked).length });
    }, [sources, onStatsChange]);

    // ── Bật/tắt nguồn ──────────────────────────────────────────────────────
    const updateFileActiveStatus = async (fileId, active) => {
        if (!fileId || !sessionUUID) return { success: false };
        try {
            const formData = new FormData();
            formData.append('file_id', fileId);
            formData.append('active', active);
            const response = await apiFetch('/update-file-active', { method: 'PUT', body: formData });
            return await response.json();
        } catch (error) {
            console.error('Không đổi được trạng thái nguồn:', error);
            return { success: false, error: error.message };
        }
    };

    const toggleItem = async (fileId) => {
        const source = sources.find((s) => s.id === fileId);
        if (!source) return;
        const next = !source.checked;
        setPendingIds((p) => ({ ...p, [fileId]: true }));
        setSources((prev) => prev.map((s) => (s.id === fileId ? { ...s, checked: next } : s)));
        await updateFileActiveStatus(fileId, next);
        setPendingIds((p) => { const c = { ...p }; delete c[fileId]; return c; });
    };

    const toggleAll = async (checked) => {
        setSources((prev) => prev.map((s) => ({ ...s, checked })));
        for (const source of sources) {
            await updateFileActiveStatus(source.id, checked);
        }
    };

    // ── Tải lên ────────────────────────────────────────────────────────────
    const handleUpload = async () => {
        if (!file || !sessionUUID) return;
        setUploading(true);
        setUploadResult(null);
        const fileId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('session_id', sessionUUID);
        formData.append('file_id', fileId);
        try {
            const res = await apiFetch('/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.file_path) {
                setUploadResult({ ok: true, text: 'Đã tải lên' });
                await fetchSessionFiles();
            } else {
                setUploadResult({ ok: false, text: data.error || 'Tải lên thất bại' });
            }
        } catch (err) {
            console.error('Lỗi tải lên:', err);
            setUploadResult({ ok: false, text: 'Không kết nối được máy chủ' });
        } finally {
            setUploading(false);
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Xem nội dung ───────────────────────────────────────────────────────
    const handleViewFile = async (source) => {
        // Định danh bằng file_id chứ không phải tên: một phiên có thể có nhiều
        // file trùng tên, dùng tên thì bấm file thứ hai lại đóng file thứ nhất.
        if (selected?.id === source.id) {
            setSelected(null); setFileContent(''); setFileImages([]);
            return;
        }
        setSelected({ id: source.id, name: source.name });
        setLoadingContent(true);
        setFileImages([]);
        setFileContent('');
        try {
            const res = await apiFetch(`/view-file?session_id=${encodeURIComponent(sessionUUID)}&file_id=${encodeURIComponent(source.id)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (data.images_base64) setFileImages(data.images_base64);
            else if (data.image_base64) setFileImages([data.image_base64]);
            else if (data.content) setFileContent(data.content);
            else if (data.error) setFileContent(`Lỗi: ${data.error}`);
            else setFileContent('Không hiển thị được nội dung file.');
        } catch (error) {
            console.error('Không tải được nội dung file:', error);
            setFileContent('Không tải được nội dung file.');
        } finally {
            setLoadingContent(false);
        }
    };

    // ── Xoá ────────────────────────────────────────────────────────────────
    const handleDeleteFile = async (source) => {
        if (!window.confirm(`Xoá “${source.name}” khỏi phiên này?`)) return;
        setPendingIds((p) => ({ ...p, [source.id]: true }));
        try {
            const response = await apiFetch(`/delete-file/${encodeURIComponent(source.id)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Xoá thất bại');
            if (selected?.id === source.id) { setSelected(null); setFileContent(''); setFileImages([]); }
            await fetchSessionFiles();
        } catch (err) {
            console.error('Xoá file thất bại:', err);
            window.alert('Không xoá được file. Thử lại sau.');
        } finally {
            setPendingIds((p) => { const c = { ...p }; delete c[source.id]; return c; });
        }
    };

    // ── Crop ảnh trang PDF ─────────────────────────────────────────────────
    const handleUploadCropped = async (croppedBlob, fileId) => {
        try {
            const formData = new FormData();
            formData.append('file', croppedBlob, 'cropped_image.png');
            formData.append('session_id', sessionUUID);
            formData.append('file_id', fileId);
            const response = await apiFetch('/upload-crop', { method: 'POST', body: formData });
            const result = await response.json();
            if (response.ok) { await fetchSessionFiles(); return { success: true, result }; }
            return { success: false, error: result.error || 'Upload thất bại' };
        } catch (error) {
            console.error('Lỗi tải ảnh cắt:', error);
            return { success: false, error: error.message };
        }
    };

    const processCrop = (cropArea, imgElement) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const scaleX = img.naturalWidth / imgElement.offsetWidth;
            const scaleY = img.naturalHeight / imgElement.offsetHeight;
            const padX = Math.round(60 * scaleX);
            const padY = Math.round(20 * scaleY);
            const x = Math.max(0, Math.round(cropArea.x * scaleX) - padX);
            const y = Math.max(0, Math.round(cropArea.y * scaleY) - padY);
            const w = Math.min(img.naturalWidth - x, Math.round(cropArea.width * scaleX) + padX * 2);
            const h = Math.min(img.naturalHeight - y, Math.round(cropArea.height * scaleY) + padY * 2);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
            canvas.toBlob(async (blob) => {
                if (blob && sessionUUID && selected?.id) {
                    const result = await handleUploadCropped(blob, selected.id);
                    if (!result.success) console.error('Tải ảnh cắt thất bại:', result.error);
                }
            }, 'image/png', 1.0);
        };
        img.src = imgElement.src;
    };

    const handleImageClick = (e, imageIndex) => {
        if (!cropMode) return;
        const rect = e.target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (!cropData) {
            setCropData({ startX: x, startY: y, imageIndex });
            setCropSelection({ startX: x, startY: y, endX: x, endY: y, imageIndex });
            return;
        }
        const area = {
            x: Math.min(cropData.startX, x),
            y: Math.min(cropData.startY, y),
            width: Math.abs(x - cropData.startX),
            height: Math.abs(y - cropData.startY),
        };
        if (area.width > 10 && area.height > 10) processCrop(area, e.target);
        setCropData(null);
        setCropSelection(null);
        setCropMode(false);
    };

    const handleMouseMove = (e, imageIndex) => {
        if (!cropMode || !cropData || cropData.imageIndex !== imageIndex) return;
        const rect = e.target.getBoundingClientRect();
        setCropSelection((prev) => ({
            ...prev,
            endX: Math.max(0, Math.min(e.clientX - rect.left, e.target.offsetWidth)),
            endY: Math.max(0, Math.min(e.clientY - rect.top, e.target.offsetHeight)),
        }));
    };

    // ── Giao diện ──────────────────────────────────────────────────────────
    if (!sessionUUID) {
        return <p className="p-4 text-[13px] text-muted">Đang mở phiên…</p>;
    }

    const allChecked = sources.length > 0 && sources.every((s) => s.checked);

    return (
        <div className="p-3.5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 h-9 flex items-center justify-center gap-2 rounded-lg border border-dashed
                               border-hairline bg-surface text-[12.5px] font-semibold text-accent
                               hover:border-accent/50 disabled:opacity-60 transition-colors"
                >
                    <svg className="w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    {file ? 'Đổi tệp khác' : 'Thêm tài liệu PDF'}
                </button>
                <button
                    type="button" onClick={fetchSessionFiles} title="Tải lại danh sách" aria-label="Tải lại danh sách"
                    className="w-9 h-9 shrink-0 rounded-lg border border-hairline-soft flex items-center justify-center
                               text-muted hover:text-main-text hover:bg-surface transition-colors"
                >
                    <svg className={`w-4 h-4 ${loadingFiles ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5.5V11h-5.5" />
                    </svg>
                </button>
            </div>

            <input
                ref={fileInputRef} type="file" accept="application/pdf" className="sr-only"
                onChange={(e) => { setFile(e.target.files[0] || null); setUploadResult(null); }}
            />

            {file && (
                <div className="flex items-center gap-2.5 py-2 px-3 rounded-lg bg-surface border border-hairline-soft">
                    <IconFile className="w-4 h-4 shrink-0 text-muted" />
                    <span className="flex-1 min-w-0 text-[12.5px] truncate" title={file.name}>{file.name}</span>
                    <button type="button" onClick={handleUpload} disabled={uploading}
                        className="h-7 px-3 shrink-0 rounded-md bg-accent text-white text-[12px] font-semibold
                                   hover:bg-accent-strong disabled:opacity-60 transition-colors">
                        {uploading ? 'Đang tải…' : 'Tải lên'}
                    </button>
                </div>
            )}

            {uploadResult && (
                <p className={`text-[12px] ${uploadResult.ok ? 'text-ok' : 'text-error-red'}`}>{uploadResult.text}</p>
            )}

            {sources.length > 0 && (
                <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                    <input
                        type="checkbox" checked={allChecked} onChange={(e) => toggleAll(e.target.checked)}
                        className="w-4 h-4 accent-accent cursor-pointer"
                    />
                    <span className="text-[12.5px] text-main-text/70">Dùng tất cả nguồn</span>
                </label>
            )}

            <div className="flex flex-col gap-0.5">
                {sources.length === 0 ? (
                    <p className="py-6 text-center text-[12.5px] leading-relaxed text-muted">
                        {loadingFiles ? 'Đang tải danh sách…' : 'Chưa có tài liệu nào. Tải một tệp PDF lên để bắt đầu hỏi.'}
                    </p>
                ) : (
                    sources.map((source) => (
                        <div
                            key={source.id}
                            className={`group flex items-center gap-2.5 p-2.5 rounded-lg transition-colors
                                        ${selected?.id === source.id ? 'bg-accent-tint' : 'hover:bg-surface'}`}
                        >
                            <button
                                type="button"
                                onClick={() => handleViewFile(source)}
                                className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                            >
                                <IconFile className={`w-4 h-4 shrink-0 ${source.checked ? 'text-accent' : 'text-muted-soft'}`} />
                                <span className="flex-1 min-w-0">
                                    <span className={`block text-[13px] truncate ${source.checked ? '' : 'text-main-text/55'}`} title={source.name}>
                                        {source.name}
                                    </span>
                                    <span className="block text-[10.5px] text-muted-soft mt-0.5">
                                        {source.checked ? 'Đang dùng' : 'Đã tắt'}
                                    </span>
                                </span>
                            </button>
                            <button
                                type="button" onClick={() => handleDeleteFile(source)} disabled={pendingIds[source.id]}
                                aria-label={`Xoá ${source.name}`} title="Xoá khỏi phiên"
                                className="w-7 h-7 shrink-0 rounded-md flex items-center justify-center text-muted-soft
                                           hover:text-error-red hover:bg-error-red/5 lg:opacity-0 lg:group-hover:opacity-100
                                           focus-visible:opacity-100 transition-all"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 7h16M9.5 7V5.5h5V7M6.5 7l.8 12h9.4l.8-12" />
                                </svg>
                            </button>
                            <Toggle
                                on={source.checked}
                                busy={pendingIds[source.id]}
                                disabled={pendingIds[source.id]}
                                label={`${source.checked ? 'Tắt' : 'Bật'} ${source.name}`}
                                onToggle={() => toggleItem(source.id)}
                            />
                        </div>
                    ))
                )}
            </div>

            {selected && (
                <div className="mt-1 pt-3.5 border-t border-hairline-soft flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 label-caps truncate" title={selected.name}>{selected.name}</span>
                        {fileImages.length > 0 && (
                            <button
                                type="button" onClick={() => { setCropMode((v) => !v); setCropData(null); setCropSelection(null); }}
                                title={cropMode ? 'Tắt chế độ cắt ảnh' : 'Cắt một vùng để hỏi riêng'}
                                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors
                                            ${cropMode ? 'bg-accent text-white' : 'text-muted hover:text-main-text hover:bg-surface'}`}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 3v13a2 2 0 0 0 2 2h13M3 6h13a2 2 0 0 1 2 2v13" />
                                </svg>
                            </button>
                        )}
                        <button type="button" onClick={() => { setSelected(null); setFileContent(''); setFileImages([]); }}
                            aria-label="Đóng xem trước"
                            className="w-7 h-7 rounded-md flex items-center justify-center text-muted hover:text-main-text hover:bg-surface transition-colors">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                strokeWidth="1.8" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                        </button>
                    </div>

                    {cropMode && (
                        <p className="py-2 px-2.5 rounded-lg bg-accent-tint text-[11.5px] leading-relaxed text-accent">
                            Bấm một điểm để bắt đầu, bấm điểm thứ hai để cắt vùng đó thành ảnh mới.
                        </p>
                    )}

                    {loadingContent ? (
                        <p className="py-6 text-center text-[12.5px] text-muted">Đang tải nội dung…</p>
                    ) : fileImages.length > 0 ? (
                        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-0.5">
                            {fileImages.map((img, idx) => (
                                <div key={idx} className="relative">
                                    <img
                                        src={`data:image/png;base64,${img}`}
                                        alt={`Trang ${idx + 1}`}
                                        onClick={(e) => handleImageClick(e, idx)}
                                        onMouseMove={(e) => handleMouseMove(e, idx)}
                                        className={`w-full rounded-lg border border-hairline-soft ${cropMode ? 'cursor-crosshair' : ''}`}
                                    />
                                    {cropMode && cropSelection && cropSelection.imageIndex === idx && (
                                        <div
                                            className="absolute border-2 border-dashed border-accent bg-accent/10 pointer-events-none"
                                            style={{
                                                left: Math.min(cropSelection.startX, cropSelection.endX),
                                                top: Math.min(cropSelection.startY, cropSelection.endY),
                                                width: Math.abs(cropSelection.endX - cropSelection.startX),
                                                height: Math.abs(cropSelection.endY - cropSelection.startY),
                                            }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <pre className="max-h-[60vh] overflow-auto p-3 rounded-lg bg-surface border border-hairline-soft
                                        whitespace-pre-wrap text-[12px] leading-relaxed">{fileContent}</pre>
                    )}
                </div>
            )}
        </div>
    );
};

export default SourcePanel;
