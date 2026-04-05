import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { verifyPassword } from '../lib/auth';

type User = {
  id: string;
  username: string;
  role: string;
  teacher_id?: string;
  parent_id?: string;
};

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      // Query user by username
      const { data: users, error } = await supabase
        .from('users')
        .select('id, username, password_hash, role, teacher_id, parent_id')
        .eq('username', username)
        .limit(1);

      if (error) throw error;
      if (!users || users.length === 0) {
        return { success: false, error: 'Invalid credentials' };
      }

      const userRecord = users[0];
      if (!verifyPassword(password, userRecord.password_hash)) {
        return { success: false, error: 'Invalid credentials' };
      }

      // Store user in localStorage (omit password_hash)
      const userData: User = {
        id: userRecord.id,
        username: userRecord.username,
        role: userRecord.role,
        teacher_id: userRecord.teacher_id,
        parent_id: userRecord.parent_id,
      };
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: err.message || 'Login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};