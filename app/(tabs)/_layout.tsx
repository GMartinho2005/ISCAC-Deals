import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs 
      screenOptions={{
        headerShown: false, // Esconde o cabeçalho no topo
        tabBarShowLabel: false, // Esconde os textos debaixo dos ícones
        tabBarActiveTintColor: 'rgb(255, 255, 255)', // Cor do ícone selecionado
        tabBarInactiveTintColor: 'rgb(103, 103, 103)', // Cor dos ícones não selecionados
        tabBarStyle: {
          backgroundColor: 'rgb(0,0,0)',
          borderTopWidth: 1,
          borderTopColor: 'rgb(0, 0, 0)',
          height: 60,
          marginBottom: 20,
        }
      }}
    >

      {/* ABA 1: HOME */}
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color} />,
        }}
      />
      
      {/* ABA 2: Favorito */}
        <Tabs.Screen
          name="favorites"
          options={{
            tabBarIcon: ({ color }) => <Ionicons name="heart-outline" size={26} color={color} />,
          }}
        />
      
      {/* ABA 3: CARRINHO */}
      <Tabs.Screen
        name="cart"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="cart-outline" size={26} color={color} />,
        }}
      />
      
      {/* ABA 4: CHAT */}
      <Tabs.Screen
        name="chat"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="chatbubble-outline" size={26} color={color} />,
        }}
      />
      
      {/* ABA 5: PERFIL */}
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={26} color={color} />,
        }}
      />

    </Tabs>
  );
}