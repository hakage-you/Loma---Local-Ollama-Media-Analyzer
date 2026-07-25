import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Check, X, Server, Cpu, FileText, Trash2, AlertTriangle, ShieldAlert, Download, Sparkles, Loader2, HelpCircle, HardDrive } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { RECOMMENDED_VLM_MODELS, RECOMMENDED_TEXT_MODELS, RecommendedModel } from '../constants/recommendedModels';
import { OllamaPullProgressPayload } from '../types';
import { useTranslation } from '../contexts/I18nContext';

interface SettingsModalProps {
  open: boolean;
  settings: Record<string, string>;
  availableModels: string[];
  onClose: () => void;
  onUpdateSetting: (key: string, value: string) => Promise<void>;
  onFetchModels: () => Promise<void>;
  onUnloadModel?: () => Promise<void>;
}

// Hover-activated instant tooltip component (with smart positioning)
const TooltipHelp: React.FC<{ text: string; align?: 'left' | 'right' | 'center' }> = ({ text, align = 'left' }) => {
  const containerClasses =
    align === 'right'
      ? 'right-0 bottom-full mb-2'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2 bottom-full mb-2'
      : 'left-0 bottom-full mb-2';

  const arrowClasses =
    align === 'right'
      ? 'right-2'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'left-2';

  return (
    <div className="relative group inline-flex items-center">
      <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-300 transition cursor-help shrink-0" />
      <div className={`absolute ${containerClasses} hidden group-hover:block z-50 w-64 p-2.5 bg-slate-900 border border-indigo-500/50 rounded-xl text-[11px] text-slate-200 shadow-2xl backdrop-blur-md pointer-events-none leading-relaxed animate-in fade-in zoom-in-95 duration-150`}>
        {text}
        <div className={`absolute top-full ${arrowClasses} border-4 border-transparent border-t-slate-900`} />
      </div>
    </div>
  );
};

// Flexible installed model matching helper (checks model family/base)
const isModelInstalled = (recommendedName: string, availableList: string[]): boolean => {
  if (!availableList || availableList.length === 0) return false;
  const target = recommendedName.toLowerCase().trim();
  const targetBase = target.split(':')[0];

  return availableList.some((installed) => {
    const inst = installed.toLowerCase().trim();
    const instBase = inst.split(':')[0];

    if (inst === target) return true;
    if (inst.startsWith(target) || target.startsWith(inst)) return true;
    if (instBase === targetBase) return true;
    return false;
  });
};

