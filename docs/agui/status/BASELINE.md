# Baseline (2026-11-18T11:24:13+07:00, branch feat/agui-mvp from dev @ ccd5341)

## vite build
```
dist/assets/index-CvbcA_fj.css                           94.06 kB │ gzip:  19.62 kB
dist/assets/index-D9xGADFb.js                         1,108.02 kB │ gzip: 350.05 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 3.68s
exit=0 (✓ built)
```

## eslint (toàn repo, gồm cả thư mục untracked như ds-bundle)
```

✖ 1134 problems (1093 errors, 41 warnings)
  2 errors and 29 warnings potentially fixable with the `--fix` option.

```

## eslint chỉ src/
```
  148:8   warning  React Hook useCallback has a missing dependency: 'setNextQuestions'. Either include it or remove the dependency array                                      react-hooks/exhaustive-deps

✖ 351 problems (339 errors, 12 warnings)

```

## eslint per-file (src/) — errors/warnings
```
src/components/ChatInput.jsx  7/0
src/components/ChatMessages.jsx  8/0
src/components/ChatSessionUUID.jsx  2/0
src/components/Chatbot.jsx  4/2
src/components/CustomScrollbar.jsx  2/1
src/components/ProtectedRoute.jsx  1/0
src/components/ScrollTestButtons.jsx  1/0
src/components/SourcePanel.jsx  8/1
src/components/StudioDashboard.jsx  5/0
src/components/ui/accordion.jsx  6/0
src/components/ui/alert-dialog.jsx  9/0
src/components/ui/alert.jsx  5/0
src/components/ui/aspect-ratio.jsx  1/0
src/components/ui/avatar.jsx  4/0
src/components/ui/badge.jsx  3/1
src/components/ui/breadcrumb.jsx  9/0
src/components/ui/button.jsx  5/1
src/components/ui/calendar.jsx  6/0
src/components/ui/card.jsx  8/0
src/components/ui/checkbox.jsx  2/0
src/components/ui/collapsible.jsx  1/0
src/components/ui/command.jsx  11/0
src/components/ui/context-menu.jsx  18/0
src/components/ui/dialog.jsx  8/0
src/components/ui/drawer.jsx  8/0
src/components/ui/dropdown-menu.jsx  19/0
src/components/ui/hover-card.jsx  4/0
src/components/ui/input-otp.jsx  5/0
src/components/ui/input.jsx  3/0
src/components/ui/label.jsx  2/0
src/components/ui/menubar.jsx  23/0
src/components/ui/navigation-menu.jsx  12/1
src/components/ui/pagination.jsx  10/0
src/components/ui/popover.jsx  4/0
src/components/ui/progress.jsx  3/0
src/components/ui/radio-group.jsx  3/0
src/components/ui/resizable.jsx  4/0
src/components/ui/scroll-area.jsx  5/0
src/components/ui/select.jsx  13/0
src/components/ui/separator.jsx  4/0
src/components/ui/sheet.jsx  9/0
src/components/ui/skeleton.jsx  1/0
src/components/ui/slider.jsx  5/0
src/components/ui/switch.jsx  2/0
src/components/ui/table.jsx  9/0
src/components/ui/tabs.jsx  5/0
src/components/ui/textarea.jsx  2/0
src/components/ui/toggle-group.jsx  8/0
src/components/ui/toggle.jsx  4/1
src/components/ui/tooltip.jsx  5/0
src/contexts/AuthContext.jsx  2/1
src/pages/AchievementsDetailPage.jsx  14/0
src/pages/HomePage.jsx  3/0
src/pages/HoursDetailPage.jsx  10/0
src/pages/ProjectDetailPage.jsx  2/1
src/pages/StreakDetailPage.jsx  1/0
src/websocket.js  1/2
```

