import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { DeviceEventEmitter, Image, InteractionManager, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { AuthService } from '../../src/services/auth';
import {
  AnuncioRow, CompraRow, Curso, changePassword,
  enviarTicketSuporte,
  getCursos,
  getEstatisticasVendedor,
  getMinhasCompras,
  getMinhasVendas,
  getMyAnuncios,
  getPasswordAtual,
  hasUserRated, insertRating,
  marcarVendasComoLidas,
  softDeleteItem,
  updateFotoPerfil,
  updateUserProfile
} from '../../src/services/database';

import CloseModal from '../../components/CloseModal';
import FormInput from '../../components/FormInput';
import ProfileMenuOption from '../../components/ProfileMenuOption';
import SuporteTicketList from '../../components/SuporteTicketList';

const ImageMap: Record<string, any> = {
  'produtos/constituição_da_repu.png': require('../../assets/images/constituição_da_repu.png'),
};

const DEFAULT_IMAGE = require('../../assets/images/logo.png');

type SessionUser = {
  id: number;
  nome: string;
  email: string;
  curso: string;
  id_curso?: number;
  ano: number;
  foto_perfil: string | null;
};

export default function ProfileScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const isPickingImage = useRef(false);

  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [myAds, setMyAds] = useState<AnuncioRow[]>([]);
  const [compras, setCompras] = useState<CompraRow[]>([]);
  
  const [vendas, setVendas] = useState<any[]>([]);
  const [vendasModalVisible, setVendasModalVisible] = useState(false);
  
  const [totalVendas, setTotalVendas] = useState(0);

  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [tempStars, setTempStars] = useState(0);

  // ─── ESTADOS PARA O MENU DE SUPORTE ───
  const [supportMenuVisible, setSupportMenuVisible] = useState(false);
  const [ticketListModalVisible, setTicketListModalVisible] = useState(false);

  // Estados do Formulário de Suporte
  const [supportModalVisible, setSupportModalVisible] = useState(false);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportReason, setSupportReason] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [ticketRefreshKey, setTicketRefreshKey] = useState(0);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [editProfileModalVisible, setEditProfileModalVisible] = useState(false);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [editForm, setEditForm] = useState({ nome: '', id_curso: null as number | null, ano: '', cursoNome: '' });
  const [showEditCursoModal, setShowEditCursoModal] = useState(false);
  const [showEditAnoModal, setShowEditAnoModal] = useState(false);

  const [alertState, setAlertState] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'warning' as 'success' | 'error' | 'warning',
    showCancel: false,
    confirmText: 'Entendido',
    showCloseIcon: false,
    onConfirm: null as (() => void) | null
  });

  const [photoSelectionModalVisible, setPhotoSelectionModalVisible] = useState(false);

  const showAlert = (title: string, message: string, type: 'warning' | 'success' | 'error', showCancel = false, confirmText = 'Entendido', onConfirm: (() => void) | null = null, showCloseIcon = false) => {
    setAlertState({ visible: true, title, message, type, showCancel, confirmText, onConfirm, showCloseIcon });
  };

  const closeAlert = () => {
    setAlertState(prev => ({ ...prev, visible: false }));
  };

  const handleConfirmAlert = () => {
    const onConfirm = alertState.onConfirm;
    closeAlert();
    if (onConfirm) onConfirm();
  };

  useFocusEffect(
    useCallback(() => {
      if (isPickingImage.current) return;

      let isActive = true;
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

      const loadAll = async () => {
        try {
          const user = await AuthService.getCurrentUser();
          
          if (!isActive) return;
          setCurrentUser(user);

          if (!user || typeof user.id !== 'number') return;

          await marcarVendasComoLidas(user.id);
          DeviceEventEmitter.emit('updateBadges');

          const ads = await getMyAnuncios(user.id);
          const purchased = await getMinhasCompras(user.id);
          const minhasVendas = await getMinhasVendas(user.id);
          const listaCursos = await getCursos(); 
          
          const { totalGanho } = await getEstatisticasVendedor(user.id);
          setTotalVendas(totalGanho);
          
          if (!isActive) return;
          setMyAds(ads || []); 
          setCompras(purchased || []);
          setVendas(minhasVendas || []);
          setCursos(listaCursos || []);
        } catch (error) {
          console.error("Erro ao carregar perfil:", error);
        }
      };

      const task = InteractionManager.runAfterInteractions(() => {
        if (isActive) loadAll();
      });

      return () => {
        isActive = false;
        task.cancel(); 
      };
    }, [])
  );

  const getDynamicImage = (imgPath: string | null) => {
    if (!imgPath) return DEFAULT_IMAGE;
    if (imgPath.startsWith('file://') || imgPath.startsWith('http')) return { uri: imgPath };
    if (ImageMap[imgPath]) return ImageMap[imgPath];
    return DEFAULT_IMAGE;
  };

  const saveProfilePicture = async (uri: string) => {
    if (!currentUser) return;
    try {
      await updateFotoPerfil(currentUser.id, uri);
      const updatedUser = { ...currentUser, foto_perfil: uri };
      setCurrentUser(updatedUser);
      await AuthService.updateSession({ foto_perfil: uri });
    } catch {
      showAlert("Erro", "Não foi possível guardar a fotografia de perfil.", "error");
    }
  };

  const pickFromGallery = async () => {
    setPhotoSelectionModalVisible(false);
    isPickingImage.current = true; 
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        showAlert("Permissão Recusada", "Precisamos de acesso à tua galeria para alterar a foto!", "error");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await saveProfilePicture(result.assets[0].uri);
      }
    } finally {
      isPickingImage.current = false;
    }
  };

  const takePhoto = async () => {
    setPhotoSelectionModalVisible(false);
    isPickingImage.current = true;
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (permissionResult.granted === false) {
        showAlert("Permissão Recusada", "Precisamos de acesso à tua câmara para tirares uma foto!", "error");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        await saveProfilePicture(result.assets[0].uri);
      }
    } finally {
      isPickingImage.current = false;
    }
  };

  const handleImageSelection = () => {
    setPhotoSelectionModalVisible(true);
  };

  const handleRemoveAd = (ad: AnuncioRow) => {
    showAlert("Remover Publicação", "Tens a certeza que queres remover este anúncio?", "warning", true, "Remover", async () => {
      await softDeleteItem(ad.id, ad.type === 'servico');
      if (currentUser && currentUser.id) {
         const ads = await getMyAnuncios(currentUser.id);
         setMyAds(ads || []);
      }
    });
  };

  const handleEditAd = (ad: AnuncioRow) => {
    router.push({ pathname: '/publicacao', params: { id: ad.id, type: ad.type } });
  };

  const openRating = async (itemId: number) => {
    if (!currentUser) return;
    const alreadyRated = await hasUserRated(itemId, currentUser.id);
    if (alreadyRated) {
      showAlert("Atenção", "Não é possível avaliar novamente este serviço.", "warning");
    } else {
      setSelectedItemId(itemId);
      setTempStars(0);
      setRatingModalVisible(true);
    }
  };

  const submitRating = async () => {
    if (tempStars === 0) return showAlert("Aviso", "Por favor, seleciona pelo menos 1 estrela.", "warning");
    if (!selectedItemId || !currentUser) return;
    await insertRating(selectedItemId, currentUser.id, tempStars);
    setRatingModalVisible(false);
    showAlert("Obrigado!", "A tua avaliação foi registada.", "success");
  };

  // ─── FUNÇÕES DO NOVO MENU DE SUPORTE ───
  const handleOpenSupportMenu = () => {
    setSupportMenuVisible(true);
  };

  const openCreateSupport = () => {
    setSupportMenuVisible(false);
    if (currentUser) {
      setSupportEmail(currentUser.email);
    }
    setSupportReason('');
    setSupportMessage('');
    setSupportModalVisible(true);
  };

  const openTicketListViewer = () => {
    setSupportMenuVisible(false);
    setTicketListModalVisible(true);
  };

  const handleCloseSupport = () => {
    setSupportModalVisible(false);
    setSupportEmail('');
    setSupportReason('');
    setSupportMessage('');
  };

  const handleSupportSubmit = async () => {
    if (!supportEmail || !supportReason || !supportMessage) {
      return showAlert('Atenção', 'Por favor, preenche todos os campos antes de enviar.', "warning");
    }

    const success = await enviarTicketSuporte(
      supportEmail.trim().toLowerCase(),
      supportReason,
      supportMessage
    );

    if (success) {
      setSupportModalVisible(false);
      setTicketRefreshKey(prev => prev + 1); // Força a lista a recarregar
      showAlert("Mensagem Enviada", "O teu pedido foi enviado com sucesso. Podes acompanhar a resposta no menu 'Ver Meus Pedidos'.", "success");
    }
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
      return showAlert('Atenção', 'Por favor, preenche todos os campos.', "warning");
    }
    if (!currentUser) return;

    const passwordAtual = await getPasswordAtual(currentUser.id);
    if (!passwordAtual || passwordAtual !== currentPassword) {
      return showAlert('Erro', 'A password atual está incorreta.', "error");
    }
    if (currentPassword === newPassword) {
      return showAlert('Erro', 'A nova password não pode ser igual à atual.', "error");
    }
    if (newPassword !== confirmNewPassword) {
      return showAlert('Erro', 'A nova password e a confirmação não coincidem.', "error");
    }

    const success = await changePassword(currentUser.id, newPassword);
    handleClosePasswordModal();
    showAlert(
      success ? 'Sucesso' : 'Erro',
      success ? 'Password alterada com sucesso!' : 'Não foi possível alterar a password.',
      success ? 'success' : 'error'
    );
  };

  const openEditProfile = () => {
    setEditForm({
      nome: currentUser?.nome || '',
      id_curso: currentUser?.id_curso || null,
      ano: currentUser?.ano ? currentUser.ano.toString() : '',
      cursoNome: currentUser?.curso || ''
    });
    setEditProfileModalVisible(true);
  };

  const handleEditProfileSubmit = async () => {
    if (!editForm.nome || !editForm.id_curso || !editForm.ano) {
      return showAlert('Atenção', 'Por favor, preenche todos os campos.', "warning");
    }
    if (!currentUser) return;

    const success = await updateUserProfile(currentUser.id, editForm.nome, editForm.id_curso, parseInt(editForm.ano));
    
    if (success) {
      const updatedUser = { 
        ...currentUser, 
        nome: editForm.nome, 
        id_curso: editForm.id_curso, 
        curso: editForm.cursoNome, 
        ano: parseInt(editForm.ano) 
      };
      setCurrentUser(updatedUser);
      await AuthService.updateSession(updatedUser);
      
      setEditProfileModalVisible(false);
      showAlert('Sucesso', 'O teu perfil foi atualizado.', 'success');
    } else {
      showAlert('Erro', 'Não foi possível atualizar o teu perfil.', 'error');
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
            <Text className="text-3xl font-black text-[rgb(223,19,36)]">{totalVendas.toFixed(2)}€</Text>
            <Text className="text-[11px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Ganho Total</Text>
          </View>
        </View>

        {/* MINHAS PUBLICAÇÕES */}
        <View className="mb-8">
          
          <View className="flex-row justify-between items-center mb-4 px-1">
            <Text className="text-xl font-bold text-white">Minhas Publicações</Text>
            <Pressable 
              onPress={() => setVendasModalVisible(true)} 
              className="flex-row items-center bg-[rgb(223,19,36)]/20 px-4 py-1.5 rounded-full border border-[rgb(223,19,36)]/30 active:bg-[rgb(223,19,36)]/30"
            >
              <Ionicons name="receipt" size={14} color="rgb(223,19,36)" />
              <Text className="text-[rgb(223,19,36)] text-[12px] font-bold ml-1.5">Ver Vendas</Text>
            </Pressable>
          </View>

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

        {/* COMPRAS RECENTES */}
        <View className="mb-8">
          <Text className="text-xl font-bold text-white mb-4 px-1">Compras Recentes</Text>
          
          {compras.length === 0 ? (
            <View className="bg-white/5 rounded-3xl p-6 items-center border border-white/10">
              <Ionicons name="cart-outline" size={36} color="rgba(255,255,255,0.5)" />
              <Text className="text-[15px] text-gray-300 text-center leading-6 mt-4 px-2">
                Não tens nenhuma compra efetuada nos últimos 30 dias.
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {compras.map((item, index) => (
                <Pressable 
                  key={`compra-${item.id_compra}-${item.itemId}-${index}`}
                  onPress={() => router.push({ 
                    pathname: item.type === 'Serviço' ? '/servicos' : '/produtos', 
                    params: { id: item.itemId, isPurchased: 'true' } 
                  })}
                  className="bg-white/5 border border-white/10 rounded-3xl w-56 mr-4 p-4 active:opacity-80"
                >
                  <View className="w-full h-32 rounded-2xl overflow-hidden mb-3 bg-white">
                    <Image source={getDynamicImage(item.image)} className="w-full h-full" resizeMode="cover" />
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
                    <Text className="text-white font-black text-[18px]">
                      {item.price ? item.price.replace('€/h', '').replace('€', '').trim() : '0'}€
                      {item.type === 'Serviço' && <Text className="text-[12px] font-normal text-gray-400">/h</Text>}
                    </Text>
                    {item.type === 'Serviço' && (
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); openRating(item.itemId); }}
                        className="bg-[#fbbf24]/20 border border-[#fbbf24]/30 px-3 py-1.5 rounded-lg flex-row items-center"
                      >
                        <Ionicons name="star-outline" size={14} color="#fbbf24" />
                        <Text className="text-[#fbbf24] font-bold text-[12px] ml-1">Avaliar</Text>
                      </Pressable>
                    )}
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* MENU */}
        <View className="bg-white/5 border border-white/10 rounded-3xl mb-10 overflow-hidden">
          <ProfileMenuOption icon="person-outline" title="Editar Perfil" onPress={openEditProfile} />
          <ProfileMenuOption icon="key-outline" title="Alterar Password" onPress={() => setPasswordModalVisible(true)} />
          <ProfileMenuOption icon="help-circle-outline" title="Suporte" onPress={handleOpenSupportMenu} />
          <ProfileMenuOption icon="log-out-outline" title="Terminar Sessão" onPress={() => setLogoutModalVisible(true)} isDanger={true} />
        </View>

      </ScrollView>

      {/* ======================================================== */}
      {/* NOVO MODAL: MENU DE SUPORTE (OPÇÕES) */}
      {/* ======================================================== */}
      <Modal animationType="slide" transparent visible={supportMenuVisible} onRequestClose={() => setSupportMenuVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[rgb(45,65,77)] rounded-t-3xl p-6 border-t border-white/10 pb-10">
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 -mt-2" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-white text-xl font-bold">Menu de Suporte</Text>
              <Pressable onPress={() => setSupportMenuVisible(false)} className="p-1 bg-white/10 rounded-full">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>

            <TouchableOpacity onPress={openCreateSupport} className="flex-row items-center bg-white/5 border border-white/10 p-4 rounded-2xl mb-4 active:bg-white/10">
              <View className="w-10 h-10 bg-[rgb(223,19,36)]/20 rounded-full items-center justify-center mr-4 border border-[rgb(223,19,36)]/30">
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="rgb(223,19,36)" />
              </View>
              <View>
                <Text className="text-white text-[16px] font-bold">Contactar Suporte</Text>
                <Text className="text-gray-400 text-[12px] mt-0.5">Criar um novo pedido de suporte.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={openTicketListViewer} className="flex-row items-center bg-white/5 border border-white/10 p-4 rounded-2xl active:bg-white/10">
              <View className="w-10 h-10 bg-[#fbbf24]/20 rounded-full items-center justify-center mr-4 border border-[#fbbf24]/30">
                <Ionicons name="list-outline" size={20} color="#fbbf24" />
              </View>
              <View>
                <Text className="text-white text-[16px] font-bold">Ver Meus Pedidos</Text>
                <Text className="text-gray-400 text-[12px] mt-0.5">Acompanhar chats em aberto.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* NOVO MODAL: VISUALIZADOR DE TICKETS (LISTA PRIVADA) */}
      {/* ======================================================== */}
      <Modal animationType="slide" transparent visible={ticketListModalVisible} onRequestClose={() => setTicketListModalVisible(false)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-[rgb(45,65,77)] rounded-t-3xl p-6 border-t border-white/10 h-[85%]">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-xl font-bold">Meus Pedidos de Suporte</Text>
              <Pressable onPress={() => setTicketListModalVisible(false)} className="p-1">
                <Ionicons name="close" size={24} color="white" />
              </Pressable>
            </View>

            <Text className="text-gray-400 text-sm mb-4 text-center">
              A visualizar o histórico para:{"\n"}
              <Text className="text-white font-bold">{currentUser?.email}</Text>
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
              {currentUser?.email && (
                <SuporteTicketList key={ticketRefreshKey} email={currentUser.email} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: HISTÓRICO DE VENDAS */}
      <Modal animationType="slide" transparent visible={vendasModalVisible} onRequestClose={() => setVendasModalVisible(false)}>
        <View className="flex-1 bg-[rgb(58,79,92)]">
          <View className="pt-14 pb-4 px-4 flex-row items-center border-b border-white/10 bg-[rgb(48,66,77)]">
            <Pressable onPress={() => setVendasModalVisible(false)} className="p-2 -ml-2 active:opacity-70">
              <Ionicons name="chevron-down" size={28} color="white" />
            </Pressable>
            <Text className="text-2xl font-extrabold text-white ml-2">Histórico de Vendas</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-5 pt-6 pb-10">
            {vendas.length === 0 ? (
              <View className="items-center justify-center mt-20">
                <Ionicons name="sad-outline" size={64} color="rgba(255,255,255,0.2)" />
                <Text className="text-gray-400 text-center text-[16px] mt-4 px-6 leading-6">
                  Ainda não fizeste nenhuma venda. Os teus artigos estão à espera de um comprador!
                </Text>
              </View>
            ) : (
              vendas.map((v, index) => {
                const cleanPrice = v.price ? v.price.replace('€/h', '').replace('€', '').trim() : '0';
                return (
                  <Pressable 
                    key={`venda-${v.id_compra}-${v.itemId}-${index}`} 
                    className="bg-white/5 p-4 rounded-2xl mb-4 border border-white/10 flex-row items-center active:bg-white/10"
                    onPress={() => {
                      setVendasModalVisible(false);
                      router.push({ 
                        pathname: v.type === 'Serviço' ? '/servicos' : '/produtos', 
                        params: { id: v.itemId, isPurchased: 'true' } 
                      });
                    }}
                  >
                    <View className="w-16 h-16 rounded-xl overflow-hidden bg-black/20 border border-white/5">
                      <Image source={getDynamicImage(v.image)} className="w-full h-full" resizeMode="cover" />
                    </View>
                    <View className="flex-1 ml-4">
                      <Text className="text-white font-bold text-[15px] mb-1" numberOfLines={2}>{v.title}</Text>
                      <Text className="text-gray-400 text-[13px]">
                        Comprado por <Text className="text-white font-bold">{v.comprador}</Text>
                      </Text>
                      <Text className="text-[rgb(223,19,36)] font-black text-[16px] mt-2">
                        {cleanPrice}€{v.type === 'Serviço' && <Text className="text-[12px] font-medium text-gray-400">/h</Text>}
                      </Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* MODAIS RESTANTES */}

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

      <CloseModal visible={passwordModalVisible} title="Alterar Password" onClose={handleClosePasswordModal}>
        <FormInput placeholder="Password atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry={true} />
        <FormInput placeholder="Nova password" value={newPassword} onChangeText={setNewPassword} secureTextEntry={true} />
        <FormInput placeholder="Confirmar nova password" value={confirmNewPassword} onChangeText={setConfirmNewPassword} secureTextEntry={true} />
        <Pressable
          onPress={handleChangePasswordSubmit}
          className="bg-[rgb(223,19,36)] py-4 rounded-xl items-center active:bg-[rgb(193,17,32)] mt-2"
        >
          <Text className="text-white font-bold text-[16px]">Atualizar</Text>
        </Pressable>
      </CloseModal>

      {/* MODAL DE SUPORTE ATUALIZADO COM EMAIL BLOQUEADO */}
      <CloseModal visible={supportModalVisible} title="Contactar Suporte" onClose={handleCloseSupport}>
        <View className="mb-4 bg-white/5 p-4 rounded-xl border border-white/10">
          <Text className="text-gray-400 text-xs uppercase font-bold mb-1">O teu Email</Text>
          <Text className="text-white font-medium">{supportEmail}</Text>
        </View>
        <FormInput placeholder="Assunto" value={supportReason} onChangeText={setSupportReason} />
        <FormInput placeholder="Escreve aqui a tua mensagem detalhada..." value={supportMessage} onChangeText={setSupportMessage} isMultiline={true} />
        <Pressable
          onPress={handleSupportSubmit}
          className="bg-[rgb(223,19,36)] py-4 rounded-xl items-center active:bg-[rgb(193,17,32)]"
        >
          <Text className="text-white font-bold text-[16px]">Enviar Mensagem</Text>
        </Pressable>
      </CloseModal>

      {/* ======================================================== */}
      {/* NOVO MODAL: EDITAR PERFIL                                */}
      {/* ======================================================== */}
      <CloseModal visible={editProfileModalVisible} title="Editar Perfil" onClose={() => setEditProfileModalVisible(false)}>
        <FormInput placeholder="Nome Completo" value={editForm.nome} onChangeText={(t) => setEditForm({...editForm, nome: t})} />
        
        {/* Dropdown de Curso */}
        <Pressable 
          onPress={() => setShowEditCursoModal(true)}
          className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 flex-row items-center justify-between mb-4"
        >
          <Text className={`font-medium ${editForm.cursoNome ? 'text-white' : 'text-[rgba(255,255,255,0.4)]'}`} numberOfLines={1}>
            {editForm.cursoNome || "Seleciona o teu Curso"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.4)" />
        </Pressable>

        {/* Dropdown de Ano */}
        <Pressable 
          onPress={() => setShowEditAnoModal(true)}
          className="bg-white/10 border border-white/20 rounded-2xl px-4 h-14 flex-row items-center justify-between mb-4"
        >
          <Text className={`font-medium ${editForm.ano ? 'text-white' : 'text-[rgba(255,255,255,0.4)]'}`}>
            {editForm.ano ? `${editForm.ano}º Ano` : "Ano de Curso"}
          </Text>
          <Ionicons name="chevron-down" size={20} color="rgba(255,255,255,0.4)" />
        </Pressable>

        <Pressable
          onPress={handleEditProfileSubmit}
          className="bg-[rgb(223,19,36)] py-4 rounded-xl items-center active:bg-[rgb(193,17,32)] mt-2"
        >
          <Text className="text-white font-bold text-[16px]">Guardar Alterações</Text>
        </Pressable>
      </CloseModal>

      {/* MODAL SECUNDÁRIO: SELECIONAR CURSO (EDICAO) */}
      <Modal visible={showEditCursoModal} transparent animationType="slide" onRequestClose={() => setShowEditCursoModal(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setShowEditCursoModal(false)}>
          <Pressable className="bg-[rgb(48,66,77)] rounded-t-3xl p-6 pb-10 max-h-[60%] border-t border-white/10" onPress={(e) => e.stopPropagation()}>
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 -mt-2" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-white">Seleciona o Curso</Text>
              <Pressable onPress={() => setShowEditCursoModal(false)} className="bg-white/10 p-2 rounded-full">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {cursos.map((c) => {
                const isSelected = editForm.id_curso === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setEditForm({ ...editForm, id_curso: c.id, cursoNome: c.nome });
                      setShowEditCursoModal(false);
                    }}
                    className={`py-4 border-b border-white/5 flex-row justify-between items-center ${isSelected ? 'bg-white/5 px-3 rounded-xl border-b-0' : ''}`}
                  >
                    <Text className={`text-[16px] ${isSelected ? 'font-bold text-[rgb(223,19,36)]' : 'text-gray-300'}`}>
                      {c.nome}
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="rgb(223,19,36)" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL SECUNDÁRIO: SELECIONAR ANO (EDICAO) */}
      <Modal visible={showEditAnoModal} transparent animationType="slide" onRequestClose={() => setShowEditAnoModal(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setShowEditAnoModal(false)}>
          <Pressable className="bg-[rgb(48,66,77)] rounded-t-3xl p-6 pb-10 border-t border-white/10" onPress={(e) => e.stopPropagation()}>
            <View className="w-12 h-1.5 bg-white/20 rounded-full self-center mb-6 -mt-2" />
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-white">Ano de Curso</Text>
              <Pressable onPress={() => setShowEditAnoModal(false)} className="bg-white/10 p-2 rounded-full">
                <Ionicons name="close" size={20} color="white" />
              </Pressable>
            </View>
            <View>
              {['1', '2', '3'].map((ano) => {
                const isSelected = editForm.ano === ano;
                return (
                  <Pressable
                    key={ano}
                    onPress={() => {
                      setEditForm({ ...editForm, ano: ano });
                      setShowEditAnoModal(false);
                    }}
                    className={`py-4 border-b border-white/5 flex-row justify-between items-center ${isSelected ? 'bg-white/5 px-3 rounded-xl border-b-0' : ''}`}
                  >
                    <Text className={`text-[16px] ${isSelected ? 'font-bold text-[rgb(223,19,36)]' : 'text-gray-300'}`}>
                      {ano}º Ano
                    </Text>
                    {isSelected && <Ionicons name="checkmark-circle" size={22} color="rgb(223,19,36)" />}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL: ALERTA CUSTOMIZADO */}
      {/* ======================================================== */}
      <Modal animationType="fade" transparent visible={alertState.visible} onRequestClose={closeAlert}>
        <View className="flex-1 justify-center items-center bg-black/70 px-6">
          <View className="bg-[rgb(48,66,77)] w-full rounded-3xl p-6 items-center shadow-2xl border border-white/10 relative">
            
            {alertState.showCloseIcon && (
              <Pressable onPress={closeAlert} className="absolute top-4 right-4 p-2 z-10 active:opacity-50">
                <Ionicons name="close" size={24} color="rgba(255,255,255,0.5)" />
              </Pressable>
            )}

            {/* Ícone Dinâmico */}
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