// Precise selected model matching helper (strictly checks size tag e.g. 30b vs 8b vs 4b)
const isModelSelected = (recommendedName: string, selectedModel: string): boolean => {
  if (!selectedModel) return false;
  const rec = recommendedName.toLowerCase().trim();
  const sel = selectedModel.toLowerCase().trim();
  if (rec === sel) return true;

  const recParts = rec.split(':');
  const selParts = sel.split(':');

  const recBase = recParts[0];
  const selBase = selParts[0];
  const recTag = recParts[1] || '';
  const selTag = selParts[1] || '';

  if (recBase === selBase) {
    if (recTag && selTag) {
      return recTag === selTag || selTag.startsWith(recTag) || recTag.startsWith(selTag);
    }
    return !recTag && !selTag;
  }
  return false;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  settings,
  availableModels,
  onClose,
  onUpdateSetting,
  onFetchModels,
  onUnloadModel,
}) => {
  const { t } = useTranslation();
  const [provider, setProvider] = useState(settings.llm_provider || 'ollama');

  // Ollama
  const [ollamaUrl, setOllamaUrl] = useState(settings.ollama_url || 'http://localhost:11434');
  const [selectedVlmModel, setSelectedVlmModel] = useState(settings.ollama_model || 'qwen3-vl:30b');
  const [selectedTextModel, setSelectedTextModel] = useState(settings.ollama_text_model || 'qwen3:14b');
  const [forceDetailedPrompt, setForceDetailedPrompt] = useState<boolean>(settings.force_detailed_prompt === 'true');

  // System VRAM
  const [vramGb, setVramGb] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      onFetchModels().catch(() => {});
      invoke<number>('get_system_vram_gb')
        .then((gb: number) => setVramGb(gb))
        .catch(() => setVramGb(0.0));
    }
  }, [open]);

  // Ollama Model Download State
  const [confirmDownloadModal, setConfirmDownloadModal] = useState<{
    model: RecommendedModel;
    targetType: 'vlm' | 'text';
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<OllamaPullProgressPayload | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Gemini
  const [geminiModel, setGeminiModel] = useState(settings.gemini_model || 'gemini-2.0-flash');
  const [geminiTextModel, setGeminiTextModel] = useState(settings.gemini_text_model || 'gemini-3.5-flash-lite');
  const [geminiApiKey, setGeminiApiKey] = useState('');

  // OpenAI
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState(settings.openai_base_url || 'https://api.openai.com/v1');
  const [openaiModel, setOpenaiModel] = useState(settings.openai_model || 'gpt-4o-mini');
  const [openaiApiKey, setOpenaiApiKey] = useState('');

  // Claude
  const [claudeModel, setClaudeModel] = useState(settings.claude_model || 'claude-3-5-sonnet-20241022');
  const [claudeTextModel, setClaudeTextModel] = useState(settings.claude_text_model || 'claude-3-5-haiku-20241022');
  const [claudeApiKey, setClaudeApiKey] = useState('');

  // External LLM Settings
  const [extMaxBatchItems, setExtMaxBatchItems] = useState(settings.ext_llm_max_batch_items || '50');
  const [extRetryEnabled, setExtRetryEnabled] = useState(settings.ext_llm_retry_enabled !== 'false');
  const [extRetryAttempts, setExtRetryAttempts] = useState(settings.ext_llm_retry_max_attempts || '3');

  // General Settings
  const [uiLanguage, setUiLanguage] = useState<'ja' | 'en'>((settings.ui_language as any) || 'ja');
  const [ffmpegNoticeEnabled, setFfmpegNoticeEnabled] = useState<boolean>(settings.ffmpeg_notice_enabled !== 'false');

  const [loadingModels, setLoadingModels] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedStatus, setSavedStatus] = useState(false);
  const [unloadedStatus, setUnloadedStatus] = useState(false);

  useEffect(() => {
    if (settings.llm_provider) setProvider(settings.llm_provider);
    if (settings.ollama_url) setOllamaUrl(settings.ollama_url);
    if (settings.ollama_model) setSelectedVlmModel(settings.ollama_model);
    if (settings.ollama_text_model) setSelectedTextModel(settings.ollama_text_model);
    if (settings.force_detailed_prompt !== undefined) setForceDetailedPrompt(settings.force_detailed_prompt === 'true');

    if (settings.gemini_model) setGeminiModel(settings.gemini_model);
    if (settings.gemini_text_model) setGeminiTextModel(settings.gemini_text_model);

    if (settings.openai_base_url) setOpenaiBaseUrl(settings.openai_base_url);
    if (settings.openai_model) setOpenaiModel(settings.openai_model);

    if (settings.claude_model) setClaudeModel(settings.claude_model);
    if (settings.claude_text_model) setClaudeTextModel(settings.claude_text_model);

    if (settings.ext_llm_max_batch_items) setExtMaxBatchItems(settings.ext_llm_max_batch_items);
    if (settings.ext_llm_retry_enabled !== undefined) setExtRetryEnabled(settings.ext_llm_retry_enabled === 'true');
    if (settings.ext_llm_retry_max_attempts) setExtRetryAttempts(settings.ext_llm_retry_max_attempts);
    if (settings.ui_language) setUiLanguage(settings.ui_language as any);
    if (settings.ffmpeg_notice_enabled !== undefined) setFfmpegNoticeEnabled(settings.ffmpeg_notice_enabled !== 'false');

    // Fetch API keys from Windows Credential Store
    invoke<string>('get_provider_api_key', { provider: 'gemini' })
      .then((key) => setGeminiApiKey(key || ''))
      .catch(() => { });
    invoke<string>('get_provider_api_key', { provider: 'openai' })
      .then((key) => setOpenaiApiKey(key || ''))
      .catch(() => { });
    invoke<string>('get_provider_api_key', { provider: 'claude' })
      .then((key) => setClaudeApiKey(key || ''))
      .catch(() => { });
  }, [settings, open]);

  if (!open) return null;

  const handleRefreshModels = async () => {
    setLoadingModels(true);
    await onFetchModels();
    setLoadingModels(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateSetting('llm_provider', provider);
      await onUpdateSetting('ollama_url', ollamaUrl);
      await onUpdateSetting('ollama_model', selectedVlmModel);
      await onUpdateSetting('ollama_text_model', selectedTextModel);
      await onUpdateSetting('force_detailed_prompt', forceDetailedPrompt ? 'true' : 'false');

      await onUpdateSetting('gemini_model', geminiModel);
      await onUpdateSetting('gemini_text_model', geminiTextModel);

      await onUpdateSetting('openai_base_url', openaiBaseUrl);
      await onUpdateSetting('openai_model', openaiModel);

      await onUpdateSetting('claude_model', claudeModel);
      await onUpdateSetting('claude_text_model', claudeTextModel);

      await onUpdateSetting('ext_llm_max_batch_items', extMaxBatchItems);
      await onUpdateSetting('ext_llm_retry_enabled', extRetryEnabled ? 'true' : 'false');
      await onUpdateSetting('ext_llm_retry_max_attempts', extRetryAttempts);
      await onUpdateSetting('ui_language', uiLanguage);
      await onUpdateSetting('ffmpeg_notice_enabled', ffmpegNoticeEnabled ? 'true' : 'false');

      // Save API keys to OS Secure Store
      await invoke('save_provider_api_key', { provider: 'gemini', apiKey: geminiApiKey });
      await invoke('save_provider_api_key', { provider: 'openai', apiKey: openaiApiKey });
      await invoke('save_provider_api_key', { provider: 'claude', apiKey: claudeApiKey });

      setSavedStatus(true);
      setTimeout(() => {
        setSavedStatus(false);
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (e) {
      console.error('Failed to save settings:', e);
      setIsSaving(false);
    }
  };

  const handleManualUnload = async () => {
    if (onUnloadModel) {
      await onUnloadModel();
      setUnloadedStatus(true);
      setTimeout(() => setUnloadedStatus(false), 2000);
    }
  };

  const handleSelectPreset = async (item: RecommendedModel, targetType: 'vlm' | 'text') => {
    const installedModelName = availableModels.find((m) => isModelInstalled(item.name, [m]));
    if (installedModelName) {
      if (targetType === 'vlm') {
        setSelectedVlmModel(installedModelName);
      } else {
        setSelectedTextModel(installedModelName);
      }
    } else {
      setConfirmDownloadModal({ model: item, targetType });
    }
  };

  const handleStartDownload = async () => {
    if (!confirmDownloadModal) return;
    const targetModel = confirmDownloadModal.model;
    const targetType = confirmDownloadModal.targetType;
    setConfirmDownloadModal(null);

    setIsDownloading(true);
    setDownloadProgress({
      model: targetModel.name,
      status: 'ダウンロードを開始しています...',
      completed: 0,
      total: 0,
      percent: 0,
      done: false,
    });

    const unlistenPromise = listen<OllamaPullProgressPayload>('ollama-pull-progress', async (event) => {
      const payload = event.payload;
      setDownloadProgress(payload);
      if (payload.done) {
        setIsDownloading(false);
        if (!payload.error && payload.percent >= 99) {
          await onFetchModels();
          if (targetType === 'vlm') {
            setSelectedVlmModel(targetModel.name);
          } else {
            setSelectedTextModel(targetModel.name);
          }
        }
      }
    });

    try {
      await invoke('pull_ollama_model', { modelName: targetModel.name });
    } catch (err: any) {
      console.error('Pull model error:', err);
    } finally {
      unlistenPromise.then((unlisten) => unlisten());
    }
  };

  const handleCancelDownload = async () => {
    try {
      await invoke('cancel_ollama_pull');
      setIsDownloading(false);
      setDownloadProgress(null);
    } catch (e) {
      console.error('Cancel pull error:', e);
    }
  };

  // Determine best recommended VLM model based on system VRAM
  const getBestVlmModelName = () => {
    if (!vramGb || vramGb <= 0) return null;
    if (vramGb >= 20.0) return 'qwen3-vl:30b';
    if (vramGb >= 12.0) return 'gemma4:12b';
    if (vramGb >= 6.0) return 'qwen3-vl:8b';
    return 'qwen3-vl:4b';
  };
  const bestVlmName = getBestVlmModelName();

  // Determine best recommended Text model based on system VRAM
  const getBestTextModelName = () => {
    if (!vramGb || vramGb <= 0) return null;
    if (vramGb >= 12.0) return 'qwen3:14b';
    if (vramGb >= 6.0) return 'qwen2.5:7b';
    return 'qwen2.5:3b';
  };
  const bestTextName = getBestTextModelName();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl shadow-2xl border border-indigo-500/30 flex flex-col max-h-[90vh] overflow-y-auto select-none">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{t('settings.title', '設定')}</h3>
              <p className="text-xs text-slate-400">Configure LLM Provider & Analysis Parameters</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* LLM Provider Selection */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              <label className="text-xs font-semibold text-slate-300">
                {t('settings.provider_label', 'LLMプロバイダー選択')}
              </label>
              <TooltipHelp text={t('settings.provider_help', 'メディアの解析やタグ生成に使用するAIエンジンを選択します。Ollamaがローカル動作の標準プロバイダーです。')} />
            </div>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
            >
              <option value="ollama">Ollama</option>
              <option value="gemini">Google Gemini API [Unsupported]</option>
              <option value="openai">OpenAI API [Unsupported]</option>
              <option value="claude">Anthropic Claude API [Unsupported]</option>
            </select>
          </div>

          {/* General App Settings (Language & Notices - Vertical Layout) */}
          <div className="p-4 bg-slate-900/50 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">{t('settings.general', '一般設定')}</h4>

            <div className="flex flex-col gap-3.5">
              {/* Language Selection */}
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    {t('settings.language', 'UI表示言語')}
                  </label>
                  <TooltipHelp text={t('settings.language_help', 'アプリケーション全体の表示言語（日本語 / English）を切り替えます。')} />
                </div>
                <select
                  value={uiLanguage}
                  onChange={(e) => setUiLanguage(e.target.value as any)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                >
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="en">English (US)</option>
                </select>
              </div>

              {/* FFmpeg Notice Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <label className="text-[11px] font-semibold text-slate-300 cursor-pointer select-none flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ffmpegNoticeEnabled}
                    onChange={(e) => setFfmpegNoticeEnabled(e.target.checked)}
                    className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>{t('settings.ffmpeg_notice', 'FFmpeg未インストール時のアナウンス通知を表示')}</span>
                </label>
                <TooltipHelp align="right" text={t('settings.ffmpeg_notice_help', '動画解析に必要なFFmpegが見つからない場合のアナウンス通知アイコンの表示を切り替えます。')} />
              </div>
            </div>
          </div>

          {/* Privacy Disclaimer Banner for External LLMs */}
          {provider !== 'ollama' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2 text-amber-300 text-[11px] leading-relaxed">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-amber-200">⚠️ 非公式機能 & プライバシー免責事項: </span>
                外部LLMプロバイダー利用時のデータ送信およびプライバシーの取り扱いは**選択したプロバイダーの利用規約に準拠**します。
                Loma 開発者は外部プロバイダーへのデータ送信や第三者サーバーでのデータ取り扱い・保管について**一切の責任を負いません**。
              </div>
            </div>
          )}

          {/* Provider Specific Settings (Ollama) */}
          {provider === 'ollama' && (
            <div className="space-y-4 p-4 bg-slate-900/50 rounded-xl border border-white/5">
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Server className="w-3.5 h-3.5 text-indigo-400" />
                  <label className="text-xs font-semibold text-slate-300">
                    {t('settings.ollama_url', 'Ollama API エンドポイント URL')}
                  </label>
                  <TooltipHelp text={t('settings.ollama_url_help', 'ローカルまたはリモートで稼働中のOllamaサーバーの接続URLです（デフォルト: http://localhost:11434）。')} />
                </div>
                <input
                  type="text"
                  value={ollamaUrl}
                  onChange={(e) => setOllamaUrl(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50 font-mono"
                />
              </div>

              {/* Ollama Not Installed Warning Banner */}
              {availableModels.length === 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    {t('settings.ollama_not_installed', 'Ollamaがインストールされていないか、サービスが起動していません。ローカルVLM機能を使用するにはOllamaを起動またはインストールしてください。')}
                  </div>
                </div>
              )}

              {/* Download Progress Banner inside Settings */}
              {(isDownloading || downloadProgress) && (
                <div className="p-3.5 bg-slate-900 border border-indigo-500/40 rounded-xl space-y-2.5 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Loader2 className={`w-3.5 h-3.5 text-indigo-400 ${isDownloading ? 'animate-spin' : ''}`} />
                      ダウンロード中: <span className="font-mono text-indigo-300">{downloadProgress?.model}</span>
                    </span>
                    <span className="font-mono font-bold text-indigo-400">
                      {downloadProgress?.percent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-200"
                      style={{ width: `${Math.max(2, downloadProgress?.percent || 0)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[280px]" title={downloadProgress?.status}>
                      {downloadProgress?.status}
                    </span>
                    <span className="font-mono">
                      {downloadProgress?.completed ? (downloadProgress.completed / (1024 * 1024)).toFixed(0) : 0} MB /{' '}
                      {downloadProgress?.total ? (downloadProgress.total / (1024 * 1024)).toFixed(0) : 0} MB
                    </span>
                  </div>

                  {isDownloading && (
                    <div className="flex justify-end pt-1">
                      <button
                        onClick={handleCancelDownload}
                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        ダウンロードをキャンセル
                      </button>
                    </div>
                  )}

                  {downloadProgress?.done && downloadProgress.error && (
                    <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs">
                      ⚠️ {downloadProgress.error}
                    </div>
                  )}

                  {downloadProgress?.done && !downloadProgress.error && (
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-1.5 font-semibold">
                      <Check className="w-4 h-4 text-emerald-400" />
                      ダウンロードが完了し、モデルとして自動設定されました！
                    </div>
                  )}
                </div>
              )}

              {/* Vision VLM Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                    <label className="text-xs font-semibold text-slate-300">
                      {t('settings.vlm_model', '使用するVLM (視覚言語) モデル')}
                    </label>
                    <TooltipHelp text={t('settings.vlm_model_help', '画像や動画フレームの解釈・説明文の自動作成を行う視覚言語モデル（例: minicpm-v, llama3.2-vision）を選択します。')} />
                  </div>
                  <button
                    onClick={handleRefreshModels}
                    disabled={loadingModels}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                    モデル一覧取得
                  </button>
                </div>
                <select
                  value={selectedVlmModel}
                  onChange={(e) => setSelectedVlmModel(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {availableModels.length === 0 ? (
                    <option value={selectedVlmModel}>{selectedVlmModel} (Current)</option>
                  ) : (
                    availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m} {m.includes('qwen3-vl') || m.includes('llava') || m.includes('vision') || m.includes('gemma4') ? '⭐ [Vision VLM]' : ''}
                      </option>
                    ))
                  )}
                </select>

                {/* Force Detailed Prompt Mode Checkbox */}
                <div className="mt-3 p-3 bg-slate-950/60 rounded-xl border border-white/5 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 cursor-pointer select-none flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={forceDetailedPrompt}
                      onChange={(e) => setForceDetailedPrompt(e.target.checked)}
                      className="rounded border-white/10 bg-slate-950 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span>{t('settings.force_detailed_mode', '高精度プロンプトモード (DETAILED) を強制適用する')}</span>
                  </label>
                  <TooltipHelp align="right" text={t('settings.force_detailed_help', '軽量モデル（8B未満など）で高精度モードを強制すると、モデルが高度な文脈指示や構造化JSONを解釈できず解析エラーの原因となる場合があります。OFF推奨（判定失敗時に自動で軽量モードへフォールバックします）。')} />
                </div>

                {/* VLM Recommended Preset Cards */}
                <div className="mt-3 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      おすすめ VLM プリセット (クリックして選択 / 自動DL)
                    </span>
                    {vramGb !== null && vramGb > 0 && (
                      <span className="text-[10px] text-indigo-300 font-mono flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-indigo-400" /> 検出VRAM: ~{vramGb.toFixed(1)} GB
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {RECOMMENDED_VLM_MODELS.map((item) => {
                      const isInstalled = isModelInstalled(item.name, availableModels);
                      const isSelected = isModelSelected(item.name, selectedVlmModel);
                      const isBestMatch = bestVlmName !== null && item.name === bestVlmName;

                      const badgeColor =
                        item.badge === 'Lightweight'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : item.badge === 'Standard'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20';

                      return (
                        <div
                          key={item.name}
                          onClick={() => handleSelectPreset(item, 'vlm')}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between relative overflow-hidden ${
                            isBestMatch
                              ? 'bg-indigo-950/80 border-indigo-500 shadow-xl shadow-indigo-500/20 hover:border-indigo-500/30 hover:bg-slate-800/50'
                              : isSelected
                              ? 'bg-indigo-950/60 border-indigo-500/60 shadow-lg shadow-indigo-500/10 hover:border-indigo-500/30 hover:bg-slate-800/50'
                              : 'bg-slate-900/80 border-white/5 hover:border-indigo-500/30 hover:bg-slate-800/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeColor}`}>
                                  {item.badgeJa}
                                </span>
                                {isBestMatch && (
                                  <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                                    {t('settings.recommended_vram_best', '★ VRAM適合のおすすめ')}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">{item.size}</span>
                            </div>
                            <div className="text-xs font-bold text-white font-mono mt-0.5">{item.name}</div>
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                              {item.description}
                            </p>
                          </div>

                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            {loadingModels ? (
                              <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" /> 読み込み中...
                              </span>
                            ) : isDownloading && downloadProgress?.model === item.name ? (
                              <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> インストール中...
                              </span>
                            ) : isInstalled ? (
                              <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> インストール済
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
                                <Download className="w-3 h-3" /> 要DL
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-bold">
                                選択中
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Text LLM Selection & Presets */}
              <div className="pt-2 border-t border-white/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-indigo-400" />
                  <label className="text-xs font-semibold text-slate-300">
                    {t('settings.text_model', 'テキスト解析・タグ翻訳モデル')}
                  </label>
                  <TooltipHelp text={t('settings.text_model_help', 'VLMが生成した説明文から日本語/英語のタグ構造化やカテゴリ分類を行う言語モデル（例: qwen2.5, llama3.1）を選択します。')} />
                </div>
                <select
                  value={selectedTextModel}
                  onChange={(e) => setSelectedTextModel(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500/50"
                >
                  {availableModels.length === 0 ? (
                    <option value={selectedTextModel}>{selectedTextModel} (Current)</option>
                  ) : (
                    availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))
                  )}
                </select>

                {/* Text LLM Recommended Preset Cards */}
                <div className="mt-2.5 space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      おすすめ Text LLM プリセット (クリックして選択 / 自動DL)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {RECOMMENDED_TEXT_MODELS.map((item) => {
                      const isInstalled = isModelInstalled(item.name, availableModels);
                      const isSelected = isModelSelected(item.name, selectedTextModel);
                      const isBestMatch = bestTextName !== null && item.name === bestTextName;

                      const badgeColor =
                        item.badge === 'Lightweight'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : item.badge === 'Standard'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20';

                      return (
                        <div
                          key={item.name}
                          onClick={() => handleSelectPreset(item, 'text')}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between relative overflow-hidden ${
                            isBestMatch
                              ? 'bg-indigo-950/80 border-indigo-500 shadow-xl shadow-indigo-500/20 hover:border-indigo-500/30 hover:bg-slate-800/50'
                              : isSelected
                              ? 'bg-indigo-950/60 border-indigo-500/60 shadow-lg shadow-indigo-500/10 hover:border-indigo-500/30 hover:bg-slate-800/50'
                              : 'bg-slate-900/80 border-white/5 hover:border-indigo-500/30 hover:bg-slate-800/50'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeColor}`}>
                                  {item.badgeJa}
                                </span>
                                {isBestMatch && (
                                  <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                                    {t('settings.recommended_vram_best', '★ VRAM適合のおすすめ')}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono shrink-0">{item.size}</span>
                            </div>
                            <div className="text-xs font-bold text-white font-mono mt-0.5">{item.name}</div>
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight">
                              {item.description}
                            </p>
                          </div>

                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            {loadingModels ? (
                              <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" /> 読み込み中...
                              </span>
                            ) : isDownloading && downloadProgress?.model === item.name ? (
                              <span className="text-[10px] font-medium text-amber-400 flex items-center gap-1">
                                <Loader2 className="w-3 h-3 animate-spin text-amber-400" /> インストール中...
                              </span>
                            ) : isInstalled ? (
                              <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-1">
                                <Check className="w-3 h-3" /> インストール済
                              </span>
                            ) : (
                              <span className="text-[10px] font-medium text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
                                <Download className="w-3 h-3" /> 要DL
                              </span>
                            )}
                            {isSelected && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-indigo-600 text-white rounded font-bold">
                                選択中
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Manual VRAM Unload for Ollama */}
          {provider === 'ollama' && onUnloadModel && (
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300 font-medium">手動VRAMメモリ解放</span>
                <TooltipHelp text={t('settings.unload_vram_help', 'Ollamaでロード中のモデルをVRAMから即座にメモリ解放（アンロード）します。WebUIや他のアプリケーション等で同一モデルを使用中の場合でも、VRAMからアンロードされます。')} />
              </div>
              <button
                onClick={handleManualUnload}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                {unloadedStatus ? '解放完了!' : 'VRAMメモリ解放'}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-white/10 pt-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-slate-400 hover:text-white transition cursor-pointer"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-900/30 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 text-white animate-spin" /> 保存中...
              </>
            ) : savedStatus ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" /> 保存完了!
              </>
            ) : (
              '設定を保存'
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Downloading Ollama Model */}
      {confirmDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">モデルのダウンロード確認</h4>
                <p className="text-xs text-slate-400">Ollamaモデルをローカルにダウンロードします</p>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-white/5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-indigo-300 font-mono">{confirmDownloadModal.model.name}</span>
                <span className="text-xs font-mono px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-md">
                  {confirmDownloadModal.model.size}
                </span>
              </div>
              <p className="text-xs text-slate-300">{confirmDownloadModal.model.description}</p>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              ※ ネットワーク回線の速度により、ダウンロードには数分〜十分程度かかる場合があります。<br />
              ※ ダウンロード中も設定画面やバックグラウンドで進捗状況を確認できます。
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                onClick={() => setConfirmDownloadModal(null)}
                className="px-3.5 py-1.5 rounded-xl border border-white/10 hover:bg-slate-800 text-xs font-medium text-slate-300 transition cursor-pointer"
              >
                キャンセル
              </button>
              <button
                onClick={handleStartDownload}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/30 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                ダウンロード開始
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
