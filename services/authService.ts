import { supabase } from './supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
    avatar_url?: string;
  };
}

export const signUp = async (email: string, password: string, fullName?: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName || email.split('@')[0],
        },
      },
    });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const signIn = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  } catch (error) {
    throw error;
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return true;
  } catch (error) {
    throw error;
  }
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) return null;
    
    return {
      id: user.id,
      email: user.email || '',
      user_metadata: user.user_metadata,
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

export const onAuthStateChange = (callback: (user: AuthUser | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      callback({
        id: session.user.id,
        email: session.user.email || '',
        user_metadata: session.user.user_metadata,
      });
    } else {
      callback(null);
    }
  });

  return subscription;
};
