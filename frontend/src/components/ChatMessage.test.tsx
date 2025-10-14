import React from 'react';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import { Message } from '../types';

describe('ChatMessage', () => {
  const userMessage: Message = {
    role: 'user',
    content: 'Hello, how are you?',
    created_at: '2024-01-01T12:00:00Z',
  };

  const aiMessage: Message = {
    role: 'ai',
    content: 'I am doing well, thank you for asking!',
    created_at: '2024-01-01T12:00:05Z',
  };

  test('renders user message correctly', () => {
    render(<ChatMessage message={userMessage} />);
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  test('renders AI message correctly', () => {
    render(<ChatMessage message={aiMessage} />);
    expect(screen.getByText('I am doing well, thank you for asking!')).toBeInTheDocument();
  });

  test('applies correct styling for user messages', () => {
    const { container } = render(<ChatMessage message={userMessage} />);
    const messageDiv = container.querySelector('div[class*="bg-blue-600"]');
    expect(messageDiv).toBeInTheDocument();
  });

  test('applies correct styling for AI messages', () => {
    const { container } = render(<ChatMessage message={aiMessage} />);
    const messageDiv = container.querySelector('div[class*="bg-white"]');
    expect(messageDiv).toBeInTheDocument();
  });

  test('shows streaming animation when isStreaming is true', () => {
    const { container } = render(<ChatMessage message={aiMessage} isStreaming={true} />);
    const animationElement = container.querySelector('.animate-bounce');
    expect(animationElement).toBeInTheDocument();
  });

  test('renders markdown content for AI messages', () => {
    const markdownMessage: Message = {
      role: 'ai',
      content: '**Bold text** and `code`',
      created_at: '2024-01-01T12:00:00Z',
    };

    render(<ChatMessage message={markdownMessage} />);
    expect(screen.getByText('Bold text')).toBeInTheDocument();
  });
});