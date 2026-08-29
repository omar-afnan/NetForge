const fs = require('fs');
const content = fs.readFileSync('src/index.css', 'utf8');

const newRightDockCss = `/* ============================================================
   Right Sidebar — Mode-Based Panel (Inspector / AI Copilot)
   ============================================================ */

.right-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ffffff;
  color: #111827;
  font-size: 12px;
}

.right-sidebar-header {
  flex: 0 0 auto;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.right-sidebar-tabs {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
}

.right-sidebar-tab {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.right-sidebar-tab:hover:not(.active) {
  color: #374151;
  background: #ffffff;
}

.right-sidebar-tab.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.right-sidebar-mode-indicator {
  height: 2px;
  background: #2563eb;
  border-radius: 1px;
  margin-top: 8px;
  transition: all 0.2s ease;
}

.right-sidebar-mode-indicator[data-mode="inspector"] {
  width: 60px;
  background: #2563eb;
}

.right-sidebar-mode-indicator[data-mode="copilot"] {
  width: 90px;
  background: #7c3aed;
}

.right-sidebar-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

/* ============================================================
   Inspector Panel
   ============================================================ */

.inspector-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ffffff;
  color: #111827;
}

.inspector-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
}

.inspector-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #f3f4f6;
  color: #9ca3af;
}

.inspector-empty-title {
  font-size: 13px;
  font-weight: 700;
  color: #374151;
}

.inspector-empty-detail {
  font-size: 11px;
  color: #6b7280;
  line-height: 1.5;
  max-width: 220px;
}

.inspector-empty-text {
  font-size: 11px;
  color: #9ca3af;
  font-style: italic;
}

.inspector-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.inspector-header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #eff6ff;
  color: #2563eb;
  flex-shrink: 0;
}

.inspector-header-info {
  flex: 1 1 auto;
  min-width: 0;
}

.inspector-header-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.inspector-header-type {
  font-size: 10px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 1px;
}

.inspector-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.inspector-status-dot.status-up {
  background: #10b981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);
}

.inspector-status-dot.status-down {
  background: #ef4444;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
}

.inspector-sections {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 6px 0;
}

.inspector-section {
  border-bottom: 1px solid #f3f4f6;
}

.inspector-section:last-child {
  border-bottom: 0;
}

.inspector-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 9px 12px;
  border: 0;
  background: transparent;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.inspector-section-header:hover {
  background: #f9fafb;
}

.inspector-section-title {
  flex: 1 1 auto;
}

.inspector-section-body {
  padding: 0 12px 10px;
}

.inspector-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: 11px;
}

.inspector-row-label {
  color: #6b7280;
  font-weight: 500;
}

.inspector-row-value {
  color: #111827;
  font-weight: 600;
  text-align: right;
  word-break: break-all;
}

.inspector-interface {
  padding: 6px 0;
  border-top: 1px solid #f3f4f6;
}

.inspector-interface:first-child {
  border-top: 0;
}

.inspector-interface-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inspector-interface-name {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
}

.inspector-interface-status {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
}

.inspector-interface-status.status-up {
  color: #10b981;
}

.inspector-interface-status.status-down {
  color: #ef4444;
}

.inspector-interface-details {
  margin-top: 4px;
  padding-left: 8px;
}

.inspector-route,
.inspector-arp {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 0;
  font-size: 10.5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.inspector-route-dest {
  color: #374151;
  font-weight: 600;
}

.inspector-route-via {
  color: #6b7280;
}

.inspector-arp-ip {
  color: #374151;
  font-weight: 600;
}

.inspector-arp-mac {
  color: #6b7280;
}

/* ============================================================
   AI Copilot Panel
   ============================================================ */

.ai-copilot-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #ffffff;
  color: #111827;
  font-size: 12px;
}

.ai-copilot-header {
  flex: 0 0 auto;
  padding: 10px 12px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}

.ai-copilot-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-copilot-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.25);
}

.ai-copilot-title {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.ai-copilot-subtitle {
  font-size: 10px;
  color: #6b7280;
  margin-top: 1px;
}

.ai-copilot-header-right {
  margin-top: 8px;
}

.ai-copilot-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #6b7280;
}

.ai-copilot-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #10b981;
}

.ai-copilot-status.status-thinking,
.ai-copilot-status.status-working {
  color: #1d4ed8;
}

.ai-copilot-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.ai-copilot-mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
}

.ai-copilot-mode-switch button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 10px;
  font-weight: 700;
  color: #6b7280;
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.ai-copilot-mode-switch button:hover:not(.active) {
  color: #374151;
}

.ai-copilot-mode-switch button.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.ai-copilot-context {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  color: #6b7280;
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
}

.ai-copilot-context strong {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10px;
  font-weight: 600;
  color: #374151;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 5px;
  padding: 1px 6px;
}

.ai-copilot-clear {
  border: 0;
  background: transparent;
  color: #6b7280;
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 7px;
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ai-copilot-clear:hover:not(:disabled) {
  color: #111827;
  background: #f3f4f6;
}

.ai-copilot-clear:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-copilot-chat {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #ffffff;
  scrollbar-width: thin;
  scrollbar-color: #d1d5db transparent;
}

.ai-copilot-chat::-webkit-scrollbar { width: 5px; }
.ai-copilot-chat::-webkit-scrollbar-track { background: transparent; }
.ai-copilot-chat::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
.ai-copilot-chat::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

.ai-copilot-msg {
  display: flex;
  animation: ai-copilot-slide-in 0.2s ease-out;
}

@keyframes ai-copilot-slide-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.ai-copilot-msg.user { justify-content: flex-end; }
.ai-copilot-msg.assistant { justify-content: flex-start; }

.ai-copilot-bubble {
  max-width: 92%;
  padding: 8px 11px;
  border-radius: 10px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
}

.ai-copilot-bubble.user {
  background: #2563eb;
  color: #ffffff;
  border-bottom-right-radius: 4px;
}

.ai-copilot-bubble.assistant {
  background: #f3f4f6;
  color: #1f2937;
  border-bottom-left-radius: 4px;
  border: 1px solid #e5e7eb;
}

.ai-copilot-bubble.assistant.muted {
  background: #f9fafb;
  color: #6b7280;
  font-size: 11px;
}

.ai-copilot-text {
  margin: 0;
  font-size: 12px;
}

.ai-copilot-bubble.typing {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 10px 12px;
}

.ai-copilot-bubble.typing span {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: #9ca3af;
  animation: ai-copilot-bounce 1.2s infinite;
}

.ai-copilot-bubble.typing span:nth-child(2) { animation-delay: 0.15s; }
.ai-copilot-bubble.typing span:nth-child(3) { animation-delay: 0.3s; }

@keyframes ai-copilot-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
  30% { transform: translateY(-3px); opacity: 1; }
}

.ai-copilot-plan {
  margin-top: 6px;
  padding: 8px 9px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
}

.ai-copilot-plan-title {
  font-size: 11px;
  font-weight: 700;
  color: #1d4ed8;
  margin-bottom: 5px;
}

.ai-copilot-plan ul {
  margin: 0 0 7px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ai-copilot-plan li {
  display: flex;
  align-items: flex-start;
  gap: 5px;
  font-size: 11px;
  color: #1e3a8a;
  line-height: 1.35;
}

.ai-copilot-plan-check {
  color: #16a34a;
  flex-shrink: 0;
}

.ai-copilot-plan-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.ai-copilot-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 10.5px;
  font-weight: 600;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ai-copilot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-copilot-btn.primary { background: #2563eb; color: #ffffff; }
.ai-copilot-btn.primary:hover:not(:disabled) { background: #1d4ed8; }

.ai-copilot-btn.ghost { background: #ffffff; border-color: #d1d5db; color: #374151; }
.ai-copilot-btn.ghost:hover:not(:disabled) { border-color: #9ca3af; color: #111827; }

.ai-copilot-suggestions {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 6px 10px 3px;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
}

.ai-copilot-suggestions button {
  padding: 4px 10px;
  font-size: 10.5px;
  font-weight: 500;
  color: #374151;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ai-copilot-suggestions button:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}

.ai-copilot-suggestions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-copilot-history {
  flex: 0 0 auto;
  max-height: 100px;
  overflow-y: auto;
  margin: 0 8px;
  padding: 5px 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 10px;
}

.ai-copilot-history ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-copilot-history li {
  display: flex;
  gap: 6px;
  color: #4b5563;
}

.ai-copilot-history li .time {
  color: #9ca3af;
  flex-shrink: 0;
  font-size: 9.5px;
}

.ai-copilot-history li.empty {
  color: #9ca3af;
  font-style: italic;
}

.ai-copilot-input {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 5px 8px 8px;
  padding: 3px 3px 3px 10px;
  background: #ffffff;
  border: 1px solid #d1d5db;
  border-radius: 999px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.ai-copilot-input:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.ai-copilot-input input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: #111827;
  padding: 6px 2px;
}

.ai-copilot-input input::placeholder {
  color: #9ca3af;
}

.ai-copilot-input button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border: 0;
  border-radius: 999px;
  background: #2563eb;
  color: #ffffff;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
}

.ai-copilot-input button:hover:not(:disabled) {
  background: #1d4ed8;
}

.ai-copilot-input button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-height: 720px) {
  .ai-copilot-chat { padding: 8px 8px; gap: 6px; }
}

@media (max-height: 600px) {
  .ai-copilot-suggestions { display: none; }
}
`;

// Find the start of right dock section and replace everything after it
const startMarker = '/* ============================================================\n   Right Dock';
const start = content.indexOf(startMarker);
if (start === -1) {
  console.log('Could not find right dock section');
  process.exit(1);
}

const result = content.substring(0, start) + newRightDockCss;
fs.writeFileSync('src/index.css', result);
console.log('CSS updated successfully, new length:', result.length);
