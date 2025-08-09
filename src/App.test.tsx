import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login form initially', () => {
  render(<App />);
  const heading = screen.getByRole('heading', { name: /login to chat2anyllm/i });
  expect(heading).toBeInTheDocument();
});
