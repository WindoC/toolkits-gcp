/**
 * Frontend AES-GCM encryption service
 * Matches backend encryption implementation
 */

interface EncryptedPayload {
  encrypted_data: string;
}

class EncryptionService {
  private static readonly NONCE_LENGTH = 12; // 12 bytes for GCM
  
  /**
   * Get AES key from localStorage
   * In production, this would be derived securely
   */
  private static getEncryptionKey(): string {
    const aesKeyHash = localStorage.getItem('aes_key_hash');
    if (!aesKeyHash) {
      throw new Error('AES key not found in localStorage. Please add aes_key_hash manually.');
    }
    // Use first 32 characters to match backend implementation
    return aesKeyHash.slice(0, 32);
  }

  /**
   * Convert string to Uint8Array
   */
  private static stringToBytes(str: string): Uint8Array {
    return new TextEncoder().encode(str);
  }

  /**
   * Convert Uint8Array to string
   */
  private static bytesToString(bytes: Uint8Array): string {
    return new TextDecoder().decode(bytes);
  }

  /**
   * Convert hex string to ArrayBuffer
   */
  private static hexToArrayBuffer(hex: string): ArrayBuffer {
    const buffer = new ArrayBuffer(hex.length / 2);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return buffer;
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private static base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private static bytesToBase64(bytes: Uint8Array): string {
    let binaryString = '';
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    return btoa(binaryString);
  }

  /**
   * Generate random nonce
   */
  private static generateNonce(): ArrayBuffer {
    const buffer = new ArrayBuffer(this.NONCE_LENGTH);
    const nonce = new Uint8Array(buffer);
    crypto.getRandomValues(nonce);
    return buffer;
  }

  /**
   * Import AES key for Web Crypto API
   * Matches backend key derivation using SHA256
   */
  private static async importKey(keyHex: string): Promise<CryptoKey> {
    // Hash the key with SHA256 to match backend implementation
    const keyBytes = this.stringToBytes(keyHex);
    // Create proper ArrayBuffer for crypto.subtle.digest
    const keyBuffer = new ArrayBuffer(keyBytes.length);
    new Uint8Array(keyBuffer).set(keyBytes);
    const hashedKey = await crypto.subtle.digest('SHA-256', keyBuffer);
    
    return await crypto.subtle.importKey(
      'raw',
      hashedKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using AES-GCM
   * Returns base64-encoded string containing nonce + ciphertext
   */
  static async encryptData(data: any): Promise<string> {
    try {
      // Get encryption key
      const keyHex = this.getEncryptionKey();
      const key = await this.importKey(keyHex);

      // Convert data to JSON bytes
      const jsonData = JSON.stringify(data);
      const dataBytes = this.stringToBytes(jsonData);
      // Create proper ArrayBuffer
      const dataBuffer = new ArrayBuffer(dataBytes.length);
      new Uint8Array(dataBuffer).set(dataBytes);

      // Generate random nonce
      const nonce = this.generateNonce();

      // Encrypt using AES-GCM
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: nonce,
        },
        key,
        dataBuffer
      );

      // Combine nonce + ciphertext and encode as base64
      const nonceBytes = new Uint8Array(nonce);
      const ciphertextBytes = new Uint8Array(ciphertext);
      const combined = new Uint8Array(nonceBytes.length + ciphertextBytes.length);
      combined.set(nonceBytes);
      combined.set(ciphertextBytes, nonceBytes.length);

      return this.bytesToBase64(combined);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt AES-GCM encrypted data
   * Returns decrypted data as object
   */
  static async decryptData(encryptedData: string, autoHandleFailure: boolean = true): Promise<any> {
    try {
      // Get encryption key
      const keyHex = this.getEncryptionKey();
      const key = await this.importKey(keyHex);

      // Decode base64
      const combined = this.base64ToBytes(encryptedData);

      if (combined.length < this.NONCE_LENGTH) {
        throw new Error('Invalid encrypted payload - too short');
      }

      // Extract nonce and ciphertext
      const nonce = combined.slice(0, this.NONCE_LENGTH);
      const ciphertext = combined.slice(this.NONCE_LENGTH);

      // Create proper ArrayBuffers for decryption
      const nonceBuffer = new ArrayBuffer(nonce.length);
      new Uint8Array(nonceBuffer).set(nonce);
      
      const ciphertextBuffer = new ArrayBuffer(ciphertext.length);
      new Uint8Array(ciphertextBuffer).set(ciphertext);

      // Decrypt using AES-GCM
      const decryptedBytes = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: nonceBuffer,
        },
        key,
        ciphertextBuffer
      );

      // Convert to string and parse JSON
      const decryptedText = this.bytesToString(new Uint8Array(decryptedBytes));
      return JSON.parse(decryptedText);
    } catch (error) {
      console.error('Decryption failed:', error);
      
      // Auto-handle decryption failure by removing invalid key
      if (autoHandleFailure) {
        this.handleDecryptionFailure();
      }
      
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt request payload for API calls
   */
  static async encryptRequest(data: any): Promise<EncryptedPayload> {
    const encryptedData = await this.encryptData(data);
    return { encrypted_data: encryptedData };
  }

  /**
   * Decrypt response payload from API calls
   */
  static async decryptResponse(response: EncryptedPayload): Promise<any> {
    if (!response.encrypted_data) {
      throw new Error('Response missing encrypted_data field');
    }
    return await this.decryptData(response.encrypted_data);
  }

  /**
   * Check if encryption is available
   */
  static isAvailable(): boolean {
    try {
      this.getEncryptionKey();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set up encryption key from user input
   */
  static async setupEncryptionKey(userKey: string): Promise<void> {
    try {
      // Hash the user key with SHA256
      const keyBytes = this.stringToBytes(userKey);
      const keyBuffer = new ArrayBuffer(keyBytes.length);
      new Uint8Array(keyBuffer).set(keyBytes);
      const hashedKey = await crypto.subtle.digest('SHA-256', keyBuffer);
      
      // Convert to hex string
      const hashedKeyHex = Array.from(new Uint8Array(hashedKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      // Store in localStorage
      localStorage.setItem('aes_key_hash', hashedKeyHex);
    } catch (error) {
      throw new Error(`Failed to setup encryption key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Remove encryption key from localStorage
   */
  static removeEncryptionKey(): void {
    localStorage.removeItem('aes_key_hash');
  }

  /**
   * Test if the current key can decrypt some test data
   */
  static async testDecryption(): Promise<boolean> {
    try {
      if (!this.isAvailable()) return false;
      
      // Create a test encryption/decryption
      const testData = { test: 'encryption_test' };
      const encrypted = await this.encryptData(testData);
      const decrypted = await this.decryptData(encrypted);
      
      return decrypted.test === 'encryption_test';
    } catch {
      return false;
    }
  }

  /**
   * Handle decryption failure by removing invalid key
   */
  static handleDecryptionFailure(): void {
    console.warn('Decryption failed, removing invalid encryption key');
    this.removeEncryptionKey();
  }
}

export default EncryptionService;
export type { EncryptedPayload };