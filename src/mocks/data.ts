import { MediaItem, TagItem, ScanFolderItem } from '../types';

interface CategoryDef {
  category: string;
  parentFolder: string;
  tags: { name: string; name_ja: string }[];
  count: number;
}

const CATEGORY_DEFS: CategoryDef[] = [
  { category: 'screenshot', parentFolder: 'Screenshots', tags: [{ name: 'ui', name_ja: 'UI' }, { name: 'app', name_ja: 'アプリ' }], count: 3 },
  { category: 'document', parentFolder: 'WorkDocs', tags: [{ name: 'text', name_ja: 'テキスト' }, { name: 'paper', name_ja: '書類' }], count: 3 },
  { category: 'landscape', parentFolder: '2024_Travel', tags: [{ name: 'nature', name_ja: '自然' }, { name: 'sky', name_ja: '空' }], count: 3 },
  { category: 'food', parentFolder: '2024_Travel', tags: [{ name: 'meal', name_ja: '食事' }, { name: 'dessert', name_ja: 'デザート' }], count: 3 },
  { category: 'character', parentFolder: 'Portraits', tags: [{ name: 'person', name_ja: '人物' }, { name: 'portrait', name_ja: 'ポートレート' }], count: 3 },
  { category: 'text_heavy', parentFolder: 'Manga', tags: [{ name: 'manga', name_ja: '漫画' }, { name: 'subtitle', name_ja: '字幕' }], count: 2 },
  { category: 'tech', parentFolder: 'WorkDocs', tags: [{ name: 'device', name_ja: 'デバイス' }, { name: 'code', name_ja: 'コード' }], count: 2 },
  { category: 'other', parentFolder: 'Misc', tags: [{ name: 'misc', name_ja: 'その他' }], count: 2 },
];

function buildMedia(): MediaItem[] {
  const items: MediaItem[] = [];
  let id = 1;
  let fileIndex = 1;

  for (const def of CATEGORY_DEFS) {
    for (let i = 0; i < def.count; i++) {
      const fileName = `mock_media_${fileIndex}.jpg`;
      items.push({
        id: id++,
        file_path: `mock-asset://${fileName}`,
        parent_folder: def.parentFolder,
        thumbnail_path: `mock-asset://${fileName}`,
        file_size: 200_000 + fileIndex * 1234,
        analysis_status: 'completed',
        categories: [def.category],
        tags: def.tags,
      });
      fileIndex++;
    }
  }

  // 未解析(pending)の2件 — タグ・カテゴリなしで「未解析」バッジ確認用
  for (let i = 0; i < 2; i++) {
    const fileName = `mock_media_${fileIndex}.jpg`;
    items.push({
      id: id++,
      file_path: `mock-asset://${fileName}`,
      parent_folder: 'Screenshots',
      thumbnail_path: `mock-asset://${fileName}`,
      file_size: 180_000 + fileIndex * 999,
      analysis_status: 'pending',
      categories: [],
      tags: [],
    });
    fileIndex++;
  }

  // 解析失敗の1件 — エラー表示確認用
  {
    const fileName = `mock_media_${fileIndex}.jpg`;
    items.push({
      id: id++,
      file_path: `mock-asset://${fileName}`,
      parent_folder: 'Misc',
      thumbnail_path: `mock-asset://${fileName}`,
      file_size: 210_000,
      analysis_status: 'failed',
      analysis_error: 'Ollama への接続がタイムアウトしました(モックデータ)',
      categories: [],
      tags: [],
    });
    fileIndex++;
  }

  return items;
}

export const MOCK_MEDIA: MediaItem[] = buildMedia();

export const MOCK_MEDIA_FILE_COUNT = MOCK_MEDIA.length;

function buildTags(): TagItem[] {
  const counts = new Map<string, { name_ja?: string; is_category: boolean; count: number }>();

  for (const item of MOCK_MEDIA) {
    for (const cat of item.categories) {
      const entry = counts.get(cat) || { is_category: true, count: 0 };
      entry.count++;
      counts.set(cat, entry);
    }
    for (const tag of item.tags) {
      const entry = counts.get(tag.name) || { name_ja: tag.name_ja, is_category: false, count: 0 };
      entry.count++;
      counts.set(tag.name, entry);
    }
  }

  let id = 1;
  return Array.from(counts.entries()).map(([name, v]) => ({
    id: id++,
    name,
    name_ja: v.name_ja,
    is_category: v.is_category,
    count: v.count,
  }));
}

export const MOCK_TAGS: TagItem[] = buildTags();

export const MOCK_PARENT_FOLDERS: string[] = Array.from(new Set(MOCK_MEDIA.map((m) => m.parent_folder)));

export const MOCK_SCAN_FOLDERS: ScanFolderItem[] = [
  { id: 1, path: 'C:\\Users\\demo\\Pictures\\2024_Travel', created_at: 1732000000 },
  { id: 2, path: 'C:\\Users\\demo\\Pictures\\Screenshots', created_at: 1732500000 },
];

export const MOCK_SETTINGS: Record<string, string> = {
  llm_provider: 'ollama',
  ollama_url: 'http://localhost:11434',
  ollama_model: 'qwen3-vl:8b',
  ollama_text_model: 'qwen2.5:7b',
  force_detailed_prompt: 'false',
  ui_language: 'ja',
  ffmpeg_notice_enabled: 'true',
};

export const MOCK_AVAILABLE_MODELS: string[] = ['qwen3-vl:8b', 'qwen3-vl:4b', 'qwen2.5:7b'];

export const MOCK_VRAM_GB = 12.0;

export const MOCK_LOGS = [
  '[INFO] Loma started (mock mode)',
  '[INFO] Loaded 24 mock media items',
  '[INFO] Ollama model: qwen3-vl:8b',
].join('\n');
