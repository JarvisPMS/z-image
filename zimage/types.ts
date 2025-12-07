export interface GeneratedImage {
  url: string;
  prompt: string;
  createdAt: number;
}

export interface ApiError {
  message: string;
  code?: string;
}

export interface GenerationConfig {
  apiKey: string;
  model: string;
  width?: number;
  height?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
