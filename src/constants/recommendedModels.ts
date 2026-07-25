export interface RecommendedModel {
  name: string;
  badge: 'Lightweight' | 'Standard' | 'High Performance';
  badgeJa: '軽量' | '標準' | '高精度';
  size: string;
  description: string;
}

export const RECOMMENDED_VLM_MODELS: RecommendedModel[] = [
  {
    name: 'qwen3-vl:4b',
    badge: 'Lightweight',
    badgeJa: '軽量',
    size: '~2.8 GB',
    description: '高速かつ低VRAMで動作する最新小型Visionモデル',
  },
  {
    name: 'qwen3-vl:8b',
    badge: 'Standard',
    badgeJa: '標準',
    size: '~5.5 GB',
    description: '精度と処理速度のバランスに優れた推奨VLM',
  },
  {
    name: 'gemma4:12b',
    badge: 'Standard',
    badgeJa: '標準',
    size: '~8.0 GB',
    description: 'Google Gemma 4ベースの高性能マルチモーダルモデル',
  },
  {
    name: 'qwen3-vl:30b',
    badge: 'High Performance',
    badgeJa: '高精度',
    size: '~19 GB',
    description: '最高水準の画像・動画認識が可能なフラッグシップモデル',
  },
];

export const RECOMMENDED_TEXT_MODELS: RecommendedModel[] = [
  {
    name: 'qwen2.5:3b',
    badge: 'Lightweight',
    badgeJa: '軽量',
    size: '~1.9 GB',
    description: '高速で軽量なテキスト処理・タグ統合用モデル',
  },
  {
    name: 'qwen2.5:7b',
    badge: 'Standard',
    badgeJa: '標準',
    size: '~4.7 GB',
    description: '自然な日本語理解と高いタグ統合能力を持つ標準モデル',
  },
  {
    name: 'qwen3:14b',
    badge: 'High Performance',
    badgeJa: '高精度',
    size: '~9.0 GB',
    description: '高度なカテゴリ分けと高精度テキスト処理用モデル',
  },
];
