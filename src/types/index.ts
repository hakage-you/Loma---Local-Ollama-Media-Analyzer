export type TagKind = 'basic' | 'descriptive';

export interface TagPairItem {
  name: string;
  name_ja?: string;
  kind: TagKind;
}

export interface MediaItem {
  id: number;
  file_path: string;
  parent_folder: string;
  thumbnail_path: string;
  file_size: number;
  analysis_status: 'pending' | 'completed' | 'failed';
  analysis_error?: string;
  categories: string[];
  tags: TagPairItem[];
}

export interface TagItem {
  id: number;
  name: string;
  name_ja?: string;
  is_category: boolean;
  count: number;
  kind: TagKind;
}

export interface ScanFolderItem {
  id: number;
  path: string;
  created_at: number;
}

export interface ProgressPayload {
  total: number;
  current: number;
  current_file: string;
  status: string;
  error_count: number;
  is_paused?: boolean;
}

export interface MergeSuggestion {
  id: string;
  target_tag: TagItem;
  source_tags: TagItem[];
  reason: string;
  confidence: string;
  sample_thumbnails?: string[];
  total_images_count?: number;
}

export interface OllamaPullProgressPayload {
  model: string;
  status: string;
  completed: number;
  total: number;
  percent: number;
  done: boolean;
  error?: string;
}

// --- 詳細検索用の型定義 ---

/** バックエンドに送信する論理フィルタツリー */
export type TagFilterNode =
  | { type: 'tag'; value: string }
  | { type: 'and'; children: TagFilterNode[] }
  | { type: 'or'; children: TagFilterNode[] }
  | { type: 'not'; child: TagFilterNode };

/** 詳細検索UIのグループ1つ */
export interface SearchGroup {
  id: string;
  operator: 'and' | 'or' | 'not';
  tags: string[];
}

// --- タグ付与粒度設定用の型定義 ---

export type TagGranularity = 'atomic' | 'balanced' | 'descriptive';

export interface TagPair {
  en: string;
  ja: string;
}

export interface GranularityComparisonItem {
  granularity: TagGranularity;
  categories: string[];
  tags: TagPair[];
  descriptive_tags: TagPair[];
  error?: string;
}

