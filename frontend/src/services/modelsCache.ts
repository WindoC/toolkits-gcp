import { apiService } from './api';

export interface Model {
  id: string;
  name: string;
  description: string;
}

class ModelsCache {
  private static instance: ModelsCache;
  private cache: Model[] | null = null;
  private loading = false;
  private loadingPromise: Promise<Model[]> | null = null;
  private error: string | null = null;

  private constructor() {}

  static getInstance(): ModelsCache {
    if (!ModelsCache.instance) {
      ModelsCache.instance = new ModelsCache();
    }
    return ModelsCache.instance;
  }

  /**
   * Get available models, using cache if available
   */
  async getModels(): Promise<Model[]> {
    // If we have cached data, return it immediately
    if (this.cache) {
      return this.cache;
    }

    // If already loading, return the existing promise
    if (this.loading && this.loadingPromise) {
      return this.loadingPromise;
    }

    // Start loading
    this.loading = true;
    this.error = null;
    
    this.loadingPromise = this.fetchModels();
    
    try {
      const models = await this.loadingPromise;
      this.cache = models;
      return models;
    } finally {
      this.loading = false;
      this.loadingPromise = null;
    }
  }

  private async fetchModels(): Promise<Model[]> {
    try {
      console.log('Fetching models from API (first time only)...');
      const models = await apiService.getAvailableModels();
      console.log(`Cached ${models.length} models in memory`);
      return models;
    } catch (err) {
      console.error('Failed to fetch models:', err);
      this.error = 'Failed to load models';
      
      // Return fallback models if API fails
      const fallbackModels: Model[] = [
        {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          description: 'Fast and versatile model for most tasks'
        },
        {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          description: 'The most powerful model for demanding tasks'
        },
        {
          id: 'gemini-2.5-flash-lite',
          name: 'Gemini 2.5 Flash Lite',
          description: 'Best performance for complex reasoning tasks'
        }
      ];
      
      console.log('Using fallback models due to API error');
      return fallbackModels;
    }
  }

  /**
   * Check if models are currently being loaded
   */
  isLoading(): boolean {
    return this.loading;
  }

  /**
   * Get any error that occurred during loading
   */
  getError(): string | null {
    return this.error;
  }

  /**
   * Check if models are cached
   */
  hasCachedModels(): boolean {
    return this.cache !== null;
  }

  /**
   * Get cached models synchronously (returns null if not cached)
   */
  getCachedModels(): Model[] | null {
    return this.cache;
  }

  /**
   * Clear the cache (useful for debugging or forcing refresh)
   */
  clearCache(): void {
    console.log('Clearing models cache');
    this.cache = null;
    this.error = null;
    this.loading = false;
    this.loadingPromise = null;
  }

  /**
   * Refresh the cache by clearing and reloading
   */
  async refresh(): Promise<Model[]> {
    this.clearCache();
    return this.getModels();
  }
}

// Export singleton instance
export const modelsCache = ModelsCache.getInstance();