import React, { useContext } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, AuthContext } from './contexts/AuthContext';
import { Chat } from './components/Chat';
import LoginForm from './components/LoginForm';
import './App.css';

const AppContent: React.FC = () => {
  const authContext = useContext(AuthContext);
  
  if (!authContext) {
    throw new Error('AppContent must be used within an AuthProvider');
  }
  
  const { isAuthenticated } = authContext;
  const [showLogin, setShowLogin] = React.useState(true);
  
  const handleLoginSuccess = () => {
    setShowLogin(false);
  };
  
  if (!isAuthenticated && showLogin) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }
  
  return <Chat />;
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="App">
          <AppContent />
        </div>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
