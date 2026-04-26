import { User } from '../types';

export const fetchCurrentUser = async (): Promise<User | null> => {
  try {
    const res = await fetch('/api/user');
    if (!res.ok) return null;
    const data = await res.json();
    return data as User;
  } catch {
    return null;
  }
};

export const completeLesson = async (lessonId: string): Promise<User | null> => {
  try {
    const res = await fetch('/api/user/lesson-progress', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data as User;
  } catch {
    return null;
  }
};
