import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, Image, InteractionManager, Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { AuthService } from '../../src/services/auth';
import {
  AnuncioRow,
  changePassword,
  getMyAnuncios,
  hasUserRated,
  insertRating,
  setupDatabase,
  softDeleteItem,
} from '../../src/services/database';

import CloseModal from '../../components/CloseModal';
import FormInput from '../../components/FormInput';
import ProfileMenuOption from '../../components/ProfileMenuOption';

// ==========================================
// REDE DE SEGURANÇA (Dicionário de Imagens)
// ==========================================
const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../../assets/images/constituição_da_repu.png'),
};

const DEFAULT_IMAGE = require('../../assets/images/logo.png');

// Compras recentes — estáticas por enquanto (não há tabela na BD)
const PURCHASED_ITEMS = [
  { id: 1, title: 'Contabilidade de Gestão - 4ª Edição', type: 'Produto', category: 'Livros', seller: 'Ana Rita', price: '15€', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=400' },
  { id: 2, title: 'Explicações Análise Matemática II', type: 'Serviço', category: 'Explicações', seller: 'Eduardo', price: '12€/h', image: 'https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?q=80&w=400' },
];

type SessionUser = {
  id: number;
  nome: string;
  email: string;
  curso: string;
  ano: number;
  foto_perfil: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [myAds, setMyAds] = useState<AnuncioRow[]>([]);

  // Modais
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [tempStars, setTempStars] = useState(0);

  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportReason, setSupportReason] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      const loadAll = async () => {
        try {
          const user = await AuthService.getCurrentUser();
          
          if (!isActive) return;
          setCurrentUser(user);

          if (!user || typeof user.id !== 'number') {
            console.log("A aguardar ID do utilizador...");
            return; 
          }

          const ads = await getMyAnuncios(user.id);
          
          if (!isActive) return;
          setMyAds(ads || []); 
        } catch (error) {
          console.error("Erro ao carregar perfil:", error);
        }
      };

      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) {
          loadAll();
        }
      });

      return () => {
        isActive = false;
        task.cancel(); 
      };
    }, [])
  );

  // ==========================================
  // MOTOR DE IMAGENS DINÂMICO
  // ==========================================
  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  // ==========================================
  // ALTERAR FOTO DE PERFIL
  // ==========================================
  const handleImageSelection = () => {
    Alert.alert(
      "Alterar Foto de Perfil",
      "Como pretendes atualizar a tua fotografia?",
      [
        { text: "Tirar Foto", onPress: takePhoto },
        { text: "Escolher da Galeria", onPress: pickFromGallery },
        { text: "Cancelar", style: "cancel" }
      ]
    );
  };

  const saveProfilePicture = async (uri: string) => {
    if (!currentUser) return;
    try {
      const db = await setupDatabase();
      if (db) {
        await db.runAsync(`UPDATE core_utilizador SET foto_perfil = ? WHERE id = ?`, [uri, currentUser.id]);
        setCurrentUser({ ...currentUser, foto_perfil: uri });
      }
    } catch (error) {
      console.error("Erro ao atualizar foto de perfil:", error);
      Alert.alert("Erro", "Não foi possível guardar a fotografia de perfil.");
    }
  };

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permissão Recusada", "Precisamos de acesso à tua galeria para alterar a foto!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Quadrado perfeito
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      saveProfilePicture(result.assets[0].uri);
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
      aspect: [1, 1], // Quadrado perfeito
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      saveProfilePicture(result.assets[0].uri);
    }
  };
  // ==========================================

  const handleRemoveAd = (ad: AnuncioRow) => {
    Alert.alert("Remover Publicação", "Tens a certeza que queres remover este anúncio?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover", style: "destructive", onPress: async () => {
          await softDeleteItem(ad.id, ad.type === 'servico');
          if (currentUser && currentUser.id) {
             const ads = await getMyAnuncios(currentUser.id);
             setMyAds(ads || []);
          }
        }
      },
    ]);
  };

  const handleEditAd = (ad: AnuncioRow) => {
    router.push({ pathname: '/publicacao', params: { id: ad.id, type: ad.type } });
  };

  const openRating = async (itemId: number) => {
    if (!currentUser) return;
    const alreadyRated = await hasUserRated(itemId, currentUser.id);
    if (alreadyRated) {
      Alert.alert("Atenção", "Não é possível avaliar novamente este serviço.");
    } else {
      setSelectedItemId(itemId);
      setTempStars(0);
      setRatingModalVisible(true);
    }
  };

  const submitRating = async () => {
    if (tempStars === 0) return Alert.alert("Aviso", "Por favor, seleciona pelo menos 1 estrela.");
    if (!selectedItemId || !currentUser) return;
    await insertRating(selectedItemId, currentUser.id, tempStars);
    setRatingModalVisible(false);
    Alert.alert("Obrigado!", "A tua avaliação foi registada.");
  };

  const handleCloseSupport = () => {
    setSupportModalVisible(false);
    setSupportName('');
    setSupportEmail('');
    setSupportReason('');
    setSupportMessage('');
  };

  const handleSupportSubmit = () => {
    if (!supportName || !supportEmail || !supportReason || !supportMessage) {
      return Alert.alert('Atenção', 'Por favor, preenche todos os campos antes de enviar.');
    }
    handleCloseSupport();
    Alert.alert("Mensagem Enviada", "A equipa de suporte do ISCAC Deals recebeu a tua mensagem!");
  };

  const handleLogout = async () => {
    await AuthService.logout();
    setLogoutModalVisible(false);
    router.replace('/');
  };

  const handleClosePasswordModal = () => {
    setPasswordModalVisible(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const handleChangePasswordSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return Alert.alert('Atenção', 'Por favor, preenche todos os campos.');
    }
    if (currentPassword === newPassword) {
      return Alert.alert('Erro', 'A nova palavra-passe não pode ser igual à atual.');
    }
    if (newPassword !== confirmNewPassword) {
      return Alert.alert('Erro', 'A nova palavra-passe e a confirmação não coincidem.');
    }
    if (!currentUser) return;

    const success = await changePassword(currentUser.id, newPassword);
    handleClosePasswordModal();
    if (success) {
      Alert.alert("Sucesso", "A tua palavra-passe foi alterada com sucesso!");
    } else {
      Alert.alert("Erro", "Não foi possível alterar a palavra-passe.");
    }
  };

  return (
    <View className="flex-1 bg-[rgb(58,79,92)]">
      <View className="pt-14 pb-3 px-4 items-center justify-center border-b border-white/10">
        <Text className="text-3xl font-extrabold text-white">Perfil</Text>
      </View>

      <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-6">

        {/* INFO UTILIZADOR */}
        <View className="items-center mb-10">
          <Pressable onPress={handleImageSelection} className="relative active:opacity-80">
            <View className="w-32 h-32 bg-white/5 rounded-full items-center justify-center border border-white/20 overflow-hidden">
              {currentUser?.foto_perfil ? (
                <Image
                  source={getDynamicImage(currentUser.foto_perfil)}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-full h-full items-center justify-center">
                  <Ionicons name="person" size={50} color="rgba(255,255,255,0.4)" />
                </View>
              )}
            </View>
            <View className="absolute bottom-0 right-0 bg-[rgb(223,19,36)] w-10 h-10 rounded-full items-center justify-center border-[3px] border-[rgb(58,79,92)]">
              <Ionicons name="camera" size={18} color="white" />
            </View>
          </Pressable>
          <Text className="text-2xl font-extrabold text-white mt-4">
            {currentUser?.nome ?? '—'}
          </Text>
          <Text className="text-[15px] font-medium text-gray-300 mt-1">
            {currentUser?.email ?? '—'}
          </Text>
          {currentUser?.curso ? (
            <Text className="text-[13px] text-gray-400 mt-1">
              {currentUser.curso} · {currentUser.ano}º ano
            </Text>
          ) : null}
        </View>

        {/* ESTATÍSTICAS */}
        <View className="flex-row justify-between bg-white/5 border border-white/10 rounded-3xl p-6 mb-8">
          <View className="items-center flex-1 border-r border-white/10">
            <Text className="text-3xl font-black text-white">{myAds.length}</Text>
            <Text className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Publicações</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-3xl font-black text-[rgb(223,19,36)]">0€</Text>
            <Text className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Ganho Total</Text>
          </View>
        </View>

        {/* MINHAS PUBLICAÇÕES */}
        <View className="mb-8">
          <Text className="text-xl font-bold text-white mb-4 px-1">Minhas Publicações</Text>
          {myAds.length === 0 ? (
            <View className="bg-white/5 rounded-3xl p-8 items-center border border-white/10">
              <Ionicons name="albums-outline" size={36} color="rgba(255,255,255,0.5)" />
              <Text className="text-[15px] text-gray-300 text-center leading-6 mb-6 mt-4">
                <Text className="font-bold text-white text-[16px]">Ainda não tens publicações.{"\n"}</Text>
                Livros a ganhar pó? Dá-lhes uma nova vida!
              </Text>
              <Pressable
                onPress={() => router.push('/publicacao')}
                className="bg-[rgb(223,19,36)] px-8 py-4 rounded-xl flex-row items-center active:bg-[rgb(193,17,32)] w-full justify-center"
              >
                <Ionicons name="add-circle-outline" size={22} color="white" />
                <Text className="text-white font-bold text-[16px] ml-2">Criar Publicação</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {myAds.map((ad) => (
                <Pressable 
                  key={`${ad.type}-${ad.id}`} 
                  onPress={() => router.push({ pathname: ad.type === 'servico' ? '/servicos' : '/produtos', params: { id: ad.id } })}
                  className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex-row active:opacity-80"
                >
                  <View className="w-24 h-24 rounded-xl overflow-hidden bg-white/10 items-center justify-center p-1">
                    <Image
                      source={getDynamicImage(ad.img)}
                      className="w-full h-full rounded-lg"
                      resizeMode="cover"
                    />
                  </View>
                  <View className="flex-1 ml-4 justify-between py-1">
                    <View>
                      <View className="bg-white/10 self-start px-2 py-0.5 rounded-md mb-1">
                        <Text className="text-white text-[10px] font-bold uppercase">
                          {ad.type === 'servico' ? 'Serviço' : 'Produto'}
                        </Text>
                      </View>
                      <Text className="text-white font-bold text-[15px]" numberOfLines={2}>{ad.title}</Text>
                      <Text className="text-[rgb(223,19,36)] font-black text-[15px]">
                        {ad.price ? ad.price.replace('€/h', '').replace('€', '').trim() : '0'}€
                        {ad.type === 'servico' && <Text className="text-[11px] font-normal text-gray-300">/h</Text>}
                      </Text>
                    </View>
                    <View className="flex-row gap-3 mt-3">
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation(); 
                          handleEditAd(ad);
                        }}
                        className="bg-white/10 px-4 py-2 rounded-lg flex-1 items-center"
                      >
                        <Text className="text-white font-bold text-[13px]">Editar</Text>
                      </Pressable>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRemoveAd(ad);
                        }}
                        className="bg-red-500/20 px-4 py-2 rounded-lg flex-1 items-center border border-red-500/30"
                      >
                        <Text className="text-red-400 font-bold text-[13px]">Remover</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              ))}
              <Pressable
                onPress={() => router.push('/publicacao')}
                className="bg-white/5 border border-dashed border-white/30 p-4 rounded-2xl items-center mt-2 flex-row justify-center active:opacity-80"
              >
                <Ionicons name="add" size={20} color="white" />
                <Text className="text-white font-bold ml-2">Adicionar Novo Anúncio</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* COMPRAS RECENTES (estáticas) */}
        {PURCHASED_ITEMS.length > 0 && (
          <View className="mb-8">
            <Text className="text-xl font-bold text-white mb-4 px-1">Compras Recentes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {PURCHASED_ITEMS.map((item) => (
                <View key={item.id} className="bg-white/5 border border-white/10 rounded-3xl w-56 mr-4 p-4">
                  <View className="w-full h-32 rounded-2xl overflow-hidden mb-3 bg-white">
                    <Image source={{ uri: item.image }} className="w-full h-full" resizeMode="cover" />
                    <View className="absolute inset-0 bg-black/20" />
                    <View className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-md">
                      <Text className="text-white text-[10px] font-bold uppercase tracking-wider">{item.category}</Text>
                    </View>
                  </View>
                  <Text className="text-white font-bold text-[15px] leading-tight mb-1" numberOfLines={2}>{item.title}</Text>
                  <View className="flex-row items-center mb-3 mt-1">
                    <Ionicons name="person-outline" size={12} color="rgba(255,255,255,0.5)" />
                    <Text className="text-gray-400 text-[12px] ml-1">{item.seller}</Text>
                  </View>
                  <View className="flex-row items-center justify-between mt-auto">
                    <Text className="text-white font-black text-[18px]">{item.price}</Text>
                    {item.type === 'Serviço' && (
                      <Pressable
                        onPress={() => openRating(item.id)}
                        className="bg-[#fbbf24]/20 border border-[#fbbf24]/30 px-3 py-1.5 rounded-lg flex-row items-center"
                      >
                        <Ionicons name="star-outline" size={14} color="#fbbf24" />
                        <Text className="text-[#fbbf24] font-bold text-[12px] ml-1">Avaliar</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* MENU */}
        <View className="bg-white/5 border border-white/10 rounded-3xl mb-10 overflow-hidden">
          <ProfileMenuOption icon="key-outline" title="Alterar Palavra Passe" onPress={() => setPasswordModalVisible(true)} />
          <ProfileMenuOption icon="help-circle-outline" title="Suporte" onPress={() => setSupportModalVisible(true)} />
          <ProfileMenuOption icon="log-out-outline" title="Terminar Sessão" onPress={() => setLogoutModalVisible(true)} isDanger={true} />
        </View>

      </ScrollView>

      {/* MODAIS RESTANTES */}
      <Modal animationType="fade" transparent visible={ratingModalVisible} onRequestClose={() => setRatingModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-[rgb(58,79,92)] w-full rounded-3xl p-6 border border-white/10">
            <Text className="text-white text-xl font-bold text-center mb-2">Avaliar Serviço</Text>
            <Text className="text-gray-300 text-center mb-6">Como classificas a tua experiência?</Text>
            <View className="flex-row justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setTempStars(star)}>
                  <Ionicons
                    name={star <= tempStars ? "star" : "star-outline"}
                    size={40}
                    color={star <= tempStars ? "#fbbf24" : "rgba(255,255,255,0.2)"}
                  />
                </Pressable>
              ))}
            </View>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setRatingModalVisible(false)} className="flex-1 bg-white/10 py-3 rounded-xl items-center">
                <Text className="text-white font-bold">Cancelar</Text>
              </Pressable>
              <Pressable onPress={submitRating} className="flex-1 bg-[rgb(223,19,36)] py-3 rounded-xl items-center">
                <Text className="text-white font-bold">Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal animationType="fade" transparent visible={logoutModalVisible} onRequestClose={() => setLogoutModalVisible(false)}>
        <View className="flex-1 justify-center items-center bg-black/60 px-6">
          <View className="bg-[rgb(58,79,92)] w-full rounded-3xl p-6 border border-white/10">
            <View className="items-center mb-4">
              <View className="bg-red-500/20 p-4 rounded-full mb-2">
                <Ionicons name="log-out-outline" size={32} color="rgb(223, 19, 36)" />
              </View>
              <Text className="text-white text-xl font-bold text-center">Terminar Sessão</Text>
            </View>
            <Text className="text-gray-300 text-center mb-8">
              Tens a certeza que pretendes sair da tua conta do ISCAC Deals?
            </Text>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setLogoutModalVisible(false)} className="flex-1 bg-white/10 py-3 rounded-xl items-center">
                <Text className="text-white font-bold">Cancelar</Text>
              </Pressable>
              <Pressable onPress={handleLogout} className="flex-1 bg-[rgb(223,19,36)] py-3 rounded-xl items-center">
                <Text className="text-white font-bold">Sair</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CloseModal visible={passwordModalVisible} title="Alterar Palavra-Passe" onClose={handleClosePasswordModal}>
        <FormInput placeholder="Palavra-passe atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry={true} />
        <FormInput placeholder="Nova palavra-passe" value={newPassword} onChangeText={setNewPassword} secureTextEntry={true} />
        <FormInput placeholder="Confirmar nova palavra-passe" value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry={true} />
        <Pressable
          onPress={handleChangePasswordSubmit}
          className="bg-[rgb(223,19,36)] py-4 rounded-xl items-center active:bg-[rgb(193,17,32)] mt-2"
        >
          <Text className="text-white font-bold text-[16px]">Atualizar</Text>
        </Pressable>
      </CloseModal>

      <CloseModal visible={supportModalVisible} title="Contactar Suporte" onClose={handleCloseSupport}>
        <FormInput placeholder="Nome" value={supportName} onChangeText={setSupportName} />
        <FormInput placeholder="Email institucional (@alumni.iscac.pt)" value={supportEmail} onChangeText={setSupportEmail} keyboardType="email-address" autoCapitalize="none" />
        <FormInput placeholder="Motivo de contacto" value={supportReason} onChangeText={setSupportReason} />
        <FormInput placeholder="Escreve aqui a tua mensagem detalhada..." value={supportMessage} onChangeText={setSupportMessage} isMultiline={true} />
        <Pressable
          onPress={handleSupportSubmit}
          className="bg-[rgb(223,19,36)] py-4 rounded-xl items-center active:bg-[rgb(193,17,32)]"
        >
          <Text className="text-white font-bold text-[16px]">Enviar Mensagem</Text>
        </Pressable>
      </CloseModal>

    </View>
  );
}