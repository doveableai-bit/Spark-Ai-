export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  ERROR = 'error'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string; // Text content or Base64 Image string
  timestamp: number;
  metadata?: {
    prompt?: string;
    aspectRatio?: string;
    groundingUrls?: Array<{ title: string; uri: string }>;
  };
}

export interface AppState {
  messages: ChatMessage[];
  isLoading: boolean;
  mode: 'chat' | 'image' | 'search';
  input: string;
  selectedAspectRatio: string;
}

export interface Attachment {
  data: string;
  mimeType: string;
  id: string;
}

export const ASPECT_RATIOS = [
  { label: '1:1 (Square)', value: '1:1' },
  { label: '16:9 (Landscape)', value: '16:9' },
  { label: '9:16 (Portrait)', value: '9:16' },
  { label: '4:3 (Classic)', value: '4:3' },
  { label: '3:4 (Tall)', value: '3:4' },
];

export const IMAGE_STYLES = [
  { label: 'Default (Smart)', value: 'default' },
  { label: 'Photorealistic', value: 'photorealistic' },
  { label: 'Anime', value: 'anime style' },
  { label: 'Cartoon', value: 'cartoon style' },
  { label: '3D Render', value: '3d render, octane render' },
  { label: 'Oil Painting', value: 'oil painting' },
  { label: 'Pencil Sketch', value: 'pencil sketch' },
  { label: 'Cyberpunk', value: 'cyberpunk, neon' },
  { label: 'Watercolor', value: 'watercolor painting' },
];