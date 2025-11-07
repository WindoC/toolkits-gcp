import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login when not authenticated', () => {
  render(<App />);
  expect(screen.getByText(/Welcome to Toolkits/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
});
