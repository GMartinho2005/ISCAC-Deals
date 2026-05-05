import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Image, InteractionManager, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

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

  // ESTADO DOS MODAIS CUSTOMIZADOS
  const [photoSelectionModalVisible, setPhotoSelectionModalVisible] = useState(false);

  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    onConfirm: null as (() => void) | null
  });

  const showAlert = (title: string, message: string, type: 'warning' | 'success' | 'error' = 'warning', onConfirm: (() => void) | null = null) => {
    setAlertState({ visible: true, title, message, type, onConfirm });
  };

  const closeAlert = () => {
    const onConfirm = alertState.onConfirm;
    setAlertState(prev => ({ ...prev, visible: false, onConfirm: null }));
    if (onConfirm) onConfirm();
  };

  // A FUNÇÃO QUE FALTAVA!
  const handleConfirmAlert = () => {
    closeAlert();
  };

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
            
            if (ad.foto) setImageUri(ad.foto.startsWith('file://') || ad.foto.startsWith('http') ? ad.foto : `https://teu-servidor.com/media/${ad.foto}`);

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

  const pickFromGallery = async () => {
    setPhotoSelectionModalVisible(false);
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      showAlert("Permissão Recusada", "Precisamos de acesso à tua galeria para adicionares uma foto!", "error");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    setPhotoSelectionModalVisible(false);
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      showAlert("Permissão Recusada", "Precisamos de acesso à tua câmara para tirares uma foto!", "error");
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

  const handleImageSelection = () => {
    setPhotoSelectionModalVisible(true);
  };

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
      showAlert('Campos Incompletos', 'Por favor, preenche todos os campos textuais.', "warning");
      return;
    }

    // VERIFICAÇÃO OBRIGATÓRIA DA FOTO AQUI
    if (!imageUri) {
      showAlert('Fotografia Obrigatória', 'Tens de adicionar pelo menos uma fotografia ao teu anúncio para o poderes publicar.', "warning");
      return;
    }

    if (isService) {
      if (!format) return showAlert('Campos Incompletos', 'Por favor, escolhe o formato do serviço.', "warning");
      if (slots.length === 0) return showAlert('Campos Incompletos', 'Adiciona pelo menos um horário.', "warning");
    } else {
      if (!condition) return showAlert('Campos Incompletos', 'Escolhe o estado do produto.', "warning");
      if (!deliveryLocation.trim()) return showAlert('Campos Incompletos', 'Indica o local de entrega.', "warning");
    }

    if (!currentUserId) {
      showAlert('Erro de Sessão', 'Faz login novamente.', "error");
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
        showAlert('Sucesso', 'Publicação atualizada!', "success", () => router.back());
      } else {
        if (isService) {
          await insertServico(currentUserId, title.trim(), finalPrice, fotoDb, selectedCategory, descDb, formatDb, slotsDb);
        } else {
          await insertProduto(currentUserId, title.trim(), finalPrice, fotoDb, selectedCategory, descDb, condDb, locDb);
        }
        showAlert('Sucesso', 'Publicação criada com sucesso!', "success", () => router.back());
      }
    } catch (error: any) {
      console.error('Erro ao publicar:', error.message);
      showAlert('Erro', 'Não foi possível guardar a publicação.', "error");
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
                      <Text className="text-gray-500 text-[12px] mt-1">Carregar da galeria</Text>
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
                      <Text className="text-white font-bold text-[15px]">Disponibilidade (1h)</Text>
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
                              <Text className="text-white font-medium ml-2">
                                {slot.time.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.time.getTime() + 60 * 60 * 1000).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                              </Text>
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

      {/* MODAL SELEÇÃO IMAGEM */}
      <Modal animationType="slide" transparent visible={photoSelectionModalVisible} onRequestClose={() => setPhotoSelectionModalVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }} onPress={() => setPhotoSelectionModalVisible(false)}>
          <Pressable className="bg-[rgb(48,66,77)] rounded-t-3xl px-6 pt-3 pb-8" onPress={(e) => e.stopPropagation()}>
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 mt-1" />

            <Pressable className="flex-row items-center py-4 border-b border-white/5 active:opacity-50" onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="white" />
              <Text className="text-white text-[16px] font-medium ml-4">Tirar Foto</Text>
            </Pressable>

            <Pressable className="flex-row items-center py-4 border-b border-white/5 active:opacity-50" onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={24} color="white" />
              <Text className="text-white text-[16px] font-medium ml-4">Escolher da Galeria</Text>
            </Pressable>

            <Pressable className="flex-row items-center py-4 mt-2 active:opacity-50" onPress={() => setPhotoSelectionModalVisible(false)}>
              <Ionicons name="close-circle-outline" size={24} color="rgba(255,255,255,0.5)" />
              <Text className="text-white/50 text-[16px] font-medium ml-4">Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL ALERTA CUSTOMIZADO */}
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
            
            <TouchableOpacity 
              onPress={handleConfirmAlert}
              activeOpacity={0.8}
              className="bg-[rgb(223,19,36)] w-full h-[50px] rounded-xl justify-center items-center"
            >
              <Text className="text-white font-bold text-[16px]">Entendido</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </View>
  );
}