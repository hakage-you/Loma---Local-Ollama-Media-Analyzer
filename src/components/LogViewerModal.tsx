import React, { useState, useEffect } from 'react';
import { Terminal, X, Copy, Trash2, RefreshCw, Check, Search } from 'lucide-react';

interface LogViewerModalProps {
  open: boolean;
  onClose: () => void;
  onGetLogs: () => Promise<string>;
  onClearLogs: () => Promise<void>;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({
  open,
  onClose,
  onGetLogs,
  onClearLogs,
}) => {
  const [logs, setLogs] = useState<string>('');
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    const text = await onGetLogs();
    setLogs(text);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchLogs();
    }
  }, [open]);

  if (!open) return null;

  const logLines = logs
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .filter((line) => line.toLowerCase().includes(filter.toLowerCase()));

  const handleCopy = () => {
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = async () => {
    await onClearLogs();
    setLogs('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Application Diagnostics & Error Logs</h3>
              <p className="text-xs text-slate-400">View real-time backend and VLM execution logs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-slate-950/80 border-b border-white/5 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter log entries (e.g. ERROR, 400, Parse)..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition border border-white/10 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleCopy}
              disabled={!logs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-200 border border-indigo-500/40 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy Logs'}
            </button>
            <button
              onClick={handleClear}
              disabled={!logs}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-xl text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>
        </div>

        {/* Console Log Window */}
        <div className="flex-1 bg-black/95 p-4 font-mono text-xs overflow-y-auto space-y-1 min-h-[300px]">
          {logLines.length === 0 ? (
            <div className="text-slate-500 text-center py-12 italic">
              {logs ? 'No matching logs found.' : 'Log file is currently empty.'}
            </div>
          ) : (
            logLines.map((line, idx) => {
              const isError = line.includes('[ERROR]');
              const isWarn = line.includes('[WARN]');
              return (
                <div
                  key={idx}
                  className={`leading-relaxed break-all select-text ${
                    isError
                      ? 'text-red-400 bg-red-950/40 px-2 py-0.5 rounded border-l-2 border-red-500 font-semibold'
                      : isWarn
                      ? 'text-amber-300 bg-amber-950/30 px-2 py-0.5 rounded border-l-2 border-amber-500'
                      : 'text-slate-300 hover:bg-slate-900/60 px-1 rounded'
                  }`}
                >
                  {line}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/90 border-t border-white/10 flex justify-between items-center text-xs text-slate-400">
          <span>Showing {logLines.length} log lines</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
