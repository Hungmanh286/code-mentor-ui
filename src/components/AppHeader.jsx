import { useState } from 'react';
import { Link } from 'react-router-dom';

function Logo({ className = 'h-[22px] w-[22px]' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6 3.5 12 8 18" />
      <path d="m16 6 4.5 6L16 18" />
    </svg>
  );
}

/**
 * Thanh trên cùng dùng chung cho mọi trang.
 *
 * @param {string}  [sessionLabel]  Tên phiên hiện tại, hiện trong chip có chấm xanh.
 * @param {string}  [meta]          Dòng phụ bên phải chip (ví dụ "2/3 nguồn đang dùng").
 * @param {node}    [children]      Chèn thêm vào khoảng giữa (ô tìm kiếm...).
 * @param {func}    [onNewSession]  Có truyền thì hiện nút "Phiên mới".
 * @param {boolean} [creating]      Khoá nút khi đang tạo phiên.
 */
function AppHeader({ sessionLabel, sessionId, meta, children, onNewSession, creating = false }) {
  const [copied, setCopied] = useState(false);

  const copySessionId = async () => {
    if (!sessionId) return;
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Không copy được mã phiên:', err);
    }
  };

  return (
    <header className="h-14 shrink-0 flex items-center gap-3 sm:gap-4 px-3 sm:px-5 bg-panel border-b border-hairline">
      <Link to="/" className="flex items-center gap-2.5 text-accent shrink-0" aria-label="Về trang chủ">
        <Logo />
        <span className="font-urbanist text-[17px] font-bold tracking-[-0.01em] text-main-text hidden sm:block">
          Mentor Code
        </span>
      </Link>

      {sessionLabel && (
        <>
          <div className="w-px h-5 bg-hairline hidden sm:block" />
          <button
            type="button"
            onClick={copySessionId}
            disabled={!sessionId}
            title={sessionId ? `Bấm để copy mã phiên: ${sessionId}` : undefined}
            className="flex items-center gap-2 py-1.5 px-2.5 border border-hairline rounded-md bg-surface
                       min-w-0 enabled:hover:border-accent/40 disabled:cursor-default transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />
            <span className="text-[12.5px] text-main-text/80 truncate max-w-[130px] sm:max-w-[220px]">{sessionLabel}</span>
            {sessionId && (
              <svg className={`w-3.5 h-3.5 shrink-0 ${copied ? 'text-ok' : 'text-muted-soft'}`} viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {copied
                  ? <path d="m5 12.5 4.5 4.5L19 7" />
                  : <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h9" /></>}
              </svg>
            )}
          </button>
        </>
      )}
      {meta && <span className="hidden lg:block text-xs text-muted-soft shrink-0">{meta}</span>}

      <div className="flex-1 min-w-0 flex justify-end lg:justify-center">{children}</div>

      {onNewSession && (
        <button
          type="button"
          onClick={onNewSession}
          disabled={creating}
          className="h-[34px] px-3.5 rounded-lg border border-hairline bg-panel text-[12.5px] font-semibold
                     text-main-text hover:bg-surface disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {creating ? 'Đang tạo…' : 'Phiên mới'}
        </button>
      )}

      <div className="w-8 h-8 rounded-full bg-primary-blue flex items-center justify-center
                      text-[11.5px] font-semibold text-white shrink-0 select-none">
        MH
      </div>
    </header>
  );
}

export default AppHeader;
