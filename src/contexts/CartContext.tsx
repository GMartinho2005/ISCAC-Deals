import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from '../services/auth'; // NOVO: Importar a autenticação

export type CartItem = {
  id: number;
  type: 'produto' | 'servico';
  title: string;
  price: string;
  img: string | null;
  vendedor?: string;
  sellerId: number;
};

type CartContextType = {
  cartItems: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: number, type: 'produto' | 'servico') => void;
  isInCart: (id: number, type: 'produto' | 'servico') => boolean;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: React.ReactNode }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Função que descobre a chave única do utilizador atual
  const getCartKey = async () => {
    const user = await AuthService.getCurrentUser();
    // Se tiver sessão iniciada usa o ID (ex: @iscac_cart_15), senão usa um de visitante
    return user?.id ? `@iscac_cart_${user.id}` : '@iscac_cart_guest';
  };

  useEffect(() => {
    let lastKey = '@iscac_cart_guest';

    // 1. Carrega o carrinho correto quando a app arranca
    const loadInitialCart = async () => {
      try {
        lastKey = await getCartKey();
        const storedCart = await AsyncStorage.getItem(lastKey);
        if (storedCart) {
          setCartItems(JSON.parse(storedCart));
        } else {
          setCartItems([]);
        }
      } catch (error) {
        console.error("Erro ao carregar o carrinho inicial:", error);
      }
    };
    loadInitialCart();

    // 2. O "Radar": Verifica de 2 em 2 segundos se entraste com uma conta diferente
    // Isto garante que se fizeres Logout e Login com outra conta, o carrinho atualiza sozinho!
    const interval = setInterval(async () => {
      const currentKey = await getCartKey();
      
      if (currentKey !== lastKey) {
        lastKey = currentKey;
        const storedCart = await AsyncStorage.getItem(currentKey);
        setCartItems(storedCart ? JSON.parse(storedCart) : []);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Guarda no disco sempre que sofre alterações (na gaveta certa)
  const saveCart = async (items: CartItem[]) => {
    const key = await getCartKey();
    setCartItems(items);
    await AsyncStorage.setItem(key, JSON.stringify(items));
  };

  const addToCart = (item: CartItem) => {
    saveCart([...cartItems, item]);
  };

  const removeFromCart = (id: number, type: 'produto' | 'servico') => {
    const newCart = cartItems.filter(item => !(item.id === id && item.type === type));
    saveCart(newCart);
  };

  const isInCart = (id: number, type: 'produto' | 'servico') => {
    return cartItems.some(item => item.id === id && item.type === type);
  };

  const clearCart = async () => {
    const key = await getCartKey();
    setCartItems([]);
    await AsyncStorage.removeItem(key);
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, isInCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart tem de ser usado dentro de um CartProvider');
  return context;
};