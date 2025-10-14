import { Conversation, ConversationSummary, ChatRequest } from '../types';
import EncryptionService, { EncryptedPayload } from './encryptionService';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

export class APIService {
  private static instance: APIService;
  
  static getInstance(): APIService {
    if (!APIService.instance) {
      APIService.instance = new APIService();
    }
    return APIService.instance;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('access_token');
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  private async handleAuthError(response: Response): Promise<void> {
    if (response.status === 401) {
      // Token might be expired, try to refresh
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshResponse.ok) {
            const { access_token } = await refreshResponse.json();
            localStorage.setItem('access_token', access_token);
            return; // Token refreshed successfully
          }
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
      
      // If refresh fails, clear tokens and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.reload();
    }
  }

  async getConversations(limit: number = 50, offset: number = 0): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/?limit=${limit}&offset=${offset}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to fetch conversations');
    }
    
    const encryptedData: EncryptedPayload = await response.json();
    
    // Decrypt the response if encryption is available
    if (EncryptionService.isAvailable()) {
      try {
        const decryptedData = await EncryptionService.decryptResponse(encryptedData);
        return decryptedData.conversations;
      } catch (error) {
        console.error('Failed to decrypt conversations response:', error);
        throw new Error('Failed to decrypt conversations data');
      }
    } else {
      // Fallback for development - treat as unencrypted
      console.warn('Encryption not available - treating response as unencrypted');
      return (encryptedData as any).conversations || [];
    }
  }

  async getConversation(conversationId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to fetch conversation');
    }
    
    const encryptedData: EncryptedPayload = await response.json();
    
    // Decrypt the response if encryption is available
    if (EncryptionService.isAvailable()) {
      try {
        return await EncryptionService.decryptResponse(encryptedData);
      } catch (error) {
        console.error('Failed to decrypt conversation response:', error);
        throw new Error('Failed to decrypt conversation data');
      }
    } else {
      // Fallback for development - treat as unencrypted
      console.warn('Encryption not available - treating response as unencrypted');
      return encryptedData as any;
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to delete conversation');
    }
  }

  async starConversation(conversationId: string, starred: boolean): Promise<void> {
    // Encrypt the payload if encryption is available
    let requestBody: string;
    if (EncryptionService.isAvailable()) {
      try {
        const encryptedPayload = await EncryptionService.encryptRequest({ starred });
        requestBody = JSON.stringify(encryptedPayload);
      } catch (error) {
        console.error('Failed to encrypt star request:', error);
        throw new Error('Failed to encrypt request data');
      }
    } else {
      // Fallback for development
      console.warn('Encryption not available - sending unencrypted request');
      requestBody = JSON.stringify({ starred });
    }

    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/star`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: requestBody,
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to star conversation');
    }
  }

  async renameConversation(conversationId: string, title: string): Promise<void> {
    // Encrypt the payload if encryption is available
    let requestBody: string;
    if (EncryptionService.isAvailable()) {
      try {
        const encryptedPayload = await EncryptionService.encryptRequest({ title });
        requestBody = JSON.stringify(encryptedPayload);
      } catch (error) {
        console.error('Failed to encrypt rename request:', error);
        throw new Error('Failed to encrypt request data');
      }
    } else {
      // Fallback for development
      console.warn('Encryption not available - sending unencrypted request');
      requestBody = JSON.stringify({ title });
    }

    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/title`, {
      method: 'PATCH',
      headers: this.getAuthHeaders(),
      body: requestBody,
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to rename conversation');
    }
  }

  async bulkDeleteNonstarred(): Promise<number> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/nonstarred`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to bulk delete conversations');
    }
    
    const encryptedData = await response.json();
    
    // Decrypt the response if encryption is available
    if (EncryptionService.isAvailable()) {
      try {
        const decryptedData = await EncryptionService.decryptResponse(encryptedData);
        return decryptedData.data.deleted_count;
      } catch (error) {
        console.error('Failed to decrypt bulk delete response:', error);
        throw new Error('Failed to decrypt bulk delete data');
      }
    }
    
    // Fallback for unencrypted response (should not happen in production)
    return encryptedData.data.deleted_count;
  }

  async createChatStream(message: string, conversationId?: string, enableSearch = false, model = 'gemini-2.5-flash'): Promise<EventSource> {
    const url = conversationId 
      ? `${API_BASE_URL}/api/chat/${conversationId}`
      : `${API_BASE_URL}/api/chat/`;
    
    const chatRequest: ChatRequest = { 
      message, 
      enable_search: enableSearch,
      model
    };
    
    // Encrypt the payload if encryption is available
    let requestBody: string;
    if (EncryptionService.isAvailable()) {
      try {
        const encryptedPayload = await EncryptionService.encryptRequest(chatRequest);
        requestBody = JSON.stringify(encryptedPayload);
      } catch (error) {
        console.error('Failed to encrypt chat request:', error);
        throw new Error('Failed to encrypt request data');
      }
    } else {
      // Fallback for development
      console.warn('Encryption not available - sending unencrypted request');
      requestBody = JSON.stringify(chatRequest);
    }
    
    // Send the POST request and get the streaming response
    const headers = {
      ...this.getAuthHeaders(),
      'Accept': 'text/event-stream'
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    });

    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Create a custom EventSource-like object from the fetch response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    // Create a custom EventSource implementation
    const eventTarget = new EventTarget();
    let readyState: number = EventSource.OPEN;
    
    const customEventSource = {
      ...eventTarget,
      get readyState() { return readyState; },
      close: () => {
        readyState = EventSource.CLOSED;
        reader?.cancel();
      },
      addEventListener: eventTarget.addEventListener.bind(eventTarget),
      removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
      dispatchEvent: (event: Event) => {
        const result = eventTarget.dispatchEvent(event);
        // Forward to event handler properties
        if (event.type === 'message' && customEventSource.onmessage) {
          customEventSource.onmessage(event as MessageEvent);
        } else if (event.type === 'error' && customEventSource.onerror) {
          customEventSource.onerror(event);
        } else if (event.type === 'open' && customEventSource.onopen) {
          customEventSource.onopen(event);
        }
        return result;
      },
      onmessage: null as ((event: MessageEvent) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      onopen: null as ((event: Event) => void) | null,
      url: '',
      withCredentials: false,
      CONNECTING: EventSource.CONNECTING,
      OPEN: EventSource.OPEN,
      CLOSED: EventSource.CLOSED,
    };

    // Process the stream
    (async () => {
      try {
        if (!reader) throw new Error('No reader available');
        
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              let data = line.slice(6);
              
              try {
                // Parse the event data
                const eventData = JSON.parse(data);
                
                // Handle encrypted final events
                if (eventData.type === 'encrypted_done' && EncryptionService.isAvailable()) {
                  try {
                    const decryptedData = await EncryptionService.decryptData(eventData.encrypted_data);
                    // Replace with decrypted data and change type back to 'done'
                    data = JSON.stringify({ ...decryptedData, type: 'done' });
                  } catch (error) {
                    console.error('Failed to decrypt final event data:', error);
                    // Continue with encrypted event - client will handle error
                  }
                }
              } catch (error) {
                // Not JSON or decryption failed, continue with original data
              }
              
              const event = new MessageEvent('message', { data });
              customEventSource.dispatchEvent(event);
            }
          }
        }
        
        readyState = EventSource.CLOSED;
      } catch (error) {
        console.error('Stream reading error:', error);
        const errorEvent = new Event('error');
        customEventSource.dispatchEvent(errorEvent);
        readyState = EventSource.CLOSED;
      }
    })();

    return customEventSource as EventSource;
  }

  async getAvailableModels(): Promise<Array<{id: string, name: string, description: string}>> {
    const response = await fetch(`${API_BASE_URL}/api/models/`, {
      headers: this.getAuthHeaders(),
    });
    
    if (!response.ok) {
      await this.handleAuthError(response);
      throw new Error('Failed to fetch available models');
    }
    
    return response.json();
  }
}

export const apiService = APIService.getInstance();