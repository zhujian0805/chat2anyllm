// Utility functions for authenticated API calls

export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

export const handleAuthError = (error: any): boolean => {
  if (error?.response?.status === 401 || error?.response?.status === 403) {
    // Clear auth data on auth errors
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return true;
  }
  return false;
};