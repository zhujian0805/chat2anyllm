import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { Chat } from './components/Chat';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <div className="App">
        <Chat />
      </div>
    </ThemeProvider>
  );
}

export default App;
