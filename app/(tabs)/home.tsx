import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AuthService } from '../../src/services/auth';
import { getAllAnuncios, getCategorias, getDestaques } from '../../src/services/database';

type Categoria = {
  id: number;
  nome: string;
  imagem: string | null;
};

type AnuncioItem = {
  id: number;
  type: 'produto' | 'servico';
  title: string;
  price: string;
  img: string | null;
};

const ImageMap: Record<string, any> = {
  'categorias/livros.jpg': require('../../assets/images/livros.jpg'),
  'categorias/resumos.jpg': require('../../assets/images/resumos.jpg'),
  'categorias/freqs.jpg': require('../../assets/images/freqs.jpg'),
  'categorias/expli.jpg': require('../../assets/images/expli.jpg'),
  'categorias/hardware.jpg': require('../../assets/images/hardware.jpg'),
  'categorias/calculadora.jpg': require('../../assets/images/calculadora.jpg'),
  'categorias/outros.jpg': require('../../assets/images/outros.jpg'),
  'produtos/constituição_da_repu.png': require('../../assets/images/constituição_da_repu.png'),
};

const DEFAULT_IMAGE = require('../../assets/images/logo.png');

export default function HomePage() {
  const router = useRouter();
  const navigation = useNavigation();

  const [categories, setCategories] = useState<Categoria[]>([]);
  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);
  const [destaques, setDestaques] = useState<AnuncioItem[]>([]);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tudo');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const mainScrollRef = useRef<ScrollView>(null);
  const categoriesScrollRef = useRef<ScrollView>(null);

  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    showCancel: false,
    confirmText: 'Entendido',
    onConfirm: null as (() => void) | null
  });

  const showAlert = (title: string, message: string, type: 'warning' | 'success' | 'error', showCancel = false, confirmText = 'Entendido', onConfirm: (() => void) | null = null) => {
    setAlertState({ visible: true, title, message, type, showCancel, confirmText, onConfirm });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };

  const handleConfirmAlert = () => {
    const onConfirm = alertState.onConfirm;
    closeAlert();
    if (onConfirm) onConfirm();
  };

  const handleCancelSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    setActiveFilter('Tudo');
    Keyboard.dismiss();
  }, []);

  // OUVINTE DO CLIQUE NA TAB HOME
  useEffect(() => {
    const unsubscribe = (navigation as any).addListener('tabPress', (e: any) => {
      if (isSearchActive) {
        handleCancelSearch();
      } else {
        categoriesScrollRef.current?.scrollTo({ x: 0, animated: true });
        mainScrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    });

    return unsubscribe;
  }, [navigation, isSearchActive, handleCancelSearch]);

  // CARREGAR DADOS
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const loadData = async () => {
        try {
          const user = await AuthService.getCurrentUser();
          const userId = user?.id || null;

          const cats = await getCategorias();
          if (!isActive) return;
          setCategories(cats);

          const allItems = await getAllAnuncios(userId);
          if (!isActive) return;
          setAnuncios(allItems);

          // Agora pede 6 destaques em vez de 5
          const topItems = await getDestaques(userId, 6);
          if (!isActive) return;
          setDestaques(topItems);
        } catch (error) {
          console.error("Erro ao carregar dados:", error);
        }
      };
      
      loadData();

      return () => {
        isActive = false;
      };
    }, []) 
  );

  // CONTROLAR O BOTÃO DE VOLTAR DO ANDROID
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isSearchActive) {
          handleCancelSearch();
          return true; 
        }
        
        showAlert(
          "Sair da Aplicação",
          "Tens a certeza que pretendes sair do ISCAC Deals?",
          "warning",
          true,
          "Sair",
          () => BackHandler.exitApp()
        );
        return true; 
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }, [isSearchActive, handleCancelSearch])
  );

  const handleSearchSubmit = () => {
    if (searchQuery.trim() !== '') {
      setRecentSearches((prev) => {
        const filtered = prev.filter(
          (item) => item.toLowerCase() !== searchQuery.trim().toLowerCase()
        );
        return [searchQuery.trim(), ...filtered].slice(0, 5);
      });
    }
  };

  const handlePressItem = (item: AnuncioItem) => {
    const route = item.type === 'servico' ? '/servicos' : '/produtos';
    router.push({ pathname: route, params: { id: item.id } });
  };

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  const filteredResults = anuncios.filter((item) => {
    const matchesFilter =
      activeFilter === 'Tudo' ||
      (activeFilter === 'Produtos' && item.type === 'produto') ||
      (activeFilter === 'Serviços' && item.type === 'servico');

    if (!matchesFilter) return false;
    if (searchQuery.trim() === '') return true;

    const limpaTexto = (str: string) => {
      return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    };

    const buscaLimpa = limpaTexto(searchQuery);
    const tituloLimpo = limpaTexto(item.title);
    const buscaSegura = buscaLimpa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexIniciais = new RegExp('\\b' + buscaSegura);

    return regexIniciais.test(tituloLimpo);
  });

  return (
    <View className="flex-1 bg-[rgb(58,79,92)] pt-14 px-4">
      {/* Barra de pesquisa */}
      <View className="flex-row items-center mb-6">
        <View className="flex-1 flex-row items-center bg-white/10 rounded-2xl px-4 h-14 border border-white/20">
          <Ionicons name="search" size={22} color="rgba(255,255,255,0.4)" />
          <TextInput
            placeholder="O que procuras?"
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setIsSearchActive(true)}
            returnKeyType="search"
            onSubmitEditing={handleSearchSubmit}
            className="flex-1 text-white text-[16px] font-medium ml-3"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} className="p-1 active:opacity-50">
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>

        {isSearchActive && (
          <Pressable onPress={handleCancelSearch} className="ml-4 active:opacity-50">
            <Text className="text-white font-bold text-[16px]">Cancelar</Text>
          </Pressable>
        )}
      </View>

      <ScrollView ref={mainScrollRef} showsVerticalScrollIndicator={false} className="flex-1">
        {!isSearchActive && (
          <>
            <View className="w-full h-40 rounded-2xl overflow-hidden mb-8 relative bg-gray-200">
              <Image
                source={require('../../assets/images/iscac.png')}
                style={{ width: '100%', height: '100%', position: 'absolute' }}
                resizeMode="cover"
              />
              <View className="absolute inset-0 bg-black/30" />
              <Text className="absolute bottom-12 left-6 text-white text-2xl font-extrabold shadow-md">
                ISCAC-DEALS
              </Text>
              <Text className="absolute bottom-6 left-6 text-white text-[16px] font-bold shadow-md">
                De alunos para alunos!
              </Text>
            </View>

            <Text className="text-xl font-bold text-white mb-4">Categorias</Text>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="mb-10"
              ref={categoriesScrollRef}
            >
              {categories.map((cat) => (
                <Pressable
                  key={cat.id}
                  className="items-center mr-5 w-[85px] active:opacity-70"
                  onPress={() =>
                    router.push({ pathname: '/category', params: { categoryId: cat.id, categoryName: cat.nome } })
                  }
                >
                  <View className="w-[80px] h-[80px] rounded-full overflow-hidden border border-white/20 bg-white/5">
                    <Image
                      source={getDynamicImage(cat.imagem)}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </View>
                  <Text className="mt-2 font-bold text-[13px] text-white text-center leading-tight">
                    {cat.nome}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text className="text-xl font-bold text-white mb-4">Destaques</Text>

            {/* Grelha Vertical de Destaques (2 Colunas x 3 Linhas = 6 itens) */}
            <View className="flex-row flex-wrap justify-between">
              {destaques.map((item) => {
                const cleanPrice = item.price ? item.price.replace('€/h', '').replace('€', '').trim() : '0';
                
                return (
                  <Pressable
                    key={`${item.type}-${item.id}`}
                    className="w-[48%] mb-6"
                    onPress={() => handlePressItem(item)}
                  >
                    <View className="w-full h-[170px] rounded-[16px] mb-2 overflow-hidden border border-white/20 bg-white/5">
                      <Image
                        source={getDynamicImage(item.img)}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover" 
                      />
                    </View>
                    
                    <View className="justify-start">
                      <Text className="font-bold text-[14px] text-white leading-tight" numberOfLines={2}>
                        {item.title}
                      </Text>
                    </View>
                    
                    <Text className="font-black text-[16px] text-gray-300 mt-1">
                      {cleanPrice}€{item.type === 'servico' && <Text className="text-[12px] font-normal">/h</Text>}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Botão Ver Todos no fim */}
            <Pressable
              onPress={() => router.push('/destaques')}
              className="w-full bg-white/5 border border-white/10 py-3.5 rounded-xl items-center mb-10 mt-2 active:bg-white/10"
            >
              <Text className="text-white font-bold text-[15px]">Ver todos os destaques</Text>
            </Pressable>
          </>
        )}

        {isSearchActive && (
          <View className="flex-1">
            <View className="flex-row items-center mb-6">
              {(['Tudo', 'Produtos', 'Serviços'] as const).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  className={`px-5 py-2.5 rounded-full mr-3 border ${
                    activeFilter === filter
                      ? 'bg-[rgb(223,19,36)] border-[rgb(223,19,36)]'
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <Text className={`font-bold text-[14px] ${activeFilter === filter ? 'text-white' : 'text-gray-300'}`}>
                    {filter}
                  </Text>
                </Pressable>
              ))}
            </View>

            {searchQuery === '' && recentSearches.length > 0 && (
              <View className="mb-8">
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-white font-bold text-lg">Pesquisas Recentes</Text>
                  <Pressable onPress={() => setRecentSearches([])}>
                    <Text className="text-gray-400 font-bold text-[14px]">Limpar</Text>
                  </Pressable>
                </View>
                {recentSearches.map((search, index) => (
                  <Pressable
                    key={index}
                    onPress={() => setSearchQuery(search)}
                    className="flex-row items-center py-3 border-b border-white/5"
                  >
                    <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.4)" />
                    <Text className="text-gray-300 text-[16px] ml-3 flex-1">{search}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View className="pb-10">
              {searchQuery !== '' && (
                <Text className="text-gray-400 font-medium mb-4">
                  A mostrar {filteredResults.length} resultado{filteredResults.length !== 1 ? 's' : ''}
                </Text>
              )}
              {filteredResults.map((item) => {
                const cleanPrice = item.price ? item.price.replace('€/h', '').replace('€', '').trim() : '0';
                
                return (
                  <Pressable
                    key={`${item.type}-${item.id}`}
                    className="flex-row bg-white/5 border border-white/10 rounded-3xl p-3 mb-4 active:bg-white/10"
                    onPress={() => handlePressItem(item)}
                  >
                    <View className="w-24 h-24 rounded-2xl overflow-hidden border border-white/20">
                      <Image source={getDynamicImage(item.img)} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    </View>

                    <View className="flex-1 ml-4 justify-center">
                      <View className="flex-row items-center mb-1">
                        <View className="bg-white/10 px-2 py-1 rounded-md border border-white/10">
                          <Text className="text-white text-[10px] font-bold uppercase">
                            {item.type === 'servico' ? 'Serviço' : 'Produto'}
                          </Text>
                        </View>
                      </View>
                      <Text className="text-white font-bold text-[16px] leading-tight mb-2" numberOfLines={2}>
                        {item.title}
                      </Text>
                      <Text className="text-white font-black text-[18px]">
                        {cleanPrice}€{item.type === 'servico' && <Text className="text-[14px] text-gray-400 font-medium">/h</Text>}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <Modal animationType="fade" transparent visible={alertState.visible} onRequestClose={closeAlert}>
        <View className="flex-1 justify-center items-center bg-black/70 px-6">
          <View className="bg-[rgb(48,66,77)] w-full rounded-3xl p-6 items-center shadow-2xl border border-white/10">
            
            <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${
              alertState.type === 'success' ? 'bg-[#10b981]/20' : 
              alertState.type === 'error' ? 'bg-[rgb(223,19,36)]/20' : 'bg-[#fbbf24]/20'
            }`}>
              <Ionicons 
                name={
                  alertState.type === 'success' ? 'checkmark-circle' : 
                  alertState.type === 'error' ? 'close-circle' : 'warning'
                } 
                size={36} 
                color={
                  alertState.type === 'success' ? '#10b981' : 
                  alertState.type === 'error' ? 'rgb(223,19,36)' : '#fbbf24'
                } 
              />
            </View>

            <Text className="text-white text-xl font-bold text-center mb-2">{alertState.title}</Text>
            <Text className="text-gray-300 text-[15px] text-center leading-6 mb-8">{alertState.message}</Text>
            
            <View className={`w-full ${alertState.showCancel ? 'flex-row gap-3' : ''}`}>
              {alertState.showCancel && (
                <TouchableOpacity 
                  onPress={closeAlert}
                  activeOpacity={0.8}
                  className="flex-1 bg-white/10 h-[50px] rounded-xl justify-center items-center"
                >
                  <Text className="text-white font-bold text-[16px]">Cancelar</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                onPress={handleConfirmAlert}
                activeOpacity={0.8}
                className={`${alertState.showCancel ? 'flex-1' : 'w-full'} bg-[rgb(223,19,36)] h-[50px] rounded-xl justify-center items-center`}
              >
                <Text className="text-white font-bold text-[16px]">
                  {alertState.confirmText}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </View>
  );
}