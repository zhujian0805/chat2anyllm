import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getBackendEndpoint } from '../utils/env';

interface User {
  id: number;
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Check for existing token in localStorage on app start
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    // Call backend login endpoint (respect configured backend URL)
    const backend = getBackendEndpoint();
    try {
      const response = await fetch(`${backend}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      // If server returned an HTTP error, try to parse a helpful message
      if (!response.ok) {
        const text = await response.text();
        let parsed: any = null;
        try { parsed = JSON.parse(text); } catch (_) { /* ignore */ }
        const serverMsg = parsed?.error || parsed?.message || text || `Login failed (${response.status})`;
        throw new Error(serverMsg);
      }

      // Some dev setups may return HTML on misrouted requests; guard JSON parsing
      const text = await response.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Unexpected response from server');
      }

      setToken(data.token);
      setUser(data.user);

      // Store in localStorage for persistence
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err: any) {
      // Network or other fetch-level errors get a clearer message
      if (err instanceof Error) {
        throw err;
      }
      throw new Error('Network error: unable to contact backend');
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };