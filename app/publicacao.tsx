import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, InteractionManager, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AuthService } from '../src/services/auth';
import {
  Categoria,
  getCategorias,
  getItemByIdAndType,
  insertProduto,
  insertServico,
  updateProduto,
  updateServico,
} from '../src/services/database';

export default function NovaPublicacaoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params.id ? Number(params.id) : null;
  const editType = params.type as string | undefined;
  const isEditing = !!editId;

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Categoria[]>([]);

  // Estado para a fotografia
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const [format, setFormat] = useState<'Online' | 'Presencial' | ''>('');
  const [slots, setSlots] = useState<{ id: string; date: Date; time: Date }[]>([]);

  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [condition, setCondition] = useState<'Novo' | 'Pouco Uso' | 'Muito Uso' | ''>('');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const user = await AuthService.getCurrentUser();
      const cats = await getCategorias();
      if (isMounted) {
        setCurrentUserId(user?.id ?? null);
        setCategories(cats);
      }
    };
    init();
    return () => { isMounted = false; };
  }, []);

  const row1 = categories.filter(c => c.nome === 'Livros' || c.nome === 'Resumos' || c.nome.includes('Frequências'));
  const row2 = categories.filter(c => c.nome.includes('Explicações') || c.nome.includes('Outros'));
  const row3 = categories.filter(c => c.nome === 'Hardware' || c.nome === 'Calculadoras');
  const restantes = categories.filter(c =>
    !row1.includes(c) && !row2.includes(c) && !row3.includes(c)
  );

  const selectedCatObj = categories.find(c => c.id === selectedCategory);
  const isService = selectedCatObj
    ? selectedCatObj.nome.toLowerCase().includes('explicaç') || selectedCatObj.nome.toLowerCase().includes('serviç')
    : editType === 'servico';

  useEffect(() => {
    if (isService) { setDeliveryLocation(''); setCondition(''); }
    else { setFormat(''); setSlots([]); }
  }, [isService]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const load = async () => {
        if (!isEditing || !editId) return;

        try {
          const isServ = editType === 'servico';
          const ad = await getItemByIdAndType(editId, isServ) as any;
          
          if (ad && isActive) {
            setTitle(ad.titulo);
            setSelectedCategory(ad.id_categoria);
            setPrice(ad.preco.replace('€/h', '').replace('€', '').trim());
            setDescription(ad.descricao || '');
            
            if (ad.foto) setImageUri(ad.foto.startsWith('file://') ? ad.foto : `https://teu-servidor.com/media/${ad.foto}`);

            if (isServ) {
              setFormat(ad.formato || '');
              if (ad.horario) {
                try {
                  const parsed = JSON.parse(ad.horario);
                  setSlots(parsed.map((s: any) => ({ id: s.id, date: new Date(s.date), time: new Date(s.time) })));
                } catch { /* ignore */ }
              }
            } else {
              setDeliveryLocation(ad.local_entrega || '');
              setCondition(ad.estado || '');
            }
          }
        } catch (e) {
          console.error("Erro ao carregar dados de edição:", e);
        }
      };

      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) {
          if (isEditing) {
            load();
          } else {
            setTitle(''); setPrice(''); setDescription(''); setImageUri(null);
            setSelectedCategory(null); setFormat(''); setSlots([]);
            setDeliveryLocation(''); setCondition('');
          }
        }
      });

      return () => { 
        isActive = false; 
        task.cancel();
      };
    }, [editId, isEditing, editType])
  );

  // ==========================================
  // LÓGICA DA CÂMARA E GALERIA
  // ==========================================
  const handleImageSelection = () => {
    Alert.alert(
      "Adicionar Fotografia",
      "De onde queres carregar a imagem?",
      [
        { text: "Tirar Foto", onPress: takePhoto },
        { text: "Escolher da Galeria", onPress: pickFromGallery },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permissão Recusada", "Precisamos de acesso à tua galeria para adicionares uma foto!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permissão Recusada", "Precisamos de acesso à tua câmara para tirares uma foto!");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };
  // ==========================================

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setTempDate(selectedDate);
      setTimeout(() => setShowTimePicker(true), 100);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selectedTime) {
      setSlots([...slots, { id: Math.random().toString(36).substring(7), date: tempDate, time: selectedTime }]);
    }
  };

  const removeSlot = (idToRemove: string) => setSlots(slots.filter(s => s.id !== idToRemove));

  const handlePublicar = async () => {
    if (!selectedCategory || !title.trim() || !price.trim() || !description.trim()) {
      Alert.alert('Campos Incompletos', 'Por favor, preenche todos os campos textuais.');
      return;
    }

    if (isService) {
      if (!format) return Alert.alert('Campos Incompletos', 'Por favor, escolhe o formato do serviço.');
      if (slots.length === 0) return Alert.alert('Campos Incompletos', 'Adiciona pelo menos um horário.');
    } else {
      if (!condition) return Alert.alert('Campos Incompletos', 'Escolhe o estado do produto.');
      if (!deliveryLocation.trim()) return Alert.alert('Campos Incompletos', 'Indica o local de entrega.');
    }

    if (!currentUserId) {
      Alert.alert('Erro de Sessão', 'Faz login novamente.');
      return;
    }

    const suffix = isService ? '€/h' : '€';
    const finalPrice = price.includes('€') ? price : `${price.trim()}${suffix}`;
    
    const fotoDb = imageUri || ''; 
    const slotsDb = JSON.stringify(slots);
    const condDb = condition;
    const locDb = deliveryLocation.trim();
    const formatDb = format;
    const descDb = description.trim();

    try {
      if (isEditing && editId) {
        if (isService) {
          await updateServico(editId, title.trim(), finalPrice, fotoDb, selectedCategory, descDb, formatDb, slotsDb);
        } else {
          await updateProduto(editId, title.trim(), finalPrice, fotoDb, selectedCategory, descDb, condDb, locDb);
        }
        Alert.alert('Sucesso', 'Publicação atualizada!');
      } else {
        if (isService) {
          await insertServico(currentUserId, title.trim(), finalPrice, fotoDb, selectedCategory, descDb, formatDb, slotsDb);
        } else {
          await insertProduto(currentUserId, title.trim(), finalPrice, fotoDb, selectedCategory, descDb, condDb, locDb);
        }
        Alert.alert('Sucesso', 'Publicação criada com sucesso!');
      }
      router.back();
    } catch (error: any) {
      console.error('Erro ao publicar:', error.message);
      Alert.alert('Erro', 'Não foi possível guardar a publicação.');
    }
  };

  const renderCategoryRow = (cats: Categoria[]) => (
    <View className="flex-row justify-center flex-wrap gap-2 mb-3">
      {cats.map((cat) => (
        <Pressable
          key={cat.id}
          onPress={() => setSelectedCategory(cat.id)}
          className={`px-4 py-2.5 rounded-xl border ${selectedCategory === cat.id ? 'bg-[rgb(223,19,36)] border-[rgb(223,19,36)]' : 'bg-white/5 border-white/10'}`}
        >
          <Text className={`font-bold text-[13px] text-center ${selectedCategory === cat.id ? 'text-white' : 'text-gray-300'}`}>
            {cat.nome}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      <View className="pt-14 pb-3 px-4 flex-row items-center border-b border-white/10">
        <Pressable className="mr-4" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </Pressable>
        <Text className="text-xl font-bold text-white flex-1">
          {isEditing ? 'Editar Publicação' : 'Nova Publicação'}
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>

          <View className="mb-8">
            <Text className="text-white font-bold text-[16px] mb-4 ml-1">Escolhe uma Categoria</Text>
            {renderCategoryRow(row1)}
            {renderCategoryRow(row2)}
            {renderCategoryRow(row3)}
            {restantes.length > 0 && renderCategoryRow(restantes)}
          </View>

          {selectedCategory && (
            <View className="pt-6 border-t border-white/10 mt-2">

              {/* FOTOGRAFIA DO ANÚNCIO */}
              <View className="mb-8 items-center">
                <Pressable 
                  onPress={handleImageSelection} 
                  className="w-full h-48 bg-white/5 border-2 border-dashed border-white/20 rounded-3xl items-center justify-center overflow-hidden active:opacity-80"
                >
                  {imageUri ? (
                    <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="items-center">
                      <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.5)" />
                      <Text className="text-gray-400 font-bold mt-2 text-[15px]">Adicionar Fotografia</Text>
                      <Text className="text-gray-500 text-[12px] mt-1">Tirar foto ou escolher da galeria</Text>
                    </View>
                  )}
                </Pressable>
                {imageUri && (
                  <Pressable onPress={() => setImageUri(null)} className="absolute top-3 right-3 bg-red-500/90 p-2 rounded-full shadow-lg">
                    <Ionicons name="trash-outline" size={18} color="white" />
                  </Pressable>
                )}
              </View>

              <View className="mb-6">
                <Text className="text-white font-bold text-[15px] mb-2 ml-1">Título do Anúncio</Text>
                <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center">
                  <TextInput
                    placeholder={isService ? 'Ex: Explicações de Álgebra' : 'Ex: Livro de Finanças'}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={title}
                    onChangeText={setTitle}
                    className="text-white text-[16px] font-medium"
                  />
                </View>
              </View>

              <View className="mb-6">
                <Text className="text-white font-bold text-[15px] mb-2 ml-1">Preço</Text>
                <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center flex-row items-center">
                  <TextInput
                    placeholder="Ex: 15"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                    className="text-white text-[16px] font-medium flex-1"
                  />
                  <Text className="text-white/50 font-bold text-[18px]">{isService ? '€/h' : '€'}</Text>
                </View>
              </View>

              {isService ? (
                <>
                  <View className="mb-6">
                    <Text className="text-white font-bold text-[15px] mb-2 ml-1">Formato</Text>
                    <View className="flex-row gap-3">
                      {(['Online', 'Presencial'] as const).map((f) => (
                        <Pressable key={f} onPress={() => setFormat(f)} className={`flex-1 py-3 rounded-xl border items-center ${format === f ? 'bg-[rgb(223,19,36)] border-[rgb(223,19,36)]' : 'bg-white/5 border-white/10'}`}>
                          <Text className={`font-bold ${format === f ? 'text-white' : 'text-gray-400'}`}>{f}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View className="mb-6">
                    <View className="flex-row justify-between items-center mb-2 px-1">
                      <Text className="text-white font-bold text-[15px]">Disponibilidade</Text>
                      <Pressable onPress={() => setShowDatePicker(true)} className="bg-[rgb(223,19,36)] px-3 py-1.5 rounded-lg flex-row items-center">
                        <Ionicons name="add" size={16} color="white" />
                        <Text className="text-white font-bold text-[12px] ml-1">Adicionar Horário</Text>
                      </Pressable>
                    </View>
                    {slots.length === 0 ? (
                      <Text className="text-white/40 text-[14px] ml-1 mt-2 italic">Nenhum horário adicionado.</Text>
                    ) : (
                      <View className="gap-2 mt-2">
                        {slots.map((slot) => (
                          <View key={slot.id} className="bg-white/10 border border-white/20 rounded-xl p-3 flex-row justify-between items-center">
                            <View className="flex-row items-center">
                              <Ionicons name="calendar-outline" size={18} color="white" />
                              <Text className="text-white font-medium mx-3">{slot.date.toLocaleDateString('pt-PT')}</Text>
                              <Ionicons name="time-outline" size={18} color="white" />
                              <Text className="text-white font-medium ml-2">{slot.time.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</Text>
                            </View>
                            <Pressable onPress={() => removeSlot(slot.id)} className="p-1">
                              <Ionicons name="trash-outline" size={20} color="#ff4444" />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                    {showDatePicker && <DateTimePicker value={tempDate} mode="date" display="default" onChange={handleDateChange} minimumDate={new Date()} />}
                    {showTimePicker && <DateTimePicker value={new Date()} mode="time" display="default" onChange={handleTimeChange} />}
                  </View>
                </>
              ) : (
                <>
                  <View className="mb-6">
                    <Text className="text-white font-bold text-[15px] mb-2 ml-1">Estado do Produto</Text>
                    <View className="flex-row justify-between gap-2">
                      {(['Novo', 'Pouco Uso', 'Muito Uso'] as const).map((c) => (
                        <Pressable key={c} onPress={() => setCondition(c)} className={`flex-1 py-3 rounded-xl border items-center ${condition === c ? 'bg-[rgb(223,19,36)] border-[rgb(223,19,36)]' : 'bg-white/5 border-white/10'}`}>
                          <Text className={`font-bold text-[12px] ${condition === c ? 'text-white' : 'text-gray-400'}`}>{c}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View className="mb-6">
                    <Text className="text-white font-bold text-[15px] mb-2 ml-1">Local da Entrega</Text>
                    <View className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 justify-center flex-row items-center">
                      <Ionicons name="location-outline" size={20} color="rgba(255,255,255,0.4)" />
                      <TextInput
                        placeholder="Ex: Cantina do ISCAC"
                        placeholderTextColor="rgba(255,255,255,0.4)"
                        value={deliveryLocation}
                        onChangeText={setDeliveryLocation}
                        className="text-white text-[16px] font-medium flex-1 ml-2"
                      />
                    </View>
                  </View>
                </>
              )}

              <View className="mb-8">
                <Text className="text-white font-bold text-[15px] mb-2 ml-1">Descrição</Text>
                <View className="bg-white/10 border border-white/20 rounded-2xl px-4 py-3 min-h-[120px]">
                  <TextInput
                    placeholder={isService ? 'Detalha o que vais ensinar, o teu método...' : 'Detalha o estado do produto, marcas de uso...'}
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    textAlignVertical="top"
                    className="text-white text-[16px] font-medium flex-1"
                  />
                </View>
              </View>
            </View>
          )}
          <View className="h-10" />
        </ScrollView>
      </KeyboardAvoidingView>

      <View className="px-5 pt-4 pb-12 border-t border-white/10 bg-[rgb(58,79,92)]">
        <Pressable
          onPress={handlePublicar}
          className={`${isEditing ? 'bg-white' : 'bg-[rgb(223,19,36)]'} py-4 rounded-xl items-center active:opacity-80`}
        >
          <Text className={`${isEditing ? 'text-black' : 'text-white'} font-black text-[18px] tracking-wide`}>
            {isEditing ? 'GUARDAR ALTERAÇÕES' : 'PUBLICAR'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}