import {json,idValido,texto,falhar,corpo,chavePessoa} from './_middleware.js';
export function validarPessoa(d) {
 if(!d||typeof d!=='object') falhar('Informe os dados do leitor.');
 const nome=texto(d.nome,120,'o nome');
 if(!['aluno','professor'].includes(d.tipo)) falhar('Selecione Aluno ou Professor.');
 return [nome,d.tipo,d.tipo==='aluno'?texto(d.ano,30,'o ano'):null,d.tipo==='aluno'?texto(d.turma,20,'a turma'):null];
}
export async function onRequestGet({request,env}) {
 const url=new URL(request.url), id=url.searchParams.get('id');
 if(id) {
  const pessoa=await env.DB.prepare('SELECT * FROM pessoas WHERE id=?').bind(idValido(id)).first();
  if(!pessoa) falhar('Leitor não encontrado.',404);
  pessoa.historico=(await env.DB.prepare(`SELECT e.id,e.livro_id,e.quantidade,l.titulo,l.tipo_item,e.data_emprestimo,e.previsao_devolucao,e.data_devolucao,e.turmas_professor FROM emprestimos e JOIN livros l ON l.id=e.livro_id WHERE e.pessoa_id=? ORDER BY e.data_emprestimo DESC,e.id DESC`).bind(pessoa.id).all()).results;
  return json(pessoa);
 }
 return json((await env.DB.prepare('SELECT * FROM pessoas WHERE ativo=1 ORDER BY nome COLLATE NOCASE').all()).results);
}
export async function onRequestPut({request,env}) {
 const d=await corpo(request),id=idValido(d.id),valores=validarPessoa(d),chave=chavePessoa(valores);
 if(await env.DB.prepare('SELECT id FROM pessoas WHERE chave=? AND id<>?').bind(chave,id).first()) falhar('Já existe um leitor com esses dados. Use a ficha existente.',409);
 const r=await env.DB.prepare('UPDATE pessoas SET nome=?,tipo=?,ano=?,turma=?,chave=?,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND ativo=1').bind(...valores,chave,id).run();
 if(!r.meta.changes) falhar('Leitor não encontrado.',404);
 return json({ok:true});
}
export async function onRequestDelete({request,env}) {
 const id=idValido((await corpo(request)).id);
 if(await env.DB.prepare('SELECT id FROM emprestimos WHERE pessoa_id=? AND data_devolucao IS NULL').bind(id).first()) falhar('Este leitor tem empréstimos ativos. Registre a devolução ou exclua esses empréstimos antes de excluir o leitor.',409);
 const r=await env.DB.prepare('UPDATE pessoas SET ativo=0,atualizado_em=CURRENT_TIMESTAMP WHERE id=? AND ativo=1 AND NOT EXISTS(SELECT 1 FROM emprestimos WHERE pessoa_id=? AND data_devolucao IS NULL)').bind(id,id).run();
 if(!r.meta.changes) falhar('Leitor não encontrado ou com empréstimo ativo. Atualize a lista.',409);
 return json({ok:true});
}
export async function onRequestPatch({request,env}) {
 const d=await corpo(request),id=idValido(d.id),emprestimo=idValido(d.emprestimo_id);
 if(d.acao!=='excluirHistorico') falhar('Operação inválida.');
 const r=await env.DB.prepare('DELETE FROM emprestimos WHERE id=? AND pessoa_id=? AND data_devolucao IS NOT NULL AND EXISTS(SELECT 1 FROM pessoas WHERE id=? AND ativo=1)').bind(emprestimo,id,id).run();
 if(!r.meta.changes) falhar('Só é possível apagar um empréstimo concluído deste leitor.',409);
 return json({ok:true});
}
