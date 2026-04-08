import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, BackHandler, Image, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { setupDatabase } from '../../src/services/database';

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

  const [categories, setCategories] = useState<Categoria[]>([]);
  const [anuncios, setAnuncios] = useState<AnuncioItem[]>([]);

  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tudo');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const categoriesScrollRef = useRef<ScrollView>(null);
  const destaquesScrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      categoriesScrollRef.current?.scrollTo({ x: 0, animated: false });
      destaquesScrollRef.current?.scrollTo({ x: 0, animated: false });

      const loadData = async () => {
        try {
          const db = await setupDatabase();
          if (!db || !isActive) return;

          const dbCategories = await db.getAllAsync<Categoria>(
            'SELECT id, nome, imagem FROM core_categoria ORDER BY nome'
          );
          if (!isActive) return;
          setCategories(dbCategories);

          const produtos = await db.getAllAsync<AnuncioItem>(
            `SELECT id, 'produto' as type, titulo as title, preco as price, foto as img
             FROM core_produto WHERE ativo = 1 ORDER BY id DESC`
          );

          const servicos = await db.getAllAsync<AnuncioItem>(
            `SELECT id, 'servico' as type, titulo as title, preco as price, foto as img
             FROM core_servico WHERE ativo = 1 ORDER BY id DESC`
          );

          if (!isActive) return;
          setAnuncios([...produtos, ...servicos]);
        } catch (error) {
          console.error("Erro ao carregar dados da BD:", error);
        }
      };

      loadData();

      const onBackPress = () => {
        if (isSearchActive) {
          setIsSearchActive(false);
          setSearchQuery('');
          setActiveFilter('Tudo');
          Keyboard.dismiss();
          return true;
        }
        
        Alert.alert(
          "Sair da Aplicação",
          "Tens a certeza que pretendes sair do ISCAC Deals?",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Sair", onPress: () => BackHandler.exitApp() }
          ]
        );
        return true; 
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => {
        isActive = false;
        backHandler.remove();
      };
    }, [isSearchActive])
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

  const handleCancelSearch = () => {
    setIsSearchActive(false);
    setSearchQuery('');
    setActiveFilter('Tudo');
    Keyboard.dismiss();
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

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {!isSearchActive && (
          <>
            {/* Banner */}
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

            {/* Categorias */}
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

            {/* Destaques */}
            <Pressable
              onPress={() => router.push('/destaques')}
              className="flex-row justify-between items-center mb-4 active:opacity-70"
            >
              <Text className="text-xl font-bold text-white">Destaques</Text>
              <View className="p-2 -mr-2">
                <Ionicons name="chevron-forward" size={20} color="white" />
              </View>
            </Pressable>

            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              className="mb-10"
              ref={destaquesScrollRef}
            >
              {anuncios.map((item) => {
                const cleanPrice = item.price ? item.price.replace('€/h', '').replace('€', '').trim() : '0';
                
                return (
                  <Pressable
                    key={`${item.type}-${item.id}`}
                    className="w-[130px] mr-4"
                    onPress={() => handlePressItem(item)}
                  >
                    <View className="w-full h-[170px] rounded-[16px] mb-2 overflow-hidden border border-white/20">
                      <Image
                        source={getDynamicImage(item.img)}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover" 
                      />
                    </View>
                    
                    {/* === CAIXA DE TÍTULO COM ALTURA FIXA (Para alinhar os preços na base) === */}
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
            </ScrollView>
          </>
        )}

        {/* Vista de pesquisa */}
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
    </View>
  );
}