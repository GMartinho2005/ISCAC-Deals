import { Asset } from 'expo-asset';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

// ─── Singleton ────────────────────────────────────────────────────────────────
// Uma única instância da BD para toda a app.
// Assim evitamos o NullPointerException causado por abrir a BD múltiplas vezes em paralelo.

let dbInstance: SQLite.SQLiteDatabase | null = null;
let isInitializing = false;
let initPromise: Promise<SQLite.SQLiteDatabase | null> | null = null;

export const setupDatabase = async (): Promise<SQLite.SQLiteDatabase | null> => {
  // Se já temos uma instância válida, devolvemos imediatamente
  if (dbInstance) return dbInstance;

  // Se já está a inicializar, esperamos pela mesma Promise
  if (isInitializing && initPromise) return initPromise;

  if (Platform.OS === 'web') return null;

  isInitializing = true;
  initPromise = (async () => {
    try {
      const FS = await import('expo-file-system/next');

      const dbDir  = new FS.Directory(FS.Paths.document, 'SQLite');
      const dbFile = new FS.File(dbDir, 'db.sqlite3');

      if (!dbDir.exists) {
        dbDir.create();
      }

      if (!dbFile.exists) {
        console.log('BD não encontrada, a copiar asset...');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const asset = await Asset.fromModule(require('../../assets/db.sqlite3')).downloadAsync();
        const uri = asset.localUri || asset.uri;
        if (!uri) {
          console.error('Asset sem URI válida!');
          return null;
        }
        const sourceFile = new FS.File(uri);
        sourceFile.copy(dbFile);
        console.log('BD copiada com sucesso.');
      }

      dbInstance = SQLite.openDatabaseSync('db.sqlite3');
      console.log('BD aberta com sucesso.');
      return dbInstance;

    } catch (error) {
      console.error('ERRO AO CARREGAR A BD:', error);
      dbInstance = null;
      return null;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
};

// Permite forçar reset da instância (útil em testes ou após logout)
export const resetDatabase = () => {
  dbInstance = null;
  isInitializing = false;
  initPromise = null;
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Categoria = {
  id: number;
  nome: string;
  imagem: string | null;
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

// ─── Helper interno ───────────────────────────────────────────────────────────
// Garante que temos sempre uma instância válida antes de qualquer query
const getDb = async (): Promise<SQLite.SQLiteDatabase | null> => {
  return dbInstance ?? await setupDatabase();
};

// ─── Categorias ───────────────────────────────────────────────────────────────

export const getCategorias = async (): Promise<Categoria[]> => {
  const db = await getDb();
  if (!db) return [];
  return db.getAllSync<Categoria>('SELECT id, nome, imagem FROM core_categoria ORDER BY nome');
};

// ─── Anúncios (Home + Destaques) ─────────────────────────────────────────────

export const getAllAnuncios = async (): Promise<AnuncioRow[]> => {
  const db = await getDb();
  if (!db) return [];

  const produtos = db.getAllSync<AnuncioRow>(
    `SELECT p.id, 'produto' as type, p.titulo as title, p.preco as price, p.foto as img,
            p.estado as condition, u.nome as nome_vendedor
     FROM core_produto p
     LEFT JOIN core_utilizador u ON p.id_utilizador = u.id
     WHERE p.ativo = 1 ORDER BY p.id DESC`
  );

  const servicos = db.getAllSync<AnuncioRow>(
    `SELECT s.id, 'servico' as type, s.titulo as title, s.preco as price, s.foto as img,
            s.formato as format, u.nome as nome_vendedor,
            COALESCE(AVG(a.estrelas), 0) as rating,
            COUNT(a.id) as reviews
     FROM core_servico s
     LEFT JOIN core_utilizador u ON s.id_utilizador = u.id
     LEFT JOIN core_avaliacao a ON s.id = a.id_servico
     WHERE s.ativo = 1 GROUP BY s.id ORDER BY s.id DESC`
  );

  return [...produtos, ...servicos];
};

export const getAnunciosByCategoria = async (categoriaId: number): Promise<AnuncioRow[]> => {
  const db = await getDb();
  if (!db) return [];

  const produtos = db.getAllSync<AnuncioRow>(
    `SELECT p.id, 'produto' as type, p.titulo as title, p.preco as price, p.foto as img,
            p.estado as condition, p.local_entrega as location, u.nome as nome_vendedor
     FROM core_produto p
     LEFT JOIN core_utilizador u ON p.id_utilizador = u.id
     WHERE p.ativo = 1 AND p.id_categoria = ? ORDER BY p.id DESC`,
    [categoriaId]
  );

  const servicos = db.getAllSync<AnuncioRow>(
    `SELECT s.id, 'servico' as type, s.titulo as title, s.preco as price, s.foto as img,
            s.formato as format, u.nome as nome_vendedor,
            COALESCE(AVG(a.estrelas), 0) as rating,
            COUNT(a.id) as reviews
     FROM core_servico s
     LEFT JOIN core_utilizador u ON s.id_utilizador = u.id
     LEFT JOIN core_avaliacao a ON s.id = a.id_servico
     WHERE s.ativo = 1 AND s.id_categoria = ?
     GROUP BY s.id ORDER BY s.id DESC`,
    [categoriaId]
  );

  return [...produtos, ...servicos] as AnuncioRow[];
};

// ─── Detalhe Produto ──────────────────────────────────────────────────────────

export const getProdutoById = async (id: number): Promise<ProdutoDetalhe | null> => {
  const db = await getDb();
  if (!db) return null;

  return db.getFirstSync<ProdutoDetalhe>(
    `SELECT p.id, p.titulo, p.preco, p.estado, p.local_entrega, p.descricao, p.foto,
            p.id_utilizador, p.id_categoria,
            u.nome as nome_vendedor, u.curso as curso_vendedor
     FROM core_produto p
     LEFT JOIN core_utilizador u ON p.id_utilizador = u.id
     WHERE p.id = ?`,
    [id]
  ) ?? null;
};

export const getOutrosProdutosByUser = async (userId: number, excludeId: number): Promise<AnuncioRow[]> => {
  const db = await getDb();
  if (!db) return [];
  return db.getAllSync<AnuncioRow>(
    `SELECT id, 'produto' as type, titulo as title, preco as price, foto as img
     FROM core_produto WHERE id_utilizador = ? AND id != ? AND ativo = 1 LIMIT 5`,
    [userId, excludeId]
  );
};

// ─── Detalhe Serviço ──────────────────────────────────────────────────────────

export const getServicoById = async (id: number): Promise<ServicoDetalhe | null> => {
  const db = await getDb();
  if (!db) return null;

  return db.getFirstSync<ServicoDetalhe>(
    `SELECT s.id, s.titulo, s.preco, s.formato, s.horario, s.descricao, s.foto,
            s.id_utilizador, s.id_categoria,
            u.nome as nome_prestador,
            COALESCE(AVG(a.estrelas), 0) as avaliacao_media,
            COUNT(a.id) as total_avaliacoes
     FROM core_servico s
     LEFT JOIN core_utilizador u ON s.id_utilizador = u.id
     LEFT JOIN core_avaliacao a ON s.id = a.id_servico
     WHERE s.id = ? GROUP BY s.id`,
    [id]
  ) ?? null;
};

export const getOutrosServicosByUser = async (userId: number, excludeId: number): Promise<AnuncioRow[]> => {
  const db = await getDb();
  if (!db) return [];
  return db.getAllSync<AnuncioRow>(
    `SELECT id, 'servico' as type, titulo as title, preco as price, foto as img
     FROM core_servico WHERE id_utilizador = ? AND id != ? AND ativo = 1 LIMIT 5`,
    [userId, excludeId]
  );
};

// ─── Perfil ───────────────────────────────────────────────────────────────────

export const getMyAnuncios = async (userId: number): Promise<AnuncioRow[]> => {
  const db = await getDb();
  if (!db) return [];

  const produtos = db.getAllSync<AnuncioRow>(
    `SELECT id, 'produto' as type, titulo as title, preco as price, foto as img
     FROM core_produto WHERE id_utilizador = ? AND ativo = 1`,
    [userId]
  );
  const servicos = db.getAllSync<AnuncioRow>(
    `SELECT id, 'servico' as type, titulo as title, preco as price, foto as img
     FROM core_servico WHERE id_utilizador = ? AND ativo = 1`,
    [userId]
  );
  return [...produtos, ...servicos];
};

export const softDeleteItem = async (id: number, isService: boolean): Promise<void> => {
  const db = await getDb();
  if (!db) return;
  db.runSync(`UPDATE ${isService ? 'core_servico' : 'core_produto'} SET ativo = 0 WHERE id = ?`, [id]);
};

export const hasUserRated = async (servicoId: number, userId: number): Promise<boolean> => {
  const db = await getDb();
  if (!db) return false;
  const row = db.getFirstSync<{ count: number }>(
    `SELECT COUNT(*) as count FROM core_avaliacao WHERE id_servico = ? AND id_utilizador = ?`,
    [servicoId, userId]
  );
  return (row?.count ?? 0) > 0;
};

export const insertRating = async (servicoId: number, userId: number, estrelas: number): Promise<void> => {
  const db = await getDb();
  if (!db) return;
  try {
    db.runSync(
      `INSERT INTO core_avaliacao (id_servico, id_utilizador, estrelas) VALUES (?, ?, ?)`,
      [servicoId, userId, estrelas]
    );
  } catch (error: any) {
    console.error('Erro ao inserir avaliação:', error.message);
  }
};

export const changePassword = async (userId: number, newPassword: string): Promise<boolean> => {
  const db = await getDb();
  if (!db) return false;
  try {
    db.runSync(`UPDATE core_utilizador SET password = ? WHERE id = ?`, [newPassword, userId]);
    return true;
  } catch (error: any) {
    console.error('Erro ao alterar password:', error.message);
    return false;
  }
};

// ─── Publicação ───────────────────────────────────────────────────────────────

export const insertProduto = async (
  userId: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string | null, estado: string | null, localEntrega: string | null
): Promise<void> => {
  const db = await getDb();
  if (!db) return;
  db.runSync(
    `INSERT INTO core_produto (titulo, id_utilizador, id_categoria, preco, local_entrega, descricao, estado, ativo, foto)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [titulo, userId, categoriaId, preco, localEntrega ?? '', descricao ?? '', estado ?? '', foto ?? '']
  );
};

export const insertServico = async (
  userId: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string | null, formato: string | null, horario: string | null
): Promise<void> => {
  const db = await getDb();
  if (!db) return;
  db.runSync(
    `INSERT INTO core_servico (titulo, id_utilizador, id_categoria, preco, formato, horario, descricao, ativo, foto)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [titulo, userId, categoriaId, preco, formato ?? '', horario ?? '', descricao ?? '', foto ?? '']
  );
};

export const updateProduto = async (
  id: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string | null, estado: string | null, localEntrega: string | null
): Promise<void> => {
  const db = await getDb();
  if (!db) return;
  db.runSync(
    `UPDATE core_produto SET titulo=?, preco=?, foto=?, id_categoria=?, descricao=?, estado=?, local_entrega=? WHERE id=?`,
    [titulo, preco, foto ?? '', categoriaId, descricao ?? '', estado ?? '', localEntrega ?? '', id]
  );
};

export const updateServico = async (
  id: number, titulo: string, preco: string, foto: string | null,
  categoriaId: number, descricao: string | null, formato: string | null, horario: string | null
): Promise<void> => {
  const db = await getDb();
  if (!db) return;
  db.runSync(
    `UPDATE core_servico SET titulo=?, preco=?, foto=?, id_categoria=?, descricao=?, formato=?, horario=? WHERE id=?`,
    [titulo, preco, foto ?? '', categoriaId, descricao ?? '', formato ?? '', horario ?? '', id]
  );
};

export const getItemByIdAndType = async (id: number, isService: boolean) => {
  const db = await getDb();
  if (!db) return null;
  const table = isService ? 'core_servico' : 'core_produto';
  return db.getFirstSync(`SELECT * FROM ${table} WHERE id = ?`, [id]) ?? null;
};