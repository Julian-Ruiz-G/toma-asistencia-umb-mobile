import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Ejecuta `task` al entrar a la pantalla, cada `intervalMs` mientras está visible
 * y cada vez que la app vuelve a primer plano. Se detiene al salir de la pantalla.
 */
export function useFocusPolling(task, intervalMs = 20000) {
  const taskRef = useRef(task);
  const focusedRef = useRef(false);

  useEffect(() => {
    taskRef.current = task;
  }, [task]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && focusedRef.current) taskRef.current?.();
    });
    return () => sub.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      taskRef.current?.();
      const id = setInterval(() => {
        if (AppState.currentState === 'active') taskRef.current?.();
      }, intervalMs);
      return () => {
        focusedRef.current = false;
        clearInterval(id);
      };
    }, [intervalMs])
  );
}
