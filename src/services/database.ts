import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

export type Categoria = {
  id: number;
  nome: string;
  imagem: string | null;
};

export type Curso = {
  id: number;
  nome: string;
};

export type AnuncioRow = {
  id: number;
  type: 'produto' | 'servico';
  title: string;
  price: string;
  img: string | null;
  nome_vendedor?: string;
  condition?: string;
  rating?: number;
  reviews?: number;
  format?: string;
};

export type ProdutoDetalhe = {
  id: number;
  titulo: string;
  preco: string;
  estado: string;
  local_entrega: string;
  descricao: string;
  foto: string | null;
  id_utilizador: number;
  id_categoria: number;
  nome_vendedor: string;
  curso_vendedor: string;
};

export type ServicoDetalhe = {
  id: number;
  titulo: string;
  preco: string;
  formato: string;
  horario: string;
  descricao: string;
  foto: string | null;
  id_utilizador: number;
  id_categoria: number;
  nome_prestador: string;
  avaliacao_media: number;
  total_avaliacoes: number;
};

export type CompraRow = {
  id_compra: number;
  itemId: number;
  title: string;
  type: 'Produto' | 'Serviço';
  price: string;
  image: string | null;
  category: string;
  seller: string;
};

export type ConversaRow = {
  id: string;
  id_comprador: number;
  id_vendedor: number;
  id_produto: number | null;
  id_servico: number | null;
  data_atualizacao: string;
  nome_outro: string;
  titulo_anuncio: string;
  ultima_mensagem: string;
  nao_lidas: number;
  foto_outro?: string | null;
};
 
export type MensagemRow = {
  id: string;
  id_conversa: string;
  id_remetente: number;
  texto: string;
  lida: boolean;
  data_envio: string;
  ativo?: number;
};

// ─── UPLOADER UNIVERSAL ───────────────────────────────────────────────────────

