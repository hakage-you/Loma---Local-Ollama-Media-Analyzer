import {
  MOCK_MEDIA,
  MOCK_TAGS,
  MOCK_PARENT_FOLDERS,
  MOCK_SCAN_FOLDERS,
  MOCK_SETTINGS,
  MOCK_AVAILABLE_MODELS,
  MOCK_VRAM_GB,
  MOCK_LOGS,
} from './data';
import { MediaItem, TagItem } from '../types';

// 開発中のスクリーンショット撮影用モック(`vite --mode mock` 時のみ有効)。
// 実際の @tauri-apps/api/core の invoke / convertFileSrc を置き換える。

let mediaState: MediaItem[] = MOCK_MEDIA.map((m) => ({ ...m, tags: [...m.tags], categories: [...m.categories] }));
let tagState: TagItem[] = MOCK_TAGS.map((t) => ({ ...t }));
let settingsState: Record<string, string> = { ...MOCK_SETTINGS };
let scanFoldersState = MOCK_SCAN_FOLDERS.map((f) => ({ ...f }));
let scanning = false;

function matchesFilters(item: MediaItem, args: Record<string, any>): boolean {
  const categoryFilter: string[] | null = args.categoryFilter ?? null;
  const tagFilter: string[] | null = args.tagFilter ?? null;
  const parentFolderFilter: string | null = args.parentFolderFilter ?? null;
  const scanFolderFilter: string | null = args.scanFolderFilter ?? null;
  const statusFilter: string | null = args.statusFilter ?? null;
  const mediaTypeFilter: string | null = args.mediaTypeFilter ?? null;

  if (categoryFilter && categoryFilter.length > 0) {
    if (!categoryFilter.some((c) => item.categories.includes(c))) return false;
  }
  if (tagFilter && tagFilter.length > 0) {
    const itemTagNames = item.tags.map((t) => t.name);
    if (!tagFilter.some((t) => itemTagNames.includes(t))) return false;
  }
  if (parentFolderFilter && item.parent_folder !== parentFolderFilter) return false;
  if (scanFolderFilter && !item.file_path.includes(scanFolderFilter)) return false;
  if (statusFilter && statusFilter !== 'unanalyzed' && item.analysis_status !== statusFilter) return false;
  if (mediaTypeFilter && mediaTypeFilter !== 'all') {
    const isVideo = /\.(mp4|mov|webm|gif)$/i.test(item.file_path);
    if (mediaTypeFilter === 'video' && !isVideo) return false;
    if (mediaTypeFilter === 'image' && isVideo) return false;
  }
  return true;
}

const handlers: Record<string, (args: Record<string, any>) => any> = {
  get_media: (args) => mediaState.filter((item) => matchesFilters(item, args)),
  get_all_tags: () => tagState,
  get_parent_folders: () => MOCK_PARENT_FOLDERS,
  get_scan_folders: () => scanFoldersState,
  get_settings: () => settingsState,
  get_available_models: () => MOCK_AVAILABLE_MODELS,
  get_scan_status: () => scanning,
  get_app_logs: () => MOCK_LOGS,
  get_system_vram_gb: () => MOCK_VRAM_GB,
  update_setting: (args) => {
    settingsState = { ...settingsState, [args.key]: args.value };
  },
  remove_scan_folder: (args) => {
    scanFoldersState = scanFoldersState.filter((f) => f.id !== args.folderId);
  },
  add_tag_to_media: (args) => {
    const item = mediaState.find((m) => m.id === args.mediaId);
    if (item && !item.tags.some((t) => t.name === args.tagName)) {
      // 手動追加タグは常に basic 種別（バックエンド get_or_create_tag と同じ挙動）
      item.tags = [...item.tags, { name: args.tagName, name_ja: args.tagNameJa, kind: 'basic' }];
    }
    return { id: 0, name: args.tagName, name_ja: args.tagNameJa, is_category: false, count: 1, kind: 'basic' };
  },
  remove_tag_from_media: (args) => {
    const item = mediaState.find((m) => m.id === args.mediaId);
    if (item) item.tags = item.tags.filter((_, idx) => idx !== args.tagId);
  },
  start_scan: () => {
    scanning = false;
  },
  sync_folders: () => {},
  cancel_scan: () => {
    scanning = false;
  },
  suggest_tag_merges: () => [],
  get_provider_api_key: () => '',
  check_ffmpeg_installed: () => true,
  get_effective_prompt_type: (args) => {
    if (args.forceDetailed) return 'DETAILED';
    const provider = String(args.provider || '').toLowerCase();
    if (provider !== 'ollama') return 'DETAILED';
    const match = String(args.model || '').toLowerCase().match(/(\d+(?:\.\d+)?)b/);
    const paramSize = match ? parseFloat(match[1]) : null;
    return paramSize !== null && paramSize >= 10 ? 'DETAILED' : 'LIGHT';
  },
  compare_granularity_levels: () => [
    {
      granularity: 'atomic',
      categories: ['landscape'],
      tags: [
        { en: 'tree', ja: '木' },
        { en: 'water_drop', ja: '水滴' },
        { en: 'forest', ja: '森' },
      ],
      descriptive_tags: [],
    },
    {
      granularity: 'balanced',
      categories: ['landscape'],
      tags: [
        { en: 'tree', ja: '木' },
        { en: 'water_drop', ja: '水滴' },
        { en: 'forest', ja: '森' },
      ],
      descriptive_tags: [{ en: 'rain_soaked_tree', ja: '雨に濡れた木' }],
    },
    {
      granularity: 'descriptive',
      categories: ['landscape'],
      tags: [
        { en: 'tree', ja: '木' },
        { en: 'water_drop', ja: '水滴' },
        { en: 'rain', ja: '雨' },
        { en: 'leaf', ja: '葉' },
      ],
      descriptive_tags: [
        { en: 'rain_soaked_tree', ja: '雨に濡れた木' },
        { en: 'wet_undergrowth', ja: '濡れた下草' },
      ],
    },
  ],
};

export async function invoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  const handler = handlers[cmd];
  if (!handler) {
    console.warn(`[mock invoke] unhandled command "${cmd}"`, args);
    return undefined as unknown as T;
  }
  const result = handler(args);
  return result as T;
}

export function convertFileSrc(filePath: string, _protocol = 'asset'): string {
  const prefix = 'mock-asset://';
  if (filePath.startsWith(prefix)) {
    return `/mock-assets/${filePath.slice(prefix.length)}`;
  }
  return filePath;
}
