import { createContext, useContext, useEffect } from 'react';

export const ThemeCtx = createContext(null);
export const ToastCtx = createContext(null);
export const AuthCtx = createContext(null);
export const MenuCtx = createContext(null);
export const CartCtx = createContext(null);
export const FavCtx = createContext(null);

export const useTheme = () => useContext(ThemeCtx);
export const useToast = () => useContext(ToastCtx);
export const useAuth = () => useContext(AuthCtx);
export const useMenu = () => useContext(MenuCtx);
export const useCart = () => useContext(CartCtx);
export const useFavorites = () => useContext(FavCtx);

// Run `fn` whenever the live channel (Socket.IO, or the Live preview bus) delivers `event`.
export function useLive(event, fn) {
  const { live } = useAuth();
  useEffect(() => {
    if (!live) return undefined;
    return live.on(event, fn);
  }, [live, event, fn]);
}