export const uploadImagemSupabase = async (uri: string, bucket: string): Promise<string | null> => {
  if (!uri || uri.startsWith('http')) return uri;

  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const byteCharacters = atob(base64);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteArray[i] = byteCharacters.charCodeAt(i);
    }

    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${safeExt}`;
    const contentType = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg';

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(fileName, byteArray, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error(`Erro upload para ${bucket}:`, uploadError.message);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.error(`Exceção upload ${bucket}:`, e);
    return null;
  }
};

// ─── Cursos ───────────────────────────────────────────────────────────────────

export const getCursos = async (): Promise<Curso[]> => {
  const { data, error } = await supabase
    .from('core_curso')
    .select('id, nome')
    .order('nome');
  if (error) { console.error('ERRO getCursos:', error.message); return []; }
  return data ?? [];
};

// ─── Categorias ───────────────────────────────────────────────────────────────

export const getCategorias = async (): Promise<Categoria[]> => {
  const { data, error } = await supabase
    .from('core_categoria')
    .select('id, nome, imagem')
    .order('nome');
  if (error) { console.error('ERRO getCategorias:', error.message); return []; }
  return data ?? [];
};

// ─── Anúncios (Home + Destaques) ─────────────────────────────────────────────

export const getAllAnuncios = async (excludeUserId?: number | null): Promise<AnuncioRow[]> => {
  let prodQuery = supabase.from('core_produto').select('id, titulo, preco, foto, estado, core_utilizador(nome)').eq('ativo', 1).order('id', { ascending: false });
  if (excludeUserId) prodQuery = prodQuery.neq('id_utilizador', excludeUserId);

  const { data: produtos, error: errP } = await prodQuery;
  if (errP) console.error('ERRO getAllAnuncios (Produtos):', errP.message);

  let servQuery = supabase.from('core_servico').select('id, titulo, preco, foto, formato, core_utilizador(nome), core_avaliacao(estrelas)').eq('ativo', 1).order('id', { ascending: false });
  if (excludeUserId) servQuery = servQuery.neq('id_utilizador', excludeUserId);

  const { data: servicos, error: errS } = await servQuery;
  if (errS) console.error('ERRO getAllAnuncios (Serviços):', errS.message);

  const mappedProdutos: AnuncioRow[] = (produtos ?? []).map((p: any) => ({
    id: p.id, type: 'produto', title: p.titulo, price: p.preco, img: p.foto,
    condition: p.estado, nome_vendedor: p.core_utilizador?.nome ?? 'Utilizador',
  }));

  const mappedServicos: AnuncioRow[] = (servicos ?? []).map((s: any) => {
    const avaliacoes = s.core_avaliacao ?? [];
    const rating = avaliacoes.length > 0
      ? avaliacoes.reduce((sum: number, a: any) => sum + a.estrelas, 0) / avaliacoes.length : 0;
    return {
      id: s.id, type: 'servico', title: s.titulo, price: s.preco, img: s.foto,
      format: s.formato, nome_vendedor: s.core_utilizador?.nome ?? 'Utilizador',
      rating, reviews: avaliacoes.length,
    };
  });

  return [...mappedProdutos, ...mappedServicos];
};

export const getDestaques = async (excludeUserId: number | null, limitResult: number): Promise<AnuncioRow[]> => {
  let prodQuery = supabase.from('core_produto').select('id, titulo, preco, foto, estado, core_utilizador(nome)').eq('ativo', 1);
  if (excludeUserId) prodQuery = prodQuery.neq('id_utilizador', excludeUserId);

  let servQuery = supabase.from('core_servico').select('id, titulo, preco, foto, formato, core_utilizador(nome), core_avaliacao(estrelas)').eq('ativo', 1);
  if (excludeUserId) servQuery = servQuery.neq('id_utilizador', excludeUserId);

  const [{ data: produtos }, { data: servicos }, { data: favoritos }] = await Promise.all([
    prodQuery,
    servQuery,
    supabase.from('core_favorito').select('id_produto, id_servico').eq('ativo', 1)
  ]);

  const countFavs = (id: number, type: 'prod' | 'serv') => {
    return (favoritos || []).filter(f => type === 'prod' ? f.id_produto === id : f.id_servico === id).length;
  };

  const mappedProds = (produtos || []).map((p: any) => {
    const score = countFavs(p.id, 'prod') * 10;
    return {
      id: p.id, type: 'produto' as const, title: p.titulo, price: p.preco, img: p.foto,
      condition: p.estado, nome_vendedor: p.core_utilizador?.nome ?? 'Utilizador',
      _score: score, _id: p.id
    };
  });

  const mappedServs = (servicos || []).map((s: any) => {
    const avaliacoes = s.core_avaliacao ?? [];
    const rating = avaliacoes.length > 0 ? avaliacoes.reduce((sum: number, a: any) => sum + a.estrelas, 0) / avaliacoes.length : 0;
    let score = countFavs(s.id, 'serv') * 10;
    
    if (rating >= 4) score += (rating * 10); 

    return {
      id: s.id, type: 'servico' as const, title: s.titulo, price: s.preco, img: s.foto,
      format: s.formato, nome_vendedor: s.core_utilizador?.nome ?? 'Utilizador',
      rating, reviews: avaliacoes.length,
      _score: score, _id: s.id
    };
  });

  const all = [...mappedProds, ...mappedServs];
  
  all.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    return b._id - a._id; 
  });

  return all.slice(0, limitResult).map(({ _score, _id, ...rest }) => rest);
};

export const getAnunciosByCategoria = async (categoriaId: number): Promise<AnuncioRow[]> => {
  const { data: produtos, error: errP } = await supabase
    .from('core_produto')
    .select('id, titulo, preco, foto, estado, local_entrega, core_utilizador(nome)')
    .eq('ativo', 1)
    .eq('id_categoria', categoriaId)
    .order('id', { ascending: false });

  if (errP) console.error('ERRO getAnunciosByCategoria (Produtos):', errP.message);

  const { data: servicos, error: errS } = await supabase
    .from('core_servico')
    .select('id, titulo, preco, foto, formato, core_utilizador(nome), core_avaliacao(estrelas)')
    .eq('ativo', 1)
    .eq('id_categoria', categoriaId)
    .order('id', { ascending: false });

  if (errS) console.error('ERRO getAnunciosByCategoria (Serviços):', errS.message);

  const mappedProdutos: AnuncioRow[] = (produtos ?? []).map((p: any) => ({
    id: p.id,
    type: 'produto',
    title: p.titulo,
    price: p.preco,
    img: p.foto,
    condition: p.estado,
    nome_vendedor: p.core_utilizador?.nome ?? 'Utilizador',
  }));

  const mappedServicos: AnuncioRow[] = (servicos ?? []).map((s: any) => {
    const avaliacoes = s.core_avaliacao ?? [];
    const rating = avaliacoes.length > 0
      ? avaliacoes.reduce((sum: number, a: any) => sum + a.estrelas, 0) / avaliacoes.length
      : 0;
    return {
      id: s.id,
      type: 'servico',
      title: s.titulo,
      price: s.preco,
      img: s.foto,
      format: s.formato,
      nome_vendedor: s.core_utilizador?.nome ?? 'Utilizador',
      rating,
      reviews: avaliacoes.length,
    };
  });

  return [...mappedProdutos, ...mappedServicos];
};

// ─── Detalhe Produto e Serviço ───────────────────────────────────────────────

export const getProdutoById = async (id: number): Promise<ProdutoDetalhe | null> => {
  const { data, error } = await supabase
    .from('core_produto')
    .select(`
      id, titulo, preco, estado, local_entrega, descricao, foto, id_utilizador, id_categoria,
      core_utilizador ( nome, core_curso ( nome ) )
    `)
    .eq('id', id)
    .single();

  if (error) console.error('ERRO getProdutoById:', error.message);
  if (error || !data) return null;

  return {
    id: data.id,
    titulo: data.titulo,
    preco: data.preco,
    estado: data.estado,
    local_entrega: data.local_entrega,
    descricao: data.descricao,
    foto: data.foto,
    id_utilizador: data.id_utilizador,
    id_categoria: data.id_categoria,
    nome_vendedor: (data.core_utilizador as any)?.nome ?? '',
    curso_vendedor: (data.core_utilizador as any)?.core_curso?.nome ?? '',
  };
};

export const getServicoById = async (id: number): Promise<ServicoDetalhe | null> => {
  const { data, error } = await supabase
    .from('core_servico')
    .select(`
      id, titulo, preco, formato, horario, descricao, foto, id_utilizador, id_categoria,
      core_utilizador ( nome ),
      core_avaliacao ( estrelas )
    `)
    .eq('id', id)
    .single();

  if (error) console.error('ERRO getServicoById:', error.message);
  if (error || !data) return null;

  const avaliacoes = (data.core_avaliacao as any[]) ?? [];
  const avaliacao_media = avaliacoes.length > 0
    ? avaliacoes.reduce((sum, a) => sum + a.estrelas, 0) / avaliacoes.length
    : 0;

  return {
    id: data.id,
    titulo: data.titulo,
    preco: data.preco,
    formato: data.formato,
    horario: data.horario,
    descricao: data.descricao,
    foto: data.foto,
    id_utilizador: data.id_utilizador,
    id_categoria: data.id_categoria,
    nome_prestador: (data.core_utilizador as any)?.nome ?? '',
    avaliacao_media,
    total_avaliacoes: avaliacoes.length,
  };
};

// ─── Outros Anúncios (Misturados) ────────────────────────────────────────────

export const getOutrosAnunciosByUser = async (userId: number, excludeId: number, excludeType: 'produto' | 'servico'): Promise<AnuncioRow[]> => {
  const { data: produtos, error: errP } = await supabase
    .from('core_produto')
    .select('id, titulo, preco, foto')
    .eq('id_utilizador', userId)
    .eq('ativo', 1);

  if (errP) console.error('ERRO getOutrosAnunciosByUser (Produtos):', errP.message);

  const { data: servicos, error: errS } = await supabase
    .from('core_servico')
    .select('id, titulo, preco, foto')
    .eq('id_utilizador', userId)
    .eq('ativo', 1);

  if (errS) console.error('ERRO getOutrosAnunciosByUser (Serviços):', errS.message);

  const mp: AnuncioRow[] = (produtos ?? []).map((p: any) => ({
    id: p.id, type: 'produto' as const, title: p.titulo, price: p.preco, img: p.foto,
  }));
  const ms: AnuncioRow[] = (servicos ?? []).map((s: any) => ({
    id: s.id, type: 'servico' as const, title: s.titulo, price: s.preco, img: s.foto,
  }));

  const todos = [...mp, ...ms].filter(item => !(item.id === excludeId && item.type === excludeType));
  
  return todos.slice(0, 5);
};

// ─── Favoritos ────────────────────────────────────────────────────────────────

export const getFavoritos = async (userId: number): Promise<AnuncioRow[]> => {
  const { data: favProdutos, error: errP } = await supabase
    .from('core_favorito')
    .select('core_produto!inner ( id, titulo, preco, foto, ativo )')
    .eq('id_utilizador', userId)
    .eq('ativo', 1) 
    .eq('core_produto.ativo', 1);

  if (errP) console.error('ERRO getFavoritos (Produtos):', errP.message);

  const { data: favServicos, error: errS } = await supabase
    .from('core_favorito')
    .select('core_servico!inner ( id, titulo, preco, foto, ativo )')
    .eq('id_utilizador', userId)
    .eq('ativo', 1) 
    .eq('core_servico.ativo', 1);

  if (errS) console.error('ERRO getFavoritos (Serviços):', errS.message);

  const produtos: AnuncioRow[] = (favProdutos ?? [])
    .map((f: any) => f.core_produto)
    .filter(Boolean)
    .map((p: any) => ({ id: p.id, type: 'produto' as const, title: p.titulo, price: p.preco, img: p.foto }));

  const servicos: AnuncioRow[] = (favServicos ?? [])
    .map((f: any) => f.core_servico)
    .filter(Boolean)
    .map((s: any) => ({ id: s.id, type: 'servico' as const, title: s.titulo, price: s.preco, img: s.foto }));

  return [...produtos, ...servicos];
};

export const toggleFavorito = async (
  userId: number,
  itemId: number,
  isService: boolean
): Promise<boolean> => {
  const col = isService ? 'id_servico' : 'id_produto';

  const { data: existing, error: err1 } = await supabase
    .from('core_favorito')
    .select('id, ativo')
    .eq('id_utilizador', userId)
    .eq(col, itemId)
    .maybeSingle();

  if (err1) console.error('ERRO toggleFavorito (check):', err1.message);

  if (existing) {
    const novoAtivo = existing.ativo === 1 ? 0 : 1;
    const { error: err2 } = await supabase.from('core_favorito').update({ ativo: novoAtivo }).eq('id', existing.id);
    if (err2) console.error('ERRO toggleFavorito (update):', err2.message);
    return novoAtivo === 1;
  } else {
    const { error: err3 } = await supabase.from('core_favorito').insert({ id_utilizador: userId, [col]: itemId, ativo: 1 });
    if (err3) console.error('ERRO toggleFavorito (insert):', err3.message);
    return true;
  }
};

export const isFavorito = async (
  userId: number,
  itemId: number,
  isService: boolean
): Promise<boolean> => {
  const col = isService ? 'id_servico' : 'id_produto';
  const { data, error } = await supabase
    .from('core_favorito')
    .select('ativo')
    .eq('id_utilizador', userId)
    .eq(col, itemId)
    .maybeSingle();
    
  if (error) console.error('ERRO isFavorito:', error.message);
  return data?.ativo === 1;
};

// ─── Perfil e Compras ─────────────────────────────────────────────────────────

export const getMyAnuncios = async (userId: number): Promise<AnuncioRow[]> => {
  const { data: produtos, error: errP } = await supabase
    .from('core_produto')
    .select('id, titulo, preco, foto')
    .eq('id_utilizador', userId)
    .eq('ativo', 1); 

  if (errP) console.error('ERRO getMyAnuncios (Produtos):', errP.message);

  const { data: servicos, error: errS } = await supabase
    .from('core_servico')
    .select('id, titulo, preco, foto')
    .eq('id_utilizador', userId)
    .eq('ativo', 1);

  if (errS) console.error('ERRO getMyAnuncios (Serviços):', errS.message);

  const mp: AnuncioRow[] = (produtos ?? []).map((p: any) => ({
    id: p.id, type: 'produto' as const, title: p.titulo, price: p.preco, img: p.foto,
  }));
  const ms: AnuncioRow[] = (servicos ?? []).map((s: any) => ({
    id: s.id, type: 'servico' as const, title: s.titulo, price: s.preco, img: s.foto,
  }));

  return [...mp, ...ms];
};

export const getMinhasCompras = async (userId: number): Promise<CompraRow[]> => {
  const { data: cp, error: errCp } = await supabase
    .from('core_compras')
    .select(`
      id,
      core_produto ( id, titulo, preco, foto, core_categoria ( nome ), core_utilizador ( nome ) )
    `)
    .eq('id_utilizador', userId)
    .not('id_produto', 'is', null)
    .order('data_transacao', { ascending: false });

  if (errCp) console.error('ERRO getMinhasCompras (Produtos):', errCp.message);

  const { data: cs, error: errCs } = await supabase
    .from('core_compras')
    .select(`
      id,
      core_servico ( id, titulo, preco, foto, core_categoria ( nome ), core_utilizador ( nome ) )
    `)
    .eq('id_utilizador', userId)
    .not('id_servico', 'is', null)
    .order('data_transacao', { ascending: false });

  if (errCs) console.error('ERRO getMinhasCompras (Serviços):', errCs.message);

  const comprasProdutos: CompraRow[] = (cp ?? []).map((c: any) => ({
    id_compra: c.id,
    itemId: c.core_produto?.id,
    title: c.core_produto?.titulo ?? '',
    type: 'Produto',
    price: c.core_produto?.preco ?? '',
    image: c.core_produto?.foto ?? null,
    category: c.core_produto?.core_categoria?.nome ?? '',
    seller: c.core_produto?.core_utilizador?.nome ?? '',
  }));

  const comprasServicos: CompraRow[] = (cs ?? []).map((c: any) => ({
    id_compra: c.id,
    itemId: c.core_servico?.id,
    title: c.core_servico?.titulo ?? '',
    type: 'Serviço',
    price: c.core_servico?.preco ?? '',
    image: c.core_servico?.foto ?? null,
    category: c.core_servico?.core_categoria?.nome ?? '',
    seller: c.core_servico?.core_utilizador?.nome ?? '',
  }));

  return [...comprasProdutos, ...comprasServicos];
};

export const processarCompra = async (userId: number, cartItems: any[], selectedSlotsData: any): Promise<void> => {
  for (const item of cartItems) {
    const isService = item.type === 'servico';
    const idItem = item.id;
    const idVendedor = item.sellerId || null; 
    
    const colName = isService ? 'id_servico' : 'id_produto';
    
    const { error } = await supabase.from('core_compras').insert({ 
      id_utilizador: userId, 
      id_vendedor: idVendedor,
      notificacao_lida: 0,
      data_transacao: new Date().toISOString(),
      [colName]: idItem 
    });

    if (error) {
      console.error("ERRO AO INSERIR COMPRA NA BD:", error.message);
      throw new Error(error.message); 
    }

    if (isService) {
      const servico = await getServicoById(idItem);
      if (servico && servico.horario) {
        try {
          const horariosAntigos = JSON.parse(servico.horario);
          const slotsEscolhidos = selectedSlotsData[idItem] || [];
          
          const horariosNovos = horariosAntigos.filter((h: any) => {
             const slotStr = `${h.date}_${h.time}`;
             return !slotsEscolhidos.includes(slotStr);
          });

          await supabase.from('core_servico').update({ horario: JSON.stringify(horariosNovos) }).eq('id', idItem);
          
        } catch (err) { 
          console.error("Erro ao atualizar horário do serviço:", err);
        }
      }
    } else {
      await softDeleteItem(idItem, false);
    }
  }
};

export const getEstatisticasVendedor = async (userId: number): Promise<{ totalGanho: number }> => {
  const { data } = await supabase.from('core_compras')
    .select('core_produto(preco), core_servico(preco)')
    .eq('id_vendedor', userId);

  let total = 0;
  if (data) {
    data.forEach((compra: any) => {
      const precoStr = compra.core_produto?.preco || compra.core_servico?.preco || '0';
      const valor = parseFloat(precoStr.replace('€/h', '').replace('€', '').trim());
      if (!isNaN(valor)) total += valor;
    });
  }
  return { totalGanho: total };
};

export const marcarVendasComoLidas = async (userId: number): Promise<void> => {
  await supabase.from('core_compras').update({ notificacao_lida: 1 }).eq('id_vendedor', userId).eq('notificacao_lida', 0);
};

export const softDeleteItem = async (id: number, isService: boolean): Promise<void> => {
  const table = isService ? 'core_servico' : 'core_produto';
  const { error } = await supabase.from(table).update({ ativo: 0 }).eq('id', id);
  if (error) console.error('ERRO softDeleteItem:', error.message);
};

export const hasUserRated = async (servicoId: number, userId: number): Promise<boolean> => {
  const { count, error } = await supabase
    .from('core_avaliacao')
    .select('id', { count: 'exact', head: true })
    .eq('id_servico', servicoId)
    .eq('id_utilizador', userId);
  
  if (error) console.error('ERRO hasUserRated:', error.message);
  return (count ?? 0) > 0;
};

export const insertRating = async (servicoId: number, userId: number, estrelas: number): Promise<void> => {
  const { error } = await supabase
    .from('core_avaliacao')
    .insert({ id_servico: servicoId, id_utilizador: userId, estrelas });
  if (error) console.error('ERRO insertRating:', error.message);
};

// --- NOVA FUNÇÃO DE EDITAR PERFIL ---
export const updateUserProfile = async (userId: number, nome: string, cursoId: number, ano: number): Promise<boolean> => {
  const { error } = await supabase
    .from('core_utilizador')
    .update({ nome, id_curso: cursoId, ano })
    .eq('id', userId);
  if (error) { 
    console.error('ERRO updateUserProfile:', error.message); 
    return false; 
  }
  return true;
};

export const changePassword = async (userId: number, newPassword: string): Promise<boolean> => {
  const { error } = await supabase
    .from('core_utilizador')
    .update({ password: newPassword })
    .eq('id', userId);
  if (error) { console.error('ERRO changePassword:', error.message); return false; }
  return true;
};

export const getPasswordAtual = async (userId: number): Promise<string | null> => {
  const { data, error } = await supabase
    .from('core_utilizador')
    .select('password')
    .eq('id', userId)
    .single();
  if (error) console.error('ERRO getPasswordAtual:', error.message);
  return data?.password ?? null;
};

// ─── Publicação ───────────────────────────────────────────────────────────────

export const insertProduto = async (
  userId: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string, estado: string, localEntrega: string
): Promise<void> => {
  let finalFoto = foto ?? '';
  if (foto && foto.startsWith('file://')) {
    finalFoto = await uploadImagemSupabase(foto, 'anuncios') || '';
  }

  const { error } = await supabase.from('core_produto').insert({
    titulo, id_utilizador: userId, id_categoria: categoriaId,
    preco, local_entrega: localEntrega, descricao, estado, 
    ativo: 1, 
    foto: finalFoto,
  });
  if (error) throw new Error(error.message);
};

export const insertServico = async (
  userId: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string, formato: string, horario: string
): Promise<void> => {
  let finalFoto = foto ?? '';
  if (foto && foto.startsWith('file://')) {
    finalFoto = await uploadImagemSupabase(foto, 'anuncios') || '';
  }

  const { error } = await supabase.from('core_servico').insert({
    titulo, id_utilizador: userId, id_categoria: categoriaId,
    preco, formato, horario, descricao, 
    ativo: 1, 
    foto: finalFoto,
  });
  if (error) throw new Error(error.message);
};

export const updateProduto = async (
  id: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string, estado: string, localEntrega: string
): Promise<void> => {
  let finalFoto = foto ?? '';
  if (foto && foto.startsWith('file://')) {
    finalFoto = await uploadImagemSupabase(foto, 'anuncios') || '';
  }

  const { error } = await supabase.from('core_produto').update({
    titulo, preco, foto: finalFoto, id_categoria: categoriaId,
    descricao, estado, local_entrega: localEntrega,
  }).eq('id', id);
  if (error) throw new Error(error.message);
};

export const updateServico = async (
  id: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string, formato: string, horario: string
): Promise<void> => {
  let finalFoto = foto ?? '';
  if (foto && foto.startsWith('file://')) {
    finalFoto = await uploadImagemSupabase(foto, 'anuncios') || '';
  }

  const { error } = await supabase.from('core_servico').update({
    titulo, preco, foto: finalFoto, id_categoria: categoriaId,
    descricao, formato, horario,
  }).eq('id', id);
  if (error) throw new Error(error.message);
};

export const getItemByIdAndType = async (id: number, isService: boolean) => {
  const table = isService ? 'core_servico' : 'core_produto';
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) console.error('ERRO getItemByIdAndType:', error.message);
  return data ?? null;
};

export const updateFotoPerfil = async (userId: number, uri: string): Promise<void> => {
  let finalUri = uri;
  if (uri.startsWith('file://')) {
    const uploadedUrl = await uploadImagemSupabase(uri, 'perfis');
    if (uploadedUrl) finalUri = uploadedUrl;
  }

  const { error } = await supabase
    .from('core_utilizador')
    .update({ foto_perfil: finalUri })
    .eq('id', userId);
  if (error) throw new Error(error.message);
};

export const getOuCriarConversa = async (
  compradorId: number,
  vendedorId: number,
  itemId: number,
  isService: boolean
): Promise<string | null> => {
  const col = isService ? 'id_servico' : 'id_produto';

  const { data: existing } = await supabase.from('core_conversa').select('id')
    .eq('id_comprador', compradorId).eq('id_vendedor', vendedorId).eq(col, itemId).maybeSingle();

  if (existing) return existing.id;

  const { data: nova, error } = await supabase.from('core_conversa')
    .insert({ id_comprador: compradorId, id_vendedor: vendedorId, [col]: itemId })
    .select('id').single();

  if (error) { console.error('getOuCriarConversa:', error.message); return null; }
  return nova.id;
};

export const getMinhasConversas = async (userId: number): Promise<ConversaRow[]> => {
  const { data, error } = await supabase
    .from('core_conversa')
    .select(`
      id, id_comprador, id_vendedor, id_produto, id_servico, data_atualizacao,
      comprador:core_utilizador!core_conversa_id_comprador_fkey ( nome, foto_perfil ),
      vendedor:core_utilizador!core_conversa_id_vendedor_fkey ( nome, foto_perfil ),
      produto:core_produto ( titulo ),
      servico:core_servico ( titulo ),
      core_mensagem ( texto, lida, id_remetente, data_envio, ativo ) 
    `) 
    .or(`id_comprador.eq.${userId},id_vendedor.eq.${userId}`)
    .order('data_atualizacao', { ascending: false });

  if (error) { console.error('getMinhasConversas:', error.message); return []; }

  return (data ?? [])
    .map((c: any) => {
      const todasMensagens: any[] = c.core_mensagem ?? [];
      const mensagensVisiveis = todasMensagens.filter(m => m.ativo === 1 || m.id_remetente === userId);
      
      if (mensagensVisiveis.length === 0) return null;

      const ultima = mensagensVisiveis.sort((a: any, b: any) =>
        new Date(b.data_envio).getTime() - new Date(a.data_envio).getTime()
      )[0];

      const naoLidas = mensagensVisiveis.filter((m: any) => !m.lida && m.id_remetente !== userId && m.ativo === 1).length;
      const isComprador = c.id_comprador === userId;
      const outro = isComprador ? c.vendedor : c.comprador;

      let textoUltima = ultima?.texto ?? '';
      if (ultima?.ativo === 0) {
        textoUltima = '🚫 Mensagem eliminada';
      } else if (textoUltima.startsWith('IMG::')) {
        textoUltima = '📷 Fotografia';
      }

      return {
        id: c.id,
        id_comprador: c.id_comprador,
        id_vendedor: c.id_vendedor,
        id_produto: c.id_produto,
        id_servico: c.id_servico,
        data_atualizacao: c.data_atualizacao,
        nome_outro: outro?.nome ?? 'Utilizador',
        foto_outro: outro?.foto_perfil ?? null,
        titulo_anuncio: c.produto?.titulo ?? c.servico?.titulo ?? 'Anúncio',
        ultima_mensagem: textoUltima,
        nao_lidas: naoLidas,
      };
    })
    .filter(Boolean) as ConversaRow[];
};

export const getMensagens = async (conversaId: string): Promise<MensagemRow[]> => {
  const { data, error } = await supabase.from('core_mensagem')
    .select('id, id_conversa, id_remetente, texto, lida, data_envio, ativo')
    .eq('id_conversa', conversaId)
    .order('data_envio', { ascending: true }); 
  if (error) { console.error('getMensagens:', error.message); return []; }
  return data ?? [];
};

export const enviarMensagem = async (
  conversaId: string, remetenteId: number, texto: string
): Promise<MensagemRow | null> => {
  const { data, error } = await supabase.from('core_mensagem')
    .insert({ id_conversa: conversaId, id_remetente: remetenteId, texto })
    .select().single();
  if (error) { console.error('enviarMensagem:', error.message); return null; }
  return data;
};

export const editarMensagem = async (id: string, novoTexto: string): Promise<boolean> => {
  const { error } = await supabase
    .from('core_mensagem')
    .update({ texto: novoTexto })
    .eq('id', id);
  if (error) { console.error('editarMensagem:', error.message); return false; }
  return true;
};

export const apagarMensagem = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('core_mensagem')
    .update({ ativo: 0 })
    .eq('id', id);
  if (error) { console.error('apagarMensagem:', error.message); return false; }
  return true;
};

export const uploadImagemChat = async (uri: string): Promise<string | null> => {
  return await uploadImagemSupabase(uri, 'chat-imagens');
};

export const marcarComoLidas = async (conversaId: string, userId: number): Promise<void> => {
  await supabase.from('core_mensagem').update({ lida: true })
    .eq('id_conversa', conversaId).neq('id_remetente', userId);
};

export const getFotoPerfilById = async (userId: number): Promise<string | null> => {
  const { data } = await supabase.from('core_utilizador').select('foto_perfil').eq('id', userId).single();
  return data?.foto_perfil ?? null;
};

// ─── NOVA FUNÇÃO: Histórico de Vendas ─────────────────────────────────────────

export const getMinhasVendas = async (userId: number): Promise<any[]> => {
  const { data: compras } = await supabase
    .from('core_compras')
    .select(`
      id,
      id_utilizador,
      data_transacao,
      core_produto ( id, titulo, preco, foto ),
      core_servico ( id, titulo, preco, foto )
    `)
    .eq('id_vendedor', userId)
    .order('data_transacao', { ascending: false });

  if (!compras) return [];

  const vendas = await Promise.all(compras.map(async (c: any) => {
    const { data: user } = await supabase.from('core_utilizador').select('nome').eq('id', c.id_utilizador).single();
    
    const isProd = !!c.core_produto;
    const item = c.core_produto || c.core_servico;
    
    return {
      id_compra: c.id,
      itemId: item?.id,
      title: item?.titulo ?? 'Item Desconhecido',
      type: isProd ? 'Produto' : 'Serviço',
      price: item?.preco ?? '0',
      image: item?.foto ?? null,
      comprador: user?.nome ?? 'Utilizador Desconhecido',
      data: c.data_transacao
    };
  }));

  return vendas;
};

// ─── SUPORTE (TICKETS E CHAT) ─────────────────────────────────────────────────

export type TicketSuporte = {
  id: number;
  email: string;
  assunto: string;
  mensagem: string;
  data_envio: string; 
  resolvido: boolean; 
};

export type MensagemSuporte = {
  id: number;
  ticket_id: number;
  remetente: 'aluno' | 'admin'; // Corrigido para 'remetente'
  mensagem: string;
  data_envio: string;
};

export const enviarTicketSuporte = async (email: string, assunto: string, mensagem: string): Promise<boolean> => {
  const { data: ticket, error: ticketError } = await supabase
    .from('core_suporte')
    .insert({ email, assunto, mensagem })
    .select('id')
    .single();

  if (ticketError) {
    console.error('Erro ao enviar suporte:', ticketError.message);
    return false;
  }

  await supabase.from('core_suporte_mensagens').insert({
    ticket_id: ticket.id,
    remetente: 'aluno', // Corrigido
    mensagem: mensagem
  });

  return true;
};

export const getTicketsByEmail = async (email: string): Promise<TicketSuporte[]> => {
  const { data, error } = await supabase
    .from('core_suporte')
    .select('id, email, assunto, mensagem, data_envio, resolvido')
    .eq('email', email.toLowerCase())
    .order('data_envio', { ascending: false });

  if (error) { console.error('ERRO getTicketsByEmail:', error.message); return []; }
  return data ?? [];
};

export const getMensagensTicket = async (ticketId: number): Promise<MensagemSuporte[]> => {
  const { data, error } = await supabase
    .from('core_suporte_mensagens')
    .select('id, ticket_id, remetente, mensagem, data_envio') // Corrigido
    .eq('ticket_id', ticketId)
    .order('data_envio', { ascending: true });

  if (error) { console.error('ERRO getMensagensTicket:', error.message); return []; }
  return data ?? [];
};

export const enviarMensagemSuporte = async (ticketId: number, mensagem: string, remetente: 'aluno' | 'admin' = 'aluno'): Promise<boolean> => {
  const { error } = await supabase
    .from('core_suporte_mensagens')
    .insert({ ticket_id: ticketId, remetente, mensagem }); // Corrigido

  if (error) { console.error('ERRO enviarMensagemSuporte:', error.message); return false; }
  return true;
};