## Ghi chú orchestrator (phiên 2, 2026-11-18T11:26:36+07:00)
- Đính chính: nhánh feat/agui-mvp thực tế tách từ `copilot-kit` @ ccd5341 (reflog), không phải `dev` (cc97db0). Kế hoạch tham chiếu AuthContext, ui/sonner, ui/progress, LoginPage — chỉ có trên copilot-kit, nên base này đúng.

## eslint per-file (src/) với lệnh lint chuẩn (luật 10: `--rule 'react/prop-types: off'`) — errors/warnings
Dùng bảng này để so file cũ (cùng một lệnh, so sánh công bằng).
```
src/components/ChatMessages.jsx  3/0
src/components/ChatSessionUUID.jsx  1/0
src/components/Chatbot.jsx  2/2
src/components/CustomScrollbar.jsx  0/1
src/components/ScrollTestButtons.jsx  1/0
src/components/SourcePanel.jsx  6/1
src/components/StudioDashboard.jsx  3/0
src/components/ui/accordion.jsx  1/0
src/components/ui/alert-dialog.jsx  1/0
src/components/ui/alert.jsx  1/0
src/components/ui/aspect-ratio.jsx  1/0
src/components/ui/avatar.jsx  1/0
src/components/ui/badge.jsx  1/1
src/components/ui/breadcrumb.jsx  1/0
src/components/ui/button.jsx  1/1
src/components/ui/calendar.jsx  1/0
src/components/ui/card.jsx  1/0
src/components/ui/checkbox.jsx  1/0
src/components/ui/collapsible.jsx  1/0
src/components/ui/command.jsx  1/0
src/components/ui/context-menu.jsx  1/0
src/components/ui/dialog.jsx  1/0
src/components/ui/drawer.jsx  1/0
src/components/ui/dropdown-menu.jsx  1/0
src/components/ui/hover-card.jsx  1/0
src/components/ui/input.jsx  1/0
src/components/ui/label.jsx  1/0
src/components/ui/menubar.jsx  1/0
src/components/ui/navigation-menu.jsx  1/1
src/components/ui/pagination.jsx  2/0
src/components/ui/popover.jsx  1/0
src/components/ui/progress.jsx  1/0
src/components/ui/radio-group.jsx  1/0
src/components/ui/resizable.jsx  1/0
src/components/ui/scroll-area.jsx  1/0
src/components/ui/select.jsx  1/0
src/components/ui/separator.jsx  1/0
src/components/ui/sheet.jsx  1/0
src/components/ui/switch.jsx  1/0
src/components/ui/table.jsx  1/0
src/components/ui/tabs.jsx  1/0
src/components/ui/textarea.jsx  1/0
src/components/ui/toggle.jsx  1/1
src/components/ui/tooltip.jsx  1/0
src/contexts/AuthContext.jsx  1/1
src/pages/HomePage.jsx  3/0
src/pages/HoursDetailPage.jsx  9/0
src/pages/ProjectDetailPage.jsx  2/1
src/pages/StreakDetailPage.jsx  1/0
src/websocket.js  1/2
TOTAL src: 71 errors, 12 warnings
```

## Baseline console (đo bởi phiên 2, chưa đo lại; orchestrator sẽ đo lại ở Đợt 3 cùng cấu hình)
Cấu hình đo: dev server chạy trên ccd5341, mở `/session` với `localStorage.user` giả, backend không chạy, chờ 6 giây.
Kết quả:
- 4 error, đều là `WebSocket connection to ws://localhost:8686/chat/pedagogical?token=… failed` (websocket.js thử kết nối lại).
- 0 exception, 0 cảnh báo React key/hook, 0 warning khác.

## Ghi chú orchestrator (phiên chính)
- Đã xác nhận qua reflog: base là `copilot-kit` @ ccd5341. Mọi phép so sánh và diff dùng `ccd5341`.
- So sánh lint file cũ: dùng bảng "luật 10" của phiên 2 ở trên. Bảng đầu tiên (còn bật prop-types) chỉ để tham khảo.
