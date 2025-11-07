import React from 'react';
import { render, screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { AuthProvider } from '../contexts/AuthContext';

// Render within AuthProvider to satisfy useAuth() inside SettingsPage
test('renders encryption settings section', () => {
  render(
    <AuthProvider>
      <SettingsPage />
    </AuthProvider>
  );
  expect(screen.getByText(/Settings/i)).toBeInTheDocument();
  expect(screen.getByText(/Encryption Settings/i)).toBeInTheDocument();
});

