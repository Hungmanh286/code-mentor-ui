import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { apiFetch } from '../api';

function randomSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function SessionCard({ id, fileCount, onDelete, deleting }) {
    return (
        <div className="group relative min-h-[168px] p-[18px] rounded-xl border border-hairline-soft bg-panel
                        flex flex-col gap-3 transition-shadow hover:border-hairline hover:shadow-[0_2px_10px_rgba(0,43,49,0.06)]">
            {/* Link phủ toàn thẻ, nhưng vẫn là thẻ <a> thật nên Ctrl+click / mở tab mới hoạt động */}
            <Link to={`/session/${id}`} className="absolute inset-0 rounded-xl" aria-label={`Mở phiên ${id}`} />

            <div className="flex items-start gap-2.5">
                <div className="flex-1 min-w-0">
                    <div className="font-urbanist text-[16.5px] font-semibold leading-tight tracking-[-0.01em]">
                        Phiên {id.substring(0, 8)}
                    </div>
                    <div className="mt-1.5 font-mono text-[11px] text-muted-soft truncate">{id}</div>
                </div>
                <span className="shrink-0 py-[3px] px-2.5 rounded-full text-[10.5px] font-semibold bg-accent-tint text-accent">
                    Đang mở
                </span>
            </div>

            <div className="flex-1 flex items-end">
                <p className="text-[12.5px] leading-relaxed text-main-text/60">
                    {fileCount === null
                        ? 'Đang đếm tài liệu…'
                        : fileCount === 0
                            ? 'Chưa có tài liệu nào — mở phiên để tải lên.'
                            : `${fileCount} tài liệu đã tải lên.`}
                </p>
            </div>

            <div className="relative flex items-center gap-2">
                <span className="flex-1" />
                <button
                    type="button"
                    onClick={onDelete}
                    disabled={deleting}
                    className="relative z-10 h-8 px-3 rounded-lg text-[12px] font-semibold text-main-text/50
                               hover:text-error-red hover:bg-error-red/5 disabled:opacity-50 transition-colors
                               lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                >
                    {deleting ? 'Đang xoá…' : 'Xoá phiên'}
                </button>
            </div>
        </div>
    );
}

