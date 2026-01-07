import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'pumplo_favorite_gyms';

export const useFavoriteGyms = () => {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setFavorites(JSON.parse(stored));
      } catch {
        setFavorites([]);
      }
    }
  }, []);

  const toggleFavorite = useCallback((gymId: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(gymId)
        ? prev.filter(id => id !== gymId)
        : [...prev, gymId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newFavorites));
      return newFavorites;
    });
  }, []);

  const isFavorite = useCallback((gymId: string) => {
    return favorites.includes(gymId);
  }, [favorites]);

  return { favorites, toggleFavorite, isFavorite };
};
