import {json,corpo,idValido,texto,falhar,chaveTitulo,quantidadeValida} from './_middleware.js';
const consulta=`SELECT l.id,l.titulo,l.autor,l.quantidade,l.tipo_item,l.grupo,l.observacao,l.ativo,l.criado_em,l.atualizado_em,
COALESCE((SELECT SUM(quantidade) FROM emprestimos WHERE livro_id=l.id AND data_devolucao IS NULL),0) AS quantidade_emprestada,
CASE WHEN c.livro_id IS NULL THEN 0 ELSE 1 END AS tem_capa,c.atualizado_em AS capa_atualizada_em,
e.id AS emprestimo_id,e.data_emprestimo,e.previsao_devolucao,e.turmas_professor,p.id AS pessoa_id,p.nome,p.tipo,p.ano,p.turma
FROM livros l LEFT JOIN capas c ON c.livro_id=l.id
LEFT JOIN emprestimos e ON e.id=(SELECT id FROM emprestimos WHERE livro_id=l.id AND data_devolucao IS NULL ORDER BY id LIMIT 1) LEFT JOIN pessoas p ON p.id=e.pessoa_id`;
export async function onRequestGet({env,data}) {
 if(!data?.administrador)return json((await env.DB.prepare(`SELECT l.id,l.titulo,l.autor,l.quantidade,l.tipo_item,l.grupo,
 COALESCE((SELECT SUM(quantidade) FROM emprestimos WHERE livro_id=l.id AND data_devolucao IS NULL),0) AS quantidade_emprestada,
 CASE WHEN c.livro_id IS NULL THEN 0 ELSE 1 END AS tem_capa,c.atualizado_em AS capa_atualizada_em
 FROM livros l LEFT JOIN capas c ON c.livro_id=l.id WHERE l.ativo=1 ORDER BY l.id ASC`).all()).results);
 return json((await env.DB.prepare(consulta+' WHERE l.ativo=1 ORDER BY l.id ASC').all()).results);
}
async function salvar({request,env,data},editar) {
 const d=await corpo(request), titulo=texto(d.titulo,120,'o título');
 const idEdicao=editar?idValido(d.id):0,chave=chaveTitulo(titulo);
 if(await env.DB.prepare('SELECT id FROM livros WHERE ativo=1 AND chave_titulo=? AND id<>?').bind(chave,idEdicao).first()) falhar('Já existe um item com esse nome no acervo.',409);
 const tipo=d.tipo_item==null||d.tipo_item===''?null:d.tipo_item;
 if((!editar&&!tipo)||(tipo!==null&&!['livro','jogo'].includes(tipo))) falhar('Selecione Livro ou Jogo.');
 const autor=tipo==='jogo'?(d.autor==null||d.autor===''?'':texto(d.autor,100,'o autor ou fabricante')):texto(d.autor,100,'o autor');
 if(tipo!=='jogo'&&!['Ensino Médio','Ensino Fundamental'].includes(d.grupo)) falhar('Selecione o grupo do livro.');
 if(d.observacao!=null&&(typeof d.observacao!=='string'||d.observacao.length>250)) falhar('A observação deve ter até 250 caracteres.');
 const quantidade=tipo==='jogo'?quantidadeValida(d.quantidade):1;
 const valores=[titulo,autor,tipo==='jogo'?null:d.grupo,(d.observacao||'').trim(),tipo,chave,quantidade];
 let id;
 if(editar) {
  id=idValido(d.id);
  const r=await env.DB.prepare('UPDATE livros SET titulo=?,autor=?,grupo=?,observacao=?,tipo_item=?,chave_titulo=?,quantidade=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND ativo=1').bind(...valores,id).run();
  if(!r.meta.changes) falhar('Item não encontrado.',404);
 } else {
  // Colunas antigas ficam preservadas apenas por compatibilidade; não entram na lógica nova.
  const sql=data.schemaAntigo?"INSERT INTO livros(titulo,autor,grupo,observacao,tipo_item,chave_titulo,quantidade,categoria) VALUES(?,?,?,?,?,?,?,'')":"INSERT INTO livros(titulo,autor,grupo,observacao,tipo_item,chave_titulo,quantidade) VALUES(?,?,?,?,?,?,?)";
  id=(await env.DB.prepare(sql).bind(...valores).run()).meta.last_row_id;
 }
 return json(await env.DB.prepare(consulta+' WHERE l.id=?').bind(id).first(),editar?200:201);
}
export const onRequestPost=c=>salvar(c,false);
export const onRequestPut=c=>salvar(c,true);
export async function onRequestDelete({request,env}) {
 const id=idValido((await corpo(request)).id);
 const r=await env.DB.prepare('UPDATE livros SET ativo=0,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND ativo=1').bind(id).run();
 if(!r.meta.changes) falhar('Item não encontrado.',404);
 return json({ok:true});
}