function HomePage() {
    const [sessions, setSessions] = useState([]);
    const [fileCounts, setFileCounts] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const navigate = useNavigate();

    const fetchSessions = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await apiFetch('/sessions');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            const list = Array.isArray(data) ? data : (data.sessions || []);
            setSessions(list);
            return list;
        } catch (err) {
            // Trước đây khối catch này rỗng: backend chết thì trang hiện
            // "chưa có phiên nào", người dùng tưởng mất sạch dữ liệu.
            console.error('Không tải được danh sách phiên:', err);
            setError('Không kết nối được máy chủ. Danh sách phiên chưa tải được — thử lại sau ít phút.');
            setSessions([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchSessions(); }, [fetchSessions]);

    // Số tài liệu là dữ liệu thật, lấy sau khi có danh sách phiên. Hỏng thì bỏ
    // qua lặng lẽ vì đây chỉ là thông tin phụ trên thẻ.
    useEffect(() => {
        let cancelled = false;
        if (!sessions.length) return;
        setFileCounts((prev) => {
            const next = { ...prev };
            sessions.forEach((id) => { if (!(id in next)) next[id] = null; });
            return next;
        });
        (async () => {
            for (const id of sessions) {
                try {
                    const res = await apiFetch(`/session-files/${encodeURIComponent(id)}`);
                    if (!res.ok) continue;
                    const data = await res.json();
                    const n = Array.isArray(data) ? data.length : (data.files?.length ?? 0);
                    if (!cancelled) setFileCounts((prev) => ({ ...prev, [id]: n }));
                } catch { /* thông tin phụ, bỏ qua */ }
            }
        })();
        return () => { cancelled = true; };
    }, [sessions]);

    const createNewSession = async () => {
        setCreating(true);
        setError(null);
        try {
            const sessionId = randomSessionId();
            const formData = new FormData();
            formData.append('session_id', sessionId);
            const response = await apiFetch('/create-session', { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await response.json();
            navigate(`/session/${sessionId}`);
        } catch (err) {
            console.error('Tạo phiên thất bại:', err);
            setError('Không tạo được phiên mới. Kiểm tra kết nối tới máy chủ rồi thử lại.');
        } finally {
            setCreating(false);
        }
    };

    const deleteSession = async (sessionId) => {
        if (!window.confirm(`Xoá phiên ${sessionId.substring(0, 8)}? Toàn bộ tài liệu và hội thoại của phiên sẽ mất.`)) return;
        setDeletingId(sessionId);
        setError(null);
        try {
            const response = await apiFetch(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            await fetchSessions();
        } catch (err) {
            console.error('Xoá phiên thất bại:', err);
            setError('Không xoá được phiên. Thử lại sau.');
        } finally {
            setDeletingId(null);
        }
    };

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? sessions.filter((id) => id.toLowerCase().includes(q)) : sessions;
    }, [sessions, query]);

    return (
        <div className="flex flex-col min-h-screen bg-surface text-main-text">
            <AppHeader>
                <label className="flex items-center gap-2.5 h-[34px] px-3 rounded-lg border border-hairline
                                  bg-surface w-full max-w-[260px] focus-within:border-accent transition-colors">
                    <svg className="w-[15px] h-[15px] shrink-0 text-muted-soft" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" />
                    </svg>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Tìm phiên học…"
                        className="w-full bg-transparent text-[12.5px] placeholder:text-muted-soft focus:outline-none"
                    />
                </label>
            </AppHeader>

            <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-6 py-8 sm:py-11">
                <div className="flex flex-wrap items-end gap-5 mb-7">
                    <div className="flex-1 min-w-[260px]">
                        <h1 className="font-urbanist text-[26px] sm:text-[30px] font-bold tracking-[-0.02em]">
                            Phiên học của bạn
                        </h1>
                        <p className="mt-1.5 text-[13.5px] text-main-text/60">
                            Mỗi phiên giữ riêng tài liệu, hội thoại và bài kiểm tra của một môn.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={createNewSession}
                        disabled={creating}
                        className="h-10 px-[18px] rounded-lg flex items-center gap-2 text-[13.5px] font-semibold
                                   text-white bg-accent hover:bg-accent-strong disabled:opacity-60 transition-colors"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                        {creating ? 'Đang tạo…' : 'Phiên mới'}
                    </button>
                </div>

                {error && (
                    <div role="alert" className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg border border-error-red/25 bg-error-red/5">
                        <svg className="w-[18px] h-[18px] shrink-0 mt-px text-error-red" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                            <circle cx="12" cy="12" r="9" /><path d="M12 7.5v5M12 16h.01" />
                        </svg>
                        <p className="text-[13px] leading-relaxed text-error-red flex-1">{error}</p>
                        <button type="button" onClick={fetchSessions}
                            className="text-[12.5px] font-semibold text-error-red underline underline-offset-4 shrink-0">
                            Thử lại
                        </button>
                    </div>
                )}

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="min-h-[168px] rounded-xl border border-hairline-soft bg-panel p-[18px]">
                                <div className="h-4 w-1/2 rounded bg-hairline-soft animate-pulse" />
                                <div className="mt-3 h-3 w-2/3 rounded bg-hairline-soft/70 animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <button
                            type="button"
                            onClick={createNewSession}
                            disabled={creating}
                            className="min-h-[168px] p-[18px] rounded-xl border border-dashed border-hairline
                                       flex flex-col items-center justify-center gap-2.5 text-center
                                       hover:border-accent/40 hover:bg-panel/60 disabled:opacity-60 transition-colors"
                        >
                            <span className="w-10 h-10 rounded-[11px] bg-accent-tint flex items-center justify-center">
                                <svg className="w-[19px] h-[19px] text-accent" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
                                    <path d="M12 5v14M5 12h14" />
                                </svg>
                            </span>
                            <span className="text-[13.5px] font-semibold">Bắt đầu phiên mới</span>
                            <span className="text-[12px] leading-relaxed text-muted">Tải tài liệu lên và hỏi<br />ngay từ nội dung đó</span>
                        </button>

                        {shown.map((id) => (
                            <SessionCard
                                key={id}
                                id={id}
                                fileCount={fileCounts[id] ?? null}
                                deleting={deletingId === id}
                                onDelete={() => deleteSession(id)}
                            />
                        ))}
                    </div>
                )}

                {!isLoading && !error && sessions.length > 0 && shown.length === 0 && (
                    <p className="mt-6 text-[13px] text-muted">Không có phiên nào khớp “{query}”.</p>
                )}
            </main>

            <footer className="w-full border-t border-hairline-soft py-4 mt-auto">
                <p className="text-center text-muted-soft text-xs">Mentor Code · Nền tảng học lập trình</p>
            </footer>
        </div>
    );
}

export default HomePage;
