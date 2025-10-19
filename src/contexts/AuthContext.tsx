import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'sales' | 'production' | 'instore' | 'logistics';

interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: Record<string, { password: string; user: User }> = {
  'admin@clothiq.com': {
    password: 'admin123',
    user: { id: '1', name: 'Admin User', role: 'admin', email: 'admin@clothiq.com' }
  },
  'sales@clothiq.com': {
    password: 'sales123',
    user: { id: '2', name: 'Sarah Johnson', role: 'sales', email: 'sales@clothiq.com' }
  },
  'production@clothiq.com': {
    password: 'prod123',
    user: { id: '3', name: 'Mike Chen', role: 'production', email: 'production@clothiq.com' }
  },
  'store@clothiq.com': {
    password: 'store123',
    user: { id: '4', name: 'Emma Wilson', role: 'instore', email: 'store@clothiq.com' }
  },
  'logistics@clothiq.com': {
    password: 'logistics123',
    user: { id: '5', name: 'David Brown', role: 'logistics', email: 'logistics@clothiq.com' }
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('clothiq_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = (email: string, password: string): boolean => {
    const account = mockUsers[email.toLowerCase()];
    if (account && account.password === password) {
      setUser(account.user);
      localStorage.setItem('clothiq_user', JSON.stringify(account.user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('clothiq_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
