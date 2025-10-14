export interface GroundingSupport {
  start_index: number;
  end_index: number;
  text: string;
  reference_indices: number[];
}

export interface Reference {
  id: number;
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export interface Message {
  message_id?: string;
  role: 'user' | 'ai';
  content: string;
  references?: Reference[];
  search_queries?: string[];
  grounding_supports?: GroundingSupport[];
  url_context_urls?: string[];
  grounded?: boolean;
  created_at: string;
}

export interface Conversation {
  conversation_id: string;
  title?: string;
  messages: Message[];
  created_at: string;
  last_updated: string;
  starred: boolean;
}

export interface ConversationSummary {
  conversation_id: string;
  title?: string;
  created_at: string;
  last_updated: string;
  starred: boolean;
  message_count: number;
  preview?: string;
}

export interface ChatRequest {
  message: string;
  enable_search?: boolean;
  url_context?: string[];
  model?: string;
  encrypted?: boolean;
}

export interface SSEEvent {
  type: 'conversation_start' | 'chunk' | 'encrypted_chunk' | 'done' | 'encrypted_done' | 'error';
  content?: string;
  encrypted_data?: string;
  conversation_id?: string;
  references?: Reference[];
  search_queries?: string[];
  grounding_supports?: GroundingSupport[];
  url_context_urls?: string[];
  grounded?: boolean;
  error?: string;
}