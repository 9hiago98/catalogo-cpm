import {json,corpo,idValido,dataValida,hoje,falhar,chavePessoa,texto,quantidadeValida} from './_middleware.js';
import {validarPessoa} from './pessoas.js';
export function validarTurmas(valor,tipo) {
 if(valor==null)return null;
 if(!Array.isArray(valor))falhar('Informe as turmas em uma lista.');
 const turmas=[];
 for(const t of valor){
  if(!t||typeof t!=='object'||typeof t.ano!=='string'||typeof t.turma!=='string')falhar('Informe ano e turma corretamente.');
  if(!t.ano.trim()&&!t.turma.trim())continue;
  const ano=texto(t.ano,30,'o ano da turma'),turma=texto(t.turma,20,'a turma');
  if(tipo!=='professor')falhar('Turmas atendidas são exclusivas de professores.');
  const chave=chavePessoa([parseInt(ano,10)||ano,turma]);
  if(turmas.some(v=>chavePessoa([parseInt(v.ano,10)||v.ano,v.turma])===chave))falhar(`A turma ${ano} ${turma} foi informada mais de uma vez.`);
  turmas.push({ano,turma});
 }
 return turmas.length?JSON.stringify(turmas):null;
}
export async function onRequestGet({env}) {
 return json((await env.DB.prepare(`SELECT e.id,e.livro_id,e.quantidade,l.titulo,l.tipo_item,e.pessoa_id,p.nome,p.tipo,p.ano,p.turma,e.data_emprestimo,e.previsao_devolucao,e.turmas_professor FROM emprestimos e JOIN livros l ON l.id=e.livro_id JOIN pessoas p ON p.id=e.pessoa_id WHERE e.data_devolucao IS NULL ORDER BY e.data_emprestimo DESC,e.id DESC`).all()).results);
}
async function validarSaldo(db,livro,valor,id=0){
 const l=await db.prepare('SELECT id,tipo_item,quantidade FROM livros WHERE id=? AND ativo=1').bind(livro).first();if(!l)falhar('Item não encontrado.',404);
 const quantidade=quantidadeValida(valor),total=l.tipo_item==='jogo'?l.quantidade:1;
 const soma=await db.prepare('SELECT COALESCE(SUM(quantidade),0) AS total FROM emprestimos WHERE livro_id=? AND id<>? AND data_devolucao IS NULL').bind(livro,id).first();
 if(quantidade>total-soma.total)falhar('Quantidade indisponível. Confira quantas unidades estão disponíveis.',409);return quantidade;
}
export async function onRequestPost({request,env}) {
 const d=await corpo(request), livro=idValido(d.livro_id), data=dataValida(d.data_emprestimo);
 const previsao=d.previsao_devolucao==null||d.previsao_devolucao===''?null:dataValida(d.previsao_devolucao,true);
 if(previsao&&previsao<data) falhar('A previsão de devolução não pode ser anterior ao empréstimo.');
 const quantidade=await validarSaldo(env.DB,livro,d.quantidade);
 if(d.pessoa_id) {
  const pessoa=idValido(d.pessoa_id);
  const leitor=await env.DB.prepare('SELECT id,tipo FROM pessoas WHERE id=? AND ativo=1').bind(pessoa).first();
  if(!leitor) falhar('Leitor não encontrado.',404);
  const turmas=validarTurmas(d.turmas_professor,leitor.tipo);
  await env.DB.prepare('INSERT INTO emprestimos(livro_id,pessoa_id,data_emprestimo,previsao_devolucao,turmas_professor,quantidade) VALUES(?,?,?,?,?,?)').bind(livro,pessoa,data,previsao,turmas,quantidade).run();
 } else {
  const pessoa=validarPessoa(d.pessoa);
  const chave=chavePessoa(pessoa);
  const turmas=validarTurmas(d.turmas_professor,pessoa[1]);
  // O batch serializa a busca/criação e o empréstimo, evitando duplicatas concorrentes.
  await env.DB.batch([
   env.DB.prepare('INSERT INTO pessoas(nome,tipo,ano,turma,chave) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM pessoas WHERE chave=?)').bind(...pessoa,chave,chave),
   env.DB.prepare('UPDATE pessoas SET ativo=1 WHERE chave=?').bind(chave),
   env.DB.prepare('INSERT INTO emprestimos(livro_id,pessoa_id,data_emprestimo,previsao_devolucao,turmas_professor,quantidade) VALUES(?,(SELECT id FROM pessoas WHERE chave=? ORDER BY id LIMIT 1),?,?,?,?)').bind(livro,chave,data,previsao,turmas,quantidade)
  ]);
 }
 return json({ok:true},201);
}
export async function onRequestPut({request,env}) {
 const id=idValido((await corpo(request)).id);
 const r=await env.DB.prepare('UPDATE emprestimos SET data_devolucao=? WHERE id=? AND data_devolucao IS NULL').bind(hoje(),id).run();
 if(!r.meta.changes) falhar('Este empréstimo já foi devolvido ou não foi encontrado.',409);
 return json({ok:true});
}
export async function onRequestPatch({request,env}) {
 const d=await corpo(request),id=idValido(d.id),livro=idValido(d.livro_id);
 const atual=await env.DB.prepare('SELECT id FROM emprestimos WHERE id=? AND data_devolucao IS NULL').bind(id).first();
 if(!atual) falhar('Este empréstimo já foi devolvido ou não foi encontrado.',409);
 const data=dataValida(d.data_emprestimo);
 const previsao=d.previsao_devolucao==null||d.previsao_devolucao===''?null:dataValida(d.previsao_devolucao,true);
 if(previsao&&previsao<data) falhar('A previsão de devolução não pode ser anterior ao empréstimo.');
 const quantidade=await validarSaldo(env.DB,livro,d.quantidade,id);
 const pessoa=validarPessoa(d.pessoa),chave=chavePessoa(pessoa),turmas=validarTurmas(d.turmas_professor,pessoa[1]);
 // Corrige somente este empréstimo; as outras fichas e seus históricos são preservados.
 const resultados=await env.DB.batch([
  env.DB.prepare('INSERT INTO pessoas(nome,tipo,ano,turma,chave) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM pessoas WHERE chave=?) AND EXISTS(SELECT 1 FROM emprestimos WHERE id=? AND data_devolucao IS NULL)').bind(...pessoa,chave,chave,id),
  env.DB.prepare('UPDATE pessoas SET ativo=1 WHERE chave=? AND EXISTS(SELECT 1 FROM emprestimos WHERE id=? AND data_devolucao IS NULL)').bind(chave,id),
  env.DB.prepare('UPDATE emprestimos SET livro_id=?,pessoa_id=(SELECT id FROM pessoas WHERE chave=? ORDER BY id LIMIT 1),data_emprestimo=?,previsao_devolucao=?,turmas_professor=?,quantidade=? WHERE id=? AND data_devolucao IS NULL').bind(livro,chave,data,previsao,turmas,quantidade,id)
 ]);
 if(!resultados[2].meta.changes) falhar('Este empréstimo já foi devolvido ou não foi encontrado.',409);
 return json({ok:true});
}
export async function onRequestDelete({request,env}) {
 const id=idValido((await corpo(request)).id);
 const r=await env.DB.prepare('DELETE FROM emprestimos WHERE id=? AND data_devolucao IS NULL').bind(id).run();
 if(!r.meta.changes) falhar('Este empréstimo já foi devolvido ou não foi encontrado.',409);
 return json({ok:true});
}
