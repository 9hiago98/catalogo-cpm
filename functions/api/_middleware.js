export const estrutura = [
`CREATE TABLE IF NOT EXISTS livros (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, chave_titulo TEXT, autor TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>=1), tipo_item TEXT CHECK(tipo_item IN ('livro','jogo')), grupo TEXT CHECK(grupo IN ('Ensino Médio','Ensino Fundamental')), observacao TEXT NOT NULL DEFAULT '', ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)), criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS capas (livro_id INTEGER PRIMARY KEY REFERENCES livros(id), tipo TEXT NOT NULL, dados BLOB NOT NULL, tamanho INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
`CREATE TABLE IF NOT EXISTS pessoas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, chave TEXT, ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)), tipo TEXT NOT NULL CHECK(tipo IN ('aluno','professor')), ano TEXT, turma TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK((tipo='professor' AND ano IS NULL AND turma IS NULL) OR (tipo='aluno' AND length(trim(ano))>0 AND length(trim(turma))>0 AND ano IS NOT NULL AND turma IS NOT NULL)))`,
`CREATE TABLE IF NOT EXISTS emprestimos (id INTEGER PRIMARY KEY AUTOINCREMENT, livro_id INTEGER NOT NULL REFERENCES livros(id), pessoa_id INTEGER NOT NULL REFERENCES pessoas(id), data_emprestimo TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>=1), previsao_devolucao TEXT, turmas_professor TEXT, data_devolucao TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(data_devolucao IS NULL OR data_devolucao >= data_emprestimo))`,
`CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros(titulo)`,
`CREATE INDEX IF NOT EXISTS idx_livros_ativo_grupo ON livros(ativo,grupo)`,
`CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome COLLATE NOCASE)`,
`CREATE INDEX IF NOT EXISTS idx_pessoas_tipo_ano_turma ON pessoas(tipo,ano,turma)`,
`CREATE INDEX IF NOT EXISTS idx_emprestimo_ativo ON emprestimos(livro_id) WHERE data_devolucao IS NULL`,
`CREATE INDEX IF NOT EXISTS idx_emprestimos_pessoa ON emprestimos(pessoa_id,data_emprestimo)`,
`CREATE TRIGGER IF NOT EXISTS emprestar_apenas_ativo BEFORE INSERT ON emprestimos WHEN NOT EXISTS (SELECT 1 FROM livros WHERE id=NEW.livro_id AND ativo=1) BEGIN SELECT RAISE(ABORT,'livro_inativo'); END`,
`CREATE TRIGGER IF NOT EXISTS impedir_inativacao_emprestado BEFORE UPDATE OF ativo ON livros WHEN NEW.ativo=0 AND EXISTS(SELECT 1 FROM emprestimos WHERE livro_id=NEW.id AND data_devolucao IS NULL) BEGIN SELECT RAISE(ABORT,'livro_emprestado'); END`
];
export function json(dados, status=200) { return new Response(JSON.stringify(dados), {status, headers:{'Content-Type':'application/json; charset=UTF-8','Cache-Control':'no-store'}}); }
export function falhar(mensagem,status=400) { const erro=new Error(mensagem); erro.status=status; throw erro; }
export function idValido(valor) { const id=Number(valor); if(!Number.isSafeInteger(id)||id<1) falhar('Identificação inválida.'); return id; }
export function texto(valor,max,campo) { if(typeof valor!=='string'||!valor.trim()||valor.trim().length>max) falhar(`Preencha ${campo} corretamente (até ${max} caracteres).`); return valor.trim(); }
export function hoje() { return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); }
export function dataValida(valor, permitirFutura=false) { if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor)||Number.isNaN(Date.parse(valor))||new Date(valor).toISOString().slice(0,10)!==valor||(!permitirFutura&&valor>hoje())) falhar(permitirFutura?'Informe uma data válida.':'Informe uma data válida, até hoje.'); return valor; }
export async function corpo(request) { const dados=await request.json().catch(()=>null); if(!dados||typeof dados!=='object'||Array.isArray(dados)) falhar('Dados inválidos.'); return dados; }
export function chavePessoa(valores) { return JSON.stringify(valores.map(v=>v==null?null:String(v).normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR'))); }
export function chaveTitulo(valor){return valor.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleLowerCase('pt-BR');}
export function quantidadeValida(valor){const n=valor==null?1:Number(valor);if(!Number.isSafeInteger(n)||n<1||n>9999)falhar('Informe uma quantidade inteira entre 1 e 9999.');return n;}
export async function migrar(db) {
  await db.prepare(estrutura[0]).run();
  let {results}=await db.prepare('PRAGMA table_info(livros)').all();
  for(const [nome,definicao] of [['quantidade','INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>=1)'],['chave_titulo','TEXT'],['grupo',"TEXT CHECK(grupo IN ('Ensino Médio','Ensino Fundamental'))"],['ativo','INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1))'],['tipo_item',"TEXT CHECK(tipo_item IN ('livro','jogo'))"]]) {
    if(!results.some(c=>c.name===nome)) {
      try { await db.prepare(`ALTER TABLE livros ADD COLUMN ${nome} ${definicao}`).run(); }
      catch(erro) { const atual=await db.prepare('PRAGMA table_info(livros)').all(); if(!atual.results.some(c=>c.name===nome)) throw erro; }
    }
  }
  // Nenhuma tabela ou coluna existente é apagada. O batch é transacional e repetível.
  await db.prepare('DROP INDEX IF EXISTS idx_emprestimo_ativo').run();
  await db.batch(estrutura.slice(1).map(sql=>db.prepare(sql)));
  // Ampliação aditiva: preserva pessoas e empréstimos existentes.
  for (const [tabela,coluna] of [['emprestimos','quantidade'],['pessoas','ativo'],['pessoas','chave'],['emprestimos','previsao_devolucao'],['emprestimos','turmas_professor']]) {
    const info=await db.prepare('PRAGMA table_info('+tabela+')').all();
    if(!info.results.some(c=>c.name===coluna)) {
      try { await db.prepare('ALTER TABLE '+tabela+' ADD COLUMN '+coluna+(coluna==='quantidade'?' INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>=1)':coluna==='ativo'?' INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1))':' TEXT')).run(); }
      catch(e) { const atual=await db.prepare('PRAGMA table_info('+tabela+')').all(); if(!atual.results.some(c=>c.name===coluna)) throw e; }
    }
  }
  const anteriores=await db.prepare('SELECT id,nome,tipo,ano,turma FROM pessoas WHERE chave IS NULL').all();
  await db.batch([
   db.prepare("CREATE TRIGGER IF NOT EXISTS estoque_emprestimo_insert BEFORE INSERT ON emprestimos WHEN NEW.data_devolucao IS NULL AND (NEW.quantidade<1 OR NEW.quantidade<>CAST(NEW.quantidade AS INTEGER) OR NEW.quantidade+COALESCE((SELECT SUM(quantidade) FROM emprestimos WHERE livro_id=NEW.livro_id AND data_devolucao IS NULL),0)>(SELECT CASE WHEN tipo_item='jogo' THEN quantidade ELSE 1 END FROM livros WHERE id=NEW.livro_id AND ativo=1)) BEGIN SELECT RAISE(ABORT,'estoque_insuficiente'); END"),
   db.prepare("CREATE TRIGGER IF NOT EXISTS estoque_emprestimo_update BEFORE UPDATE OF livro_id,quantidade,data_devolucao ON emprestimos WHEN NEW.data_devolucao IS NULL AND (NEW.quantidade<1 OR NEW.quantidade<>CAST(NEW.quantidade AS INTEGER) OR NOT EXISTS(SELECT 1 FROM livros WHERE id=NEW.livro_id AND ativo=1) OR NEW.quantidade+COALESCE((SELECT SUM(quantidade) FROM emprestimos WHERE livro_id=NEW.livro_id AND id<>NEW.id AND data_devolucao IS NULL),0)>(SELECT CASE WHEN tipo_item='jogo' THEN quantidade ELSE 1 END FROM livros WHERE id=NEW.livro_id)) BEGIN SELECT RAISE(ABORT,'estoque_insuficiente'); END"),
   db.prepare("CREATE TRIGGER IF NOT EXISTS estoque_item_update BEFORE UPDATE OF quantidade,tipo_item ON livros WHEN (CASE WHEN NEW.tipo_item='jogo' THEN NEW.quantidade ELSE 1 END)<COALESCE((SELECT SUM(quantidade) FROM emprestimos WHERE livro_id=NEW.id AND data_devolucao IS NULL),0) BEGIN SELECT RAISE(ABORT,'estoque_em_uso'); END")
  ]);
  for(let i=0;i<anteriores.results.length;i+=40) {
    await db.batch(anteriores.results.slice(i,i+40).map(p=>db.prepare('UPDATE pessoas SET chave=? WHERE id=? AND chave IS NULL').bind(chavePessoa([p.nome,p.tipo,p.tipo==='aluno'?p.ano:null,p.tipo==='aluno'?p.turma:null]),p.id)));
  }
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_pessoas_chave ON pessoas(chave)').run();
  const itens=await db.prepare('SELECT id,titulo FROM livros WHERE chave_titulo IS NULL').all();
  for(let i=0;i<itens.results.length;i+=40)await db.batch(itens.results.slice(i,i+40).map(l=>db.prepare('UPDATE livros SET chave_titulo=? WHERE id=?').bind(chaveTitulo(l.titulo),l.id)));
  await db.batch([
   db.prepare('CREATE INDEX IF NOT EXISTS idx_livros_chave_titulo ON livros(chave_titulo,ativo)'),
   db.prepare("CREATE TRIGGER IF NOT EXISTS impedir_titulo_repetido_insert BEFORE INSERT ON livros WHEN NEW.ativo=1 AND EXISTS(SELECT 1 FROM livros WHERE ativo=1 AND chave_titulo=NEW.chave_titulo) BEGIN SELECT RAISE(ABORT,'titulo_duplicado'); END"),
   db.prepare("CREATE TRIGGER IF NOT EXISTS impedir_titulo_repetido_update BEFORE UPDATE OF titulo,chave_titulo,ativo ON livros WHEN NEW.ativo=1 AND EXISTS(SELECT 1 FROM livros WHERE ativo=1 AND chave_titulo=NEW.chave_titulo AND id<>NEW.id) BEGIN SELECT RAISE(ABORT,'titulo_duplicado'); END")
  ]);
  return results.some(c=>c.name==='categoria');
}
const inicializacoes=new WeakMap();
export async function onRequest(context) {
  try {
    const db=context.env.DB;
    if(!db) falhar('O banco do catálogo não está disponível.',503);
    if(!inicializacoes.has(db)) inicializacoes.set(db,migrar(db).catch(e=>{inicializacoes.delete(db);throw e;}));
    context.data.schemaAntigo=await inicializacoes.get(db);
    return await context.next();
  } catch(erro) {
    console.error('API catálogo:',erro);
    if(erro.status) return json({erro:erro.message},erro.status);
    if(/estoque_insuficiente/.test(erro.message)) return json({erro:'Quantidade indisponível. Atualize a lista e confira o saldo do item.'},409);
    if(/estoque_em_uso/.test(erro.message)) return json({erro:'A quantidade total não pode ser menor que a quantidade emprestada.'},409);
    if(/titulo_duplicado/.test(erro.message)) return json({erro:'Já existe um item com esse nome no acervo.'},409);
    if(/UNIQUE constraint|livro_emprestado|livro_inativo/.test(erro.message)) return json({erro:'O item já está emprestado ou não está mais disponível. Atualize a lista.'},409);
    return json({erro:'Não foi possível concluir a operação. Tente novamente.'},500);
  }
}
