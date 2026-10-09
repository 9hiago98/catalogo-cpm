const $=id=>document.getElementById(id);
const MAX_ARQUIVO_ORIGINAL_BYTES=15*1024*1024, ALVO_CAPA_BYTES=600*1024, MAX_CAPA_DIMENSAO=1000;
let administrador=false;
let livros=[],pessoas=[],emprestimos=[],livroSelecionado=null,emprestimoEdicao=null,confirmacao=null,removerCapa=false,previewUrl=null,timerToast;
const etiquetasSelecionadas=new Set(); let etiquetasInicializadas=false;
const emprestimosSelecionados=new Set(),emprestimosConhecidos=new Set();
const leitoresSelecionados=new Set(),leitoresConhecidos=new Set();
let fichaLeitorEdicao=null;
const escaparHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const codigo=id=>String(id).padStart(4,'0');
const filtrarTipoItem=(item,id)=>!$(id).value||item.tipo_item===$(id).value;
const tipoItemTexto=item=>item.tipo_item==='livro'?'Livro':item.tipo_item==='jogo'?'Jogo':'Não definido';
const unidadesEmUso=l=>Number(l.quantidade_emprestada??(l.emprestimo_id?1:0));
const saldoItem=l=>Math.max(0,(l.tipo_item==='jogo'?Number(l.quantidade||1):1)-unidadesEmUso(l));
function statusPublico(l){const disponivel=saldoItem(l)>0;return `<span class="status ${disponivel?'':'emprestado'}">${disponivel?'Disponível':'Emprestado'}</span>${l.tipo_item==='jogo'?`<span class="saldo-item">${saldoItem(l)} de ${Number(l.quantidade||1)} disponíveis</span>`:''}`;}
const unidadesEmprestimo=e=>e.tipo_item==='jogo'||e.quantidade>1?`<small class="unidades-emprestimo">${Number(e.quantidade||1)} ${e.quantidade>1?'unidades':'unidade'}</small>`:'';
function atualizarQuantidadeEmprestimo(){const jogo=livroSelecionado.tipo_item==='jogo',editado=emprestimos.find(e=>e.id===emprestimoEdicao),saldo=saldoItem(livroSelecionado)+(editado?.livro_id===livroSelecionado.id?Number(editado.quantidade||1):0);$('campoQuantidadeEmprestimo').hidden=!jogo;$('quantidadeEmprestimo').disabled=!jogo;$('quantidadeEmprestimo').required=jogo;$('quantidadeEmprestimo').max=saldo;$('saldoEmprestimo').textContent=`${saldo} ${saldo===1?'unidade disponível':'unidades disponíveis'}`;if(Number($('quantidadeEmprestimo').value)>saldo)$('quantidadeEmprestimo').value=Math.max(1,saldo);}
function rodapeItem(l){
 if(!administrador)return statusPublico(l);
 if(l.tipo_item!=='jogo')return `${status(l)}${l.emprestimo_id?`<div class="detalhe-emprestimo">${nomeLeitor(l)}</div>${botao('devolver',l.emprestimo_id,'Registrar devolução')}`:botao('emprestar',l.id,'Emprestar','principal')}`;
 const saldo=saldoItem(l),ativos=emprestimos.filter(e=>e.livro_id===l.id);
 return `<span class="status ${saldo?'':'emprestado'}">${saldo?'Disponível':'Sem unidades disponíveis'}</span><span class="saldo-item">${saldo} de ${Number(l.quantidade||1)} disponíveis · ${unidadesEmUso(l)} emprestadas</span>${ativos.map(e=>`<div class="emprestimo-jogo">${nomeLeitor(e)}${unidadesEmprestimo(e)}${estadoEmprestimo(e)}${botao('devolver',e.id,'Registrar devolução')}</div>`).join('')}${saldo?botao('emprestar',l.id,'Emprestar','principal'):''}`;
}
const itensGestao=()=>livros.filter(l=>filtrarTipoItem(l,'filtroTipoGestao'));
const emprestimosGestao=()=>emprestimos.filter(e=>filtrarTipoItem(e,'filtroTipoGestao')&&combina($('buscaGestaoEmprestimos').value,e.nome,e.titulo,codigo(e.livro_id))).sort(ordenarEmprestimos);
const leitoresGestao=()=>pessoas.filter(p=>combina($('buscaGestaoLeitores').value,p.nome)&&(!$('tipoGestaoLeitores').value||p.tipo===$('tipoGestaoLeitores').value));
function atualizarTipoItem(){const jogo=$('tipoItem').value==='jogo';$('autor').required=!jogo;$('rotuloAutor').textContent=jogo?'Autor / fabricante (opcional)':'Autor';$('grupo').closest('label').hidden=jogo;$('grupo').required=!jogo;$('grupo').disabled=jogo;$('campoQuantidadeItem').hidden=!jogo;$('quantidadeItem').disabled=!jogo;$('quantidadeItem').required=jogo;}
const normalizar=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const combina=(termo,...valores)=>normalizar(valores.join(' ')).includes(normalizar(termo.trim()));
const dataBR=v=>v?v.slice(0,10).split('-').reverse().join('/'):'Em aberto';
const hoje=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const atrasado=(e,dataAtual=hoje())=>!e.data_devolucao&&Boolean(e.previsao_devolucao)&&e.previsao_devolucao<dataAtual;
function ordenarEmprestimos(a,b){if(Boolean(a.previsao_devolucao)!==Boolean(b.previsao_devolucao))return a.previsao_devolucao?-1:1;return (a.previsao_devolucao||'').localeCompare(b.previsao_devolucao||'')||a.data_emprestimo.localeCompare(b.data_emprestimo)||a.id-b.id;}
const nomeLeitor=e=>`<div class="resumo-leitor">${botao('ficha',e.pessoa_id,escaparHTML(e.tipo==='professor'?'Professor '+e.nome:e.nome),'link-leitor')}${e.tipo==='aluno'?`<span>${escaparHTML(e.ano)} · Turma ${escaparHTML(e.turma)}</span>`:''}</div>`;
function estadoEmprestimo(e){return `<span class="status ${atrasado(e)?'atrasado':'emprestado'}">${atrasado(e)?'Atrasado':'Emprestado'}</span>`;}
function estadoDevolucao(e){const atraso=Boolean(e.previsao_devolucao)&&e.data_devolucao>e.previsao_devolucao;return `<span class="status ${atraso?'devolvido-atraso':''}"><span class="texto-status">${atraso?'Devolvido com atraso':'Devolvido'}</span></span><small>${dataBR(e.data_devolucao)}</small>`;}
function etiquetasTurmas(e){try{const turmas=JSON.parse(e.turmas_professor||'[]');return turmas.length?`<div class="turmas-emprestimo" aria-label="Turmas atendidas">${turmas.map(t=>`<span>${escaparHTML(t.ano)} · Turma ${escaparHTML(t.turma)}</span>`).join('')}</div>`:'';}catch{return '';}}
function turmasEmprestimo(p){try{return JSON.parse(p.turmas_professor||'[]').map(t=>t.ano+' • Turma '+t.turma).join('; ');}catch{return '';}}
const dadosPessoa=p=>p.tipo==='aluno'?`Aluno • ${p.ano} • Turma ${p.turma}`:'Professor'+(turmasEmprestimo(p)?' • '+turmasEmprestimo(p):'');
const vazio=(titulo,texto='')=>`<div class="vazio"><h3>${escaparHTML(titulo)}</h3>${texto?`<p>${escaparHTML(texto)}</p>`:''}</div>`;
const status=l=>l.tipo_item==='jogo'?`<span class="status ${saldoItem(l)?'':'emprestado'}">${saldoItem(l)?'Disponível':'Sem unidades disponíveis'}</span><small>${saldoItem(l)} de ${Number(l.quantidade||1)} disponíveis</small>`:l.emprestimo_id?estadoEmprestimo(l):'<span class="status">Disponível</span>';
function mostrarToast(texto){clearTimeout(timerToast);$('toast').textContent=texto;$('toast').hidden=false;timerToast=setTimeout(()=>$('toast').hidden=true,6000);}
function erroFormulario(form,texto){const erro=form.querySelector('.erro');erro.textContent=texto;erro.hidden=false;mostrarToast(texto);}
async function requisicao(url,opcoes={}){
 let resposta;try{resposta=await fetch(url,{...opcoes,headers:opcoes.body instanceof FormData?{}:{'Content-Type':'application/json'}});}catch{throw new Error('Não foi possível conectar. Confira sua conexão e tente novamente.');}
 const dados=await resposta.json().catch(()=>null);if(resposta.status===401){window.location.replace('/login');throw new Error('Faça login para continuar.');}if(!resposta.ok||dados===null)throw new Error(dados?.erro||'Não foi possível concluir a operação. Tente novamente.');return dados;
}
const enviar=(url,method,dados)=>requisicao(url,{method,body:JSON.stringify(dados)});
function placeholderCapa(){return '<div class="capa-placeholder"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 10h28a6 6 0 0 1 6 6v38H21a5 5 0 0 1-5-5V10Z"/><path d="M21 54a5 5 0 0 1 0-10h29M25 21h16M25 28h12"/></svg><span>Sem capa</span></div>';}
function tabela(colunas,linhas){return `<div class="tabela"><table><thead><tr>${colunas.map(c=>`<th scope="col">${c}</th>`).join('')}</tr></thead><tbody>${linhas.map(l=>`<tr>${l.map((v,i)=>`<td data-coluna="${colunas[i]}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function botao(acao,id,texto,classe=''){return `<button type="button" class="${classe}" data-acao="${acao}" data-id="${id}">${texto}</button>`;}
function renderizarAcervo(){
 const ativos=livros.filter(l=>unidadesEmUso(l)>0).length;
 $('resumo').textContent=`${livros.length} ${livros.length===1?'item':'itens'} | ${livros.length-ativos} ${livros.length-ativos===1?'disponível':'disponíveis'} | ${ativos} ${ativos===1?'emprestado':'emprestados'}`;
 const lista=livros.filter(l=>combina($('busca').value,l.titulo,l.autor,codigo(l.id))&&filtrarTipoItem(l,'filtroTipoAcervo')&&(!$('filtroGrupo').value||l.grupo===$('filtroGrupo').value)&&(!$('filtroSituacao').value||($('filtroSituacao').value==='emprestado'?unidadesEmUso(l)>0:saldoItem(l)>0)));
 $('listaLivros').innerHTML=lista.length?lista.map(l=>`<article class="livro-card"><div class="capa-livro">${l.tem_capa?`<img src="/api/capa?id=${l.id}&v=${encodeURIComponent(l.capa_atualizada_em||'')}" alt="Capa de ${escaparHTML(l.titulo)}" loading="lazy">`:placeholderCapa()}</div><div class="conteudo-card"><span class="codigo">${codigo(l.id)}</span><h3>${escaparHTML(l.titulo)}</h3>${l.autor?`<p class="autor">${escaparHTML(l.autor)}</p>`:''}${l.tipo_item!=='jogo'?`<span class="grupo">${escaparHTML(l.tipo_item==='jogo'?'—':l.grupo||'Não definido')}</span>`:''}</div><div class="rodape-card">${rodapeItem(l)}</div></article>`).join(''):vazio(livros.length?'Nenhum item encontrado':'Seu acervo começa aqui',livros.length?'Altere a busca ou os filtros.':administrador?'Adicione o primeiro item em Gestão > Itens.':'Os itens cadastrados aparecerão aqui.');
 $('listaLivros').querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.parentElement.innerHTML=placeholderCapa(),{once:true}));
}
function renderizarEmprestimos(){
 $('totalEmprestimos').textContent=`${emprestimos.length} em circulação`;
 const lista=emprestimos.filter(e=>combina($('buscaEmprestimos').value,e.nome,e.titulo,codigo(e.livro_id))&&filtrarTipoItem(e,'filtroTipoEmprestimos')).sort(ordenarEmprestimos);
 $('listaEmprestimos').innerHTML=lista.length?tabela(['Código / Item','Leitor','Empréstimo','Previsão de devolução','Ação'],lista.map(e=>[`<div class="item-emprestado"><span class="codigo-item">${codigo(e.livro_id)}</span><strong>${escaparHTML(e.titulo)}</strong>${unidadesEmprestimo(e)}</div>`,nomeLeitor(e),`<span class="data-emprestimo">${dataBR(e.data_emprestimo)}</span>`,`${e.previsao_devolucao?`<span class="data-prevista">${dataBR(e.previsao_devolucao)}</span>`:'<span class="sem-previsao">Sem previsão</span>'}<div class="estado-emprestimo">${estadoEmprestimo(e)}</div>`,botao('devolver',e.id,'Registrar devolução')])):vazio('Nenhum empréstimo encontrado',emprestimos.length?'Altere sua busca.':'Os empréstimos ativos aparecerão aqui.');
}
function conteudoEtiqueta(l){return `<small>Colégio da Polícia Militar Eraldo Tinoco</small><strong>${codigo(l.id)}</strong><p>${escaparHTML(l.titulo)}</p>`;}
function colunasRelacao(){return ['Código','Título','Tipo','Autor / fabricante','Grupo','Situação'];}
function linhasRelacao(){return itensGestao().map(l=>[codigo(l.id),escaparHTML(l.titulo),tipoItemTexto(l),escaparHTML(l.autor),escaparHTML(l.tipo_item==='jogo'?'—':l.grupo||'Não definido'),l.tipo_item==='jogo'?`${saldoItem(l)} de ${Number(l.quantidade||1)} disponíveis`:l.emprestimo_id?'Emprestado':'Disponível']);}
function renderizarGestao(){
 const lista=itensGestao();
 $('tabelaGestao').innerHTML=lista.length?tabela(['Código','Item','Tipo','Grupo','Situação','Ações'],lista.map(l=>[codigo(l.id),`<strong>${escaparHTML(l.titulo)}</strong>${l.autor?`<small>${escaparHTML(l.autor)}</small>`:''}`,tipoItemTexto(l),escaparHTML(l.tipo_item==='jogo'?'—':l.grupo||'Não definido'),status(l),`<div class="acoes">${botao('editar',l.id,'Editar')}${l.emprestimo_id?'':botao('remover',l.id,'Remover','perigo')}</div>`])):vazio('Nenhum item encontrado');
 $('tabelaRelacao').innerHTML=lista.length?tabela(colunasRelacao(),linhasRelacao()):vazio('Nenhum item encontrado');
 $('listaEtiquetas').innerHTML=lista.length?lista.map(l=>`<label class="etiqueta"><input type="checkbox" data-etiqueta="${l.id}" ${etiquetasSelecionadas.has(l.id)?'checked':''} aria-label="Selecionar ${codigo(l.id)}"><span>${conteudoEtiqueta(l)}</span></label>`).join(''):vazio('Nenhum item para etiquetar');
 atualizarSelecaoEtiquetas();$('imprimirRelacao').disabled=!lista.length;
 for(const e of emprestimos){if(!emprestimosConhecidos.has(e.id)){emprestimosConhecidos.add(e.id);emprestimosSelecionados.add(e.id);}}
 for(const id of emprestimosConhecidos){if(!emprestimos.some(e=>e.id===id)){emprestimosConhecidos.delete(id);emprestimosSelecionados.delete(id);}}
 const ativos=emprestimosGestao();
 $('tabelaGestaoEmprestimos').innerHTML=ativos.length?tabela(['Selecionar','Código / Item','Leitor','Empréstimo','Previsão de devolução','Ações'],ativos.map(e=>[`<input type="checkbox" data-selecao-emprestimo="${e.id}" ${emprestimosSelecionados.has(e.id)?'checked':''} aria-label="Selecionar empréstimo de ${escaparHTML(e.nome)} — ${codigo(e.livro_id)}">`,`<div class="item-emprestado"><span class="codigo-item">${codigo(e.livro_id)}</span><strong>${escaparHTML(e.titulo)}</strong>${unidadesEmprestimo(e)}</div>`,nomeLeitor(e),`<span class="data-emprestimo">${dataBR(e.data_emprestimo)}</span>`,`${e.previsao_devolucao?`<span class="data-prevista">${dataBR(e.previsao_devolucao)}</span>`:'<span class="sem-previsao">Sem previsão</span>'}<div class="estado-emprestimo">${estadoEmprestimo(e)}</div>`,`<div class="acoes">${botao('editarEmprestimo',e.id,'Editar')}${botao('excluirEmprestimo',e.id,'Excluir','perigo')}</div>`])):vazio('Nenhum empréstimo ativo encontrado');
 atualizarSelecaoEmprestimos();
 renderizarGestaoLeitores();
}
function renderizarGestaoLeitores(){
 for(const p of pessoas){if(!leitoresConhecidos.has(p.id)){leitoresConhecidos.add(p.id);leitoresSelecionados.add(p.id);}}
 for(const id of leitoresConhecidos){if(!pessoas.some(p=>p.id===id)){leitoresConhecidos.delete(id);leitoresSelecionados.delete(id);}}
 const lista=leitoresGestao();
 $('tabelaGestaoLeitores').innerHTML=lista.length?tabela(['Selecionar','Nome','Vínculo','Ano','Turma','Ações'],lista.map(p=>[`<input type="checkbox" data-selecao-leitor="${p.id}" ${leitoresSelecionados.has(p.id)?'checked':''} aria-label="Selecionar ${escaparHTML(p.nome)}">`,botao('ficha',p.id,escaparHTML(p.nome),'link-leitor'),p.tipo==='aluno'?'Aluno':'Professor',escaparHTML(p.ano||'—'),escaparHTML(p.turma||'—'),`<div class="acoes">${botao('editarLeitor',p.id,'Editar')}${botao('excluirLeitor',p.id,'Excluir','perigo')}</div>`])):vazio('Nenhum leitor encontrado');
 atualizarSelecaoLeitores();
}
function atualizarSelecaoLeitores(){const lista=leitoresGestao(),n=lista.filter(p=>leitoresSelecionados.has(p.id)).length;$('todosLeitores').checked=n>0&&n===lista.length;$('todosLeitores').indeterminate=n>0&&n<lista.length;$('todosLeitores').disabled=!lista.length;$('imprimirLeitores').disabled=!n;}
function historicoLeitor(p,editar=false){
 if(!p.historico.length)return vazio('Nenhum empréstimo registrado');
 const colunas=['Item / Turmas','Empréstimo','Previsão de devolução','Devolução'];if(editar)colunas.push('Ação');
 return tabela(colunas,p.historico.map(e=>{
  const linha=[`<span class="codigo">${codigo(e.livro_id)}</span><strong>${escaparHTML(e.titulo)}</strong>${unidadesEmprestimo(e)}${etiquetasTurmas(e)}`,dataBR(e.data_emprestimo),e.previsao_devolucao?dataBR(e.previsao_devolucao):'Sem previsão',e.data_devolucao?estadoDevolucao(e):estadoEmprestimo(e)];
  if(editar)linha.push(e.data_devolucao?botao('excluirHistorico',e.id,'Apagar','perigo'):'<span class="historico-ativo">Gerencie em<br>Empréstimos</span>');return linha;
 }));
}
async function imprimirLeitores(){
 const lista=leitoresGestao().filter(p=>leitoresSelecionados.has(p.id));if(!lista.length)return;
 const botaoImprimir=$('imprimirLeitores');botaoImprimir.disabled=true;
 try{
  const fichas=[];for(let i=0;i<lista.length;i+=4)fichas.push(...await Promise.all(lista.slice(i,i+4).map(p=>requisicao('/api/pessoas?id='+p.id))));
  imprimir(`<h1>Leitores e histórico de empréstimos</h1><p>Colégio da Polícia Militar Eraldo Tinoco · ${dataBR(hoje())}</p><div class="impressao-fichas">${fichas.map(p=>`<section class="ficha-impressa"><h2>${escaparHTML(p.nome)}</h2><p>${escaparHTML(dadosPessoa(p))}</p><div class="historico-impresso">${historicoLeitor(p)}</div></section>`).join('')}</div>`);
 }catch(e){mostrarToast(e.message);}finally{atualizarSelecaoLeitores();}
}
function atualizarEdicaoLeitor(){const aluno=$('tipoEditarLeitor').value==='aluno';$('camposEditarLeitor').hidden=!aluno;$('anoEditarLeitor').disabled=!aluno;$('anoEditarLeitor').required=aluno;$('turmaEditarLeitor').disabled=!aluno||!$('anoEditarLeitor').value;$('turmaEditarLeitor').required=aluno;}
async function abrirEdicaoLeitor(id){const p=await requisicao('/api/pessoas?id='+id);fichaLeitorEdicao=p;$('formEditarLeitor').reset();$('idEditarLeitor').value=id;$('nomeEditarLeitor').value=p.nome;$('tipoEditarLeitor').value=p.tipo;$('anoEditarLeitor').innerHTML='<option value="">Selecione</option>'+[6,7,8,9,1,2,3].map(n=>`<option value="${n}º ano">${n}º ano · ${n<6?'Ensino Médio':'Ensino Fundamental'}</option>`).join('');selecionarValor($('anoEditarLeitor'),p.ano);atualizarTurmas($('anoEditarLeitor'),$('turmaEditarLeitor'));selecionarValor($('turmaEditarLeitor'),p.turma);atualizarEdicaoLeitor();$('historicoEditarLeitor').innerHTML=historicoLeitor(p,true);abrirModal('modalEditarLeitor');$('nomeEditarLeitor').focus();}
function atualizarSelecaoEmprestimos(){const lista=emprestimosGestao(),n=lista.filter(e=>emprestimosSelecionados.has(e.id)).length;$('todosEmprestimos').checked=n>0&&n===lista.length;$('todosEmprestimos').indeterminate=n>0&&n<lista.length;$('todosEmprestimos').disabled=!lista.length;$('imprimirEmprestimos').disabled=!n;}
function imprimirEmprestimos(){
 const lista=emprestimosGestao().filter(e=>emprestimosSelecionados.has(e.id));if(!lista.length)return;
 imprimir(`<h1>Empréstimos ativos</h1><p>Colégio da Polícia Militar Eraldo Tinoco · ${dataBR(hoje())}</p><div class="impressao-emprestimos">${tabela(['Código / Item','Leitor','Ano / Turma','Empréstimo','Previsão de devolução','Situação'],lista.map(e=>[`${codigo(e.livro_id)} · ${escaparHTML(e.titulo)}${unidadesEmprestimo(e)}`,`${escaparHTML(e.nome)}<small>${e.tipo==='professor'?'Professor':'Aluno'}</small>`,e.tipo==='aluno'?`${escaparHTML(e.ano)} · Turma ${escaparHTML(e.turma)}`:turmasEmprestimo(e)?turmasEmprestimo(e).split('; ').map(t=>`<span class="turma-impressa">${escaparHTML(t)}</span>`).join(''):'—',dataBR(e.data_emprestimo),e.previsao_devolucao?dataBR(e.previsao_devolucao):'Sem previsão',atrasado(e)?'Atrasado':'Emprestado']))}</div>`);
}
function atualizarSelecaoEtiquetas(){const lista=itensGestao(),n=lista.filter(l=>etiquetasSelecionadas.has(l.id)).length;$('todasEtiquetas').checked=n>0&&n===lista.length;$('todasEtiquetas').indeterminate=n>0&&n<lista.length;$('imprimirEtiquetas').disabled=!n;}
function aplicarAcesso(){
 document.body.classList.toggle('modo-publico',!administrador);$('btnEntrar').hidden=administrador;$('btnSair').hidden=!administrador;
 for(const area of ['emprestimos','gestao'])document.querySelector('[data-area="'+area+'"]').hidden=!administrador;
 if(!administrador){$('acervo').hidden=false;$('emprestimos').hidden=true;$('gestao').hidden=true;document.querySelectorAll('[data-area]').forEach(b=>b.removeAttribute('aria-current'));document.querySelector('[data-area="acervo"]').setAttribute('aria-current','page');}
}
function renderizar(){aplicarAcesso();renderizarAcervo();if(administrador){renderizarEmprestimos();renderizarGestao();}}
async function carregar(){
 try{
  administrador=(await requisicao('/auth/session')).autenticado===true;
  const dados=await Promise.all([requisicao('/api/livros'),...(administrador?[requisicao('/api/pessoas'),requisicao('/api/emprestimos')]:[])]);
  livros=dados[0];pessoas=administrador?dados[1]:[];emprestimos=administrador?dados[2]:[];
  if(!etiquetasInicializadas&&administrador){livros.forEach(l=>etiquetasSelecionadas.add(l.id));etiquetasInicializadas=true;}
  $('falhaCarga').hidden=true;renderizar();return true;
 }catch(e){$('falhaCarga').hidden=false;mostrarToast(e.message);return false;}
}

function abrirModal(id){const modal=$(id);const erro=modal.querySelector('.erro');if(erro)erro.hidden=true;modal.showModal();}
function fecharModal(modal){if(modal.dataset.ocupado)return;modal.close();if(modal.id==='modalLivro'&&previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}}
async function executarFormulario(form,acao){
 if(form.dataset.ocupado)return;
 const modal=form.closest('dialog'), erro=form.querySelector('.erro');erro.hidden=true;form.dataset.ocupado='1';modal.dataset.ocupado='1';
 const controles=[...form.querySelectorAll('button,input,select,textarea')].map(el=>[el,el.disabled]);controles.forEach(([el])=>el.disabled=true);
 try{await acao();}catch(e){erro.textContent=e.message;erro.hidden=false;mostrarToast(e.message);}finally{delete form.dataset.ocupado;delete modal.dataset.ocupado;controles.forEach(([el,disabled])=>el.disabled=disabled);}
}
function abrirLivro(id){
 const l=livros.find(l=>l.id===id);$('formLivro').reset();$('livroId').value=l?.id||'';$('tituloModalLivro').textContent=l?'Editar item':'Adicionar item';$('codigoLivro').textContent=l?`Código ${codigo(l.id)} · automático`:'O código será gerado automaticamente.';
 $('quantidadeItem').value=l?.quantidade||1;$('tipoItem').value=l?.tipo_item||'';$('tipoItem').required=!l;atualizarTipoItem();
 for(const campo of ['titulo','autor','grupo','observacao'])$(campo).value=l?.[campo]||'';
 removerCapa=false;$('previewCapa').innerHTML=l?.tem_capa?`<img src="/api/capa?id=${l.id}&v=${encodeURIComponent(l.capa_atualizada_em||'')}" alt="Capa atual">`:'';$('btnRemoverCapa').hidden=!l?.tem_capa;abrirModal('modalLivro');$('titulo').focus();
}
function abrirEmprestimo(id){
 emprestimoEdicao=null;livroSelecionado=livros.find(l=>l.id===id);if(!livroSelecionado||saldoItem(livroSelecionado)<1)return;
 $('tituloModalEmprestimo').textContent='Emprestar item';$('salvarEmprestimo').textContent='Confirmar empréstimo';$('campoItemEmprestimo').hidden=true;$('itemEmprestimo').disabled=true;
 $('formEmprestimo').reset();atualizarQuantidadeEmprestimo();preencherAnos($('anoPessoa'));atualizarTurmas($('anoPessoa'),$('turmaPessoa'));$('turmasProfessor').innerHTML='';adicionarLinhaTurma();atualizarTipoPessoa();$('dataEmprestimo').value=hoje();$('dataEmprestimo').max=hoje();$('livroEmprestimo').textContent=`${codigo(id)} · ${livroSelecionado.titulo}`;$('previsaoDevolucao').min=$('dataEmprestimo').value;abrirModal('modalEmprestimo');$('nomePessoa').focus();
}
function anosDisponiveis(item){if(item.tipo_item==='jogo')return [6,7,8,9,1,2,3];if(item.grupo==='Ensino Fundamental')return [6,7,8,9];if(item.grupo==='Ensino Médio')return [1,2,3];return [6,7,8,9,1,2,3];}
function selecionarValor(select,valor){if(!valor)return;if(![...select.options].some(o=>o.value===valor)){const opcao=document.createElement('option');opcao.value=valor;opcao.textContent=valor;select.appendChild(opcao);}select.value=valor;}
function abrirEdicaoEmprestimo(id){
 const e=emprestimos.find(e=>e.id===id);if(!e)return;
 livroSelecionado=livros.find(l=>l.id===e.livro_id);if(!livroSelecionado)return;
 emprestimoEdicao=id;$('formEmprestimo').reset();$('quantidadeEmprestimo').value=e.quantidade||1;atualizarQuantidadeEmprestimo();$('tituloModalEmprestimo').textContent='Editar empréstimo';$('salvarEmprestimo').textContent='Salvar alterações';
 $('campoItemEmprestimo').hidden=false;$('itemEmprestimo').disabled=false;$('itemEmprestimo').required=true;
 $('itemEmprestimo').innerHTML=livros.filter(l=>saldoItem(l)>0||l.id===e.livro_id).map(l=>`<option value="${l.id}">${codigo(l.id)} · ${escaparHTML(l.titulo)}</option>`).join('');$('itemEmprestimo').value=e.livro_id;
 $('livroEmprestimo').textContent=`${codigo(e.livro_id)} · ${e.titulo}`;
 $('nomePessoa').value=e.nome;$('tipoPessoa').value=e.tipo;preencherAnos($('anoPessoa'));selecionarValor($('anoPessoa'),e.ano);atualizarTurmas($('anoPessoa'),$('turmaPessoa'));selecionarValor($('turmaPessoa'),e.turma);
 $('turmasProfessor').innerHTML='';let turmas=[];try{turmas=JSON.parse(e.turmas_professor||'[]');}catch{}if(turmas.length)turmas.forEach(t=>adicionarLinhaTurma(t));else adicionarLinhaTurma();atualizarTipoPessoa();
 $('dataEmprestimo').value=e.data_emprestimo;$('dataEmprestimo').max=hoje();$('previsaoDevolucao').min=e.data_emprestimo;$('previsaoDevolucao').value=e.previsao_devolucao||'';abrirModal('modalEmprestimo');$('nomePessoa').focus();
}
function turmasDisponiveis(ano){const n=parseInt(ano,10);return !ano?[]:n===3?['A','B','C','D','E','F','G']:n===2?['A','B','C','D','E']:['A','B','C','D'];}
function preencherAnos(select){select.innerHTML='<option value="">Selecione</option>'+anosDisponiveis(livroSelecionado).map(n=>`<option value="${n}º ano">${n}º ano · ${n<6?'Ensino Médio':'Ensino Fundamental'}</option>`).join('');}
function atualizarTurmas(ano,turma){const anterior=turma.value,opcoes=turmasDisponiveis(ano.value);turma.innerHTML=`<option value="">${ano.value?'Selecione':'Selecione o ano'}</option>`+opcoes.map(t=>`<option>${t}</option>`).join('');turma.value=opcoes.includes(anterior)?anterior:'';turma.disabled=!ano.value;}
function atualizarTipoPessoa(){const aluno=$('tipoPessoa').value==='aluno';$('camposAluno').hidden=!aluno;$('camposProfessor').hidden=aluno;$('camposProfessor').disabled=aluno;$('anoPessoa').required=aluno;$('anoPessoa').disabled=!aluno;$('turmaPessoa').required=aluno;$('turmaPessoa').disabled=!aluno||!$('anoPessoa').value;}
function resumoDevolucao(e){
 return `<p class="instrucao-devolucao">Confira os dados antes de registrar a devolução.</p><div class="item-devolucao"><span class="codigo-devolucao">Item ${codigo(e.livro_id)}</span><h3>${escaparHTML(e.titulo)}</h3></div><dl class="dados-devolucao"><div class="leitor-devolucao"><dt>Leitor</dt><dd>${escaparHTML(e.nome)}</dd><small>${escaparHTML(dadosPessoa(e))}</small></div>${e.quantidade>1?`<div><dt>Quantidade</dt><dd>${e.quantidade} unidades</dd></div>`:''}<div><dt>Data do empréstimo</dt><dd>${dataBR(e.data_emprestimo)}</dd></div><div><dt>Previsão de devolução</dt><dd>${e.previsao_devolucao?dataBR(e.previsao_devolucao):'Sem previsão'}</dd></div></dl><div class="registro-devolucao"><div><span>Data da devolução</span><strong>${dataBR(hoje())}</strong></div><span class="resultado-devolucao ${atrasado(e)?'com-atraso':''}">${atrasado(e)?'Devolvido com atraso':'Devolvido'}</span></div><p class="nota-devolucao">O item ficará disponível no acervo.</p>`;
}
function resumoExclusao(acao,registro){
 let titulo,identificacao,campos=[],efeito,nota='';
 if(acao==='excluirLeitor'){
  titulo=registro.nome;identificacao='Leitor';campos=[['Vínculo',registro.tipo==='aluno'?'Aluno':'Professor']];
  if(registro.tipo==='aluno')campos.push(['Ano',registro.ano],['Turma',registro.turma]);
  efeito='O leitor será retirado da relação. O histórico de devoluções será preservado.';
  nota='Se houver empréstimos ativos, devolva ou exclua esses empréstimos primeiro.';
 }else{
  titulo=registro.titulo;identificacao='Item '+codigo(acao==='remover'?registro.id:registro.livro_id);
  if(acao==='remover'){
   campos=[['Tipo',tipoItemTexto(registro)],['Autor / fabricante',registro.autor||'Não informado']];
   efeito='O item será retirado do acervo. O histórico de empréstimos será preservado.';
  }else{
   campos=[['Leitor',acao==='excluirHistorico'?fichaLeitorEdicao.nome:registro.nome],['Data do empréstimo',dataBR(registro.data_emprestimo)]];if(registro.quantidade>1)campos.push(['Quantidade',registro.quantidade+' unidades']);
   if(acao==='excluirHistorico'){
    campos.push(['Data da devolução',dataBR(registro.data_devolucao)]);
    efeito='Este empréstimo concluído será apagado permanentemente do histórico do leitor.';
   }else{
    campos.push(['Previsão de devolução',registro.previsao_devolucao?dataBR(registro.previsao_devolucao):'Sem previsão']);
    efeito='O empréstimo será apagado da ficha do leitor e o item ficará disponível no acervo.';
   }
  }
 }
 return `<p class="instrucao-devolucao">Confira o registro antes de confirmar.</p><div class="item-devolucao"><span class="codigo-devolucao">${escaparHTML(identificacao)}</span><h3>${escaparHTML(titulo)}</h3></div><dl class="dados-devolucao">${campos.map(([rotulo,valor])=>`<div><dt>${escaparHTML(rotulo)}</dt><dd>${escaparHTML(valor)}</dd></div>`).join('')}</dl><div class="efeito-exclusao"><span>Após confirmar</span><p>${escaparHTML(efeito)}</p></div>${nota?`<p class="nota-devolucao">${escaparHTML(nota)}</p>`:''}`;
}
function abrirConfirmacao(acao,id){
 const devolucao=acao==='devolver';
 let registro;
 if(acao==='excluirHistorico')registro=fichaLeitorEdicao?.historico.find(e=>e.id===id&&e.data_devolucao);
 else if(acao==='excluirLeitor')registro=pessoas.find(p=>p.id===id);
 else if(acao==='remover')registro=livros.find(l=>l.id===id);
 else registro=emprestimos.find(e=>e.id===id);
 if(!registro)return;
 confirmacao={acao,id};if(acao==='excluirHistorico')confirmacao.leitorId=fichaLeitorEdicao.id;
 $('modalConfirmacao').classList.toggle('confirmacao-devolucao',devolucao);
 $('modalConfirmacao').classList.toggle('confirmacao-exclusao',!devolucao);
 $('textoConfirmacao').hidden=true;$('detalhesDevolucao').hidden=false;
 const titulos={devolver:'Registrar devolução',remover:'Remover item',excluirLeitor:'Excluir leitor',excluirEmprestimo:'Excluir empréstimo',excluirHistorico:'Apagar registro do histórico'};
 const botoes={devolver:'Confirmar devolução',remover:'Remover item',excluirLeitor:'Excluir leitor',excluirEmprestimo:'Excluir empréstimo',excluirHistorico:'Apagar registro'};
 $('tituloConfirmacao').textContent=titulos[acao];$('confirmarAcao').textContent=botoes[acao];$('confirmarAcao').className=devolucao?'principal':'perigo';
 $('detalhesDevolucao').innerHTML=devolucao?resumoDevolucao(registro):resumoExclusao(acao,registro);
 abrirModal('modalConfirmacao');
}

async function abrirFicha(id){
 const p=await requisicao('/api/pessoas?id='+id);
 $('nomeFicha').textContent=p.nome;
 $('dadosFicha').innerHTML=`<dl class="dados-leitor"><div><dt>Vínculo</dt><dd>${p.tipo==='aluno'?'Aluno':'Professor'}</dd></div>${p.tipo==='aluno'?`<div><dt>Ano</dt><dd>${escaparHTML(p.ano)}</dd></div><div><dt>Turma</dt><dd>${escaparHTML(p.turma)}</dd></div>`:''}</dl>`;
 $('historicoPessoa').innerHTML=historicoLeitor(p);
 abrirModal('modalPessoa');
}
document.addEventListener('click',async event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-fechar')){fecharModal(b.closest('dialog'));return;}
 if(b.dataset.area){if(!administrador&&b.dataset.area!=='acervo')return;for(const id of ['acervo','emprestimos','gestao'])$(id).hidden=id!==b.dataset.area;document.querySelectorAll('[data-area]').forEach(el=>el.removeAttribute('aria-current'));b.setAttribute('aria-current','page');}
 if(b.dataset.gestao){if(!administrador)return;$('filtrosItensGestao').hidden=b.dataset.gestao==='leitores';for(const [chave,id] of Object.entries({livros:'gestaoLivros',etiquetas:'gestaoEtiquetas',relacao:'gestaoRelacao',emprestimos:'gestaoEmprestimos',leitores:'gestaoLeitores'}))$(id).hidden=chave!==b.dataset.gestao;document.querySelectorAll('[data-gestao]').forEach(el=>el.removeAttribute('aria-current'));b.setAttribute('aria-current','page');}
 if(!b.dataset.acao||!administrador)return;
 const id=Number(b.dataset.id);try{switch(b.dataset.acao){case 'editar':abrirLivro(id);break;case 'emprestar':abrirEmprestimo(id);break;case 'editarLeitor':b.disabled=true;await abrirEdicaoLeitor(id);break;case 'editarEmprestimo':abrirEdicaoEmprestimo(id);break;case 'devolver':case 'remover':case 'excluirEmprestimo':case 'excluirLeitor':case 'excluirHistorico':abrirConfirmacao(b.dataset.acao,id);break;case 'ficha':b.disabled=true;await abrirFicha(id);break;}}catch(e){mostrarToast(e.message);}finally{b.disabled=false;}
});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{e.preventDefault();fecharModal(d);}));
$('btnAdicionar').onclick=()=>abrirLivro();$('tentarNovamente').onclick=carregar;
for(const id of ['busca','filtroSituacao','filtroGrupo','filtroTipoAcervo'])$(id).addEventListener('input',renderizarAcervo);
for(const id of ['buscaEmprestimos','filtroTipoEmprestimos'])$(id).addEventListener('input',renderizarEmprestimos);
$('filtroTipoGestao').addEventListener('input',renderizarGestao);
$('buscaGestaoEmprestimos').addEventListener('input',renderizarGestao);
$('tipoItem').onchange=atualizarTipoItem;
function adicionarLinhaTurma(dados){
 const linha=document.createElement('div');linha.className='linha-turma';
 linha.innerHTML='<div class="dupla"><label>Ano<select data-ano><option value="">Selecione</option></select></label><label>Turma<select data-turma><option value="">Selecione o ano</option></select></label></div><button type="button" class="remover-turma">Remover linha</button>';
 const ano=linha.querySelector('[data-ano]'),turma=linha.querySelector('[data-turma]');preencherAnos(ano);atualizarTurmas(ano,turma);ano.onchange=()=>atualizarTurmas(ano,turma);if(dados){selecionarValor(ano,dados.ano);atualizarTurmas(ano,turma);selecionarValor(turma,dados.turma);}
 linha.querySelector('button').onclick=()=>linha.remove();$('turmasProfessor').appendChild(linha);
}
$('adicionarTurma').onclick=()=>{adicionarLinhaTurma();$('turmasProfessor').lastElementChild.querySelector('select').focus();};
$('anoPessoa').onchange=()=>{atualizarTurmas($('anoPessoa'),$('turmaPessoa'));atualizarTipoPessoa();};
$('tipoPessoa').onchange=atualizarTipoPessoa;
$('itemEmprestimo').onchange=()=>{
 livroSelecionado=livros.find(l=>l.id===Number($('itemEmprestimo').value));if(!livroSelecionado)return;atualizarQuantidadeEmprestimo();
 $('livroEmprestimo').textContent=`${codigo(livroSelecionado.id)} · ${livroSelecionado.titulo}`;
 const ano=$('anoPessoa').value;preencherAnos($('anoPessoa'));if([...$('anoPessoa').options].some(o=>o.value===ano))$('anoPessoa').value=ano;atualizarTurmas($('anoPessoa'),$('turmaPessoa'));atualizarTipoPessoa();
 for(const linha of $('turmasProfessor').querySelectorAll('.linha-turma')){const a=linha.querySelector('[data-ano]'),t=linha.querySelector('[data-turma]'),valor=a.value;preencherAnos(a);if([...a.options].some(o=>o.value===valor))a.value=valor;atualizarTurmas(a,t);}
};
$('dataEmprestimo').onchange=()=>{$('previsaoDevolucao').min=$('dataEmprestimo').value;};
$('formEmprestimo').addEventListener('submit',event=>{
 event.preventDefault();
 const dados={quantidade:livroSelecionado.tipo_item==='jogo'?Number($('quantidadeEmprestimo').value):1,livro_id:livroSelecionado.id,data_emprestimo:$('dataEmprestimo').value,previsao_devolucao:$('previsaoDevolucao').value||null,pessoa:{nome:$('nomePessoa').value,tipo:$('tipoPessoa').value,ano:$('anoPessoa').value,turma:$('turmaPessoa').value}};
 dados.turmas_professor=$('tipoPessoa').value==='professor'?[...$('turmasProfessor').querySelectorAll('.linha-turma')].map(l=>({ano:l.querySelector('[data-ano]').value,turma:l.querySelector('[data-turma]').value})):[];
 const turmas=new Set();for(const t of dados.turmas_professor){if(!t.ano&&!t.turma)continue;const chave=JSON.stringify([parseInt(t.ano,10)||t.ano,normalizar(t.turma.trim())]);if(turmas.has(chave)){erroFormulario(event.currentTarget,`A turma ${t.ano} ${t.turma} foi informada mais de uma vez. Remova a linha repetida.`);return;}turmas.add(chave);}
 executarFormulario(event.currentTarget,async()=>{const editando=emprestimoEdicao!==null;if(editando)dados.id=emprestimoEdicao;await enviar('/api/emprestimos',editando?'PATCH':'POST',dados);$('modalEmprestimo').close();mostrarToast(editando?'Empréstimo atualizado.':'Empréstimo realizado.');await carregar();});
});
$('formConfirmacao').addEventListener('submit',event=>{event.preventDefault();executarFormulario(event.currentTarget,async()=>{
 if(confirmacao.acao==='excluirHistorico'){
  const leitorId=confirmacao.leitorId;await enviar('/api/pessoas','PATCH',{id:leitorId,emprestimo_id:confirmacao.id,acao:'excluirHistorico'});
  $('modalConfirmacao').close();mostrarToast('Registro apagado do histórico.');
  const p=await requisicao('/api/pessoas?id='+leitorId);fichaLeitorEdicao=p;$('historicoEditarLeitor').innerHTML=historicoLeitor(p,true);await carregar();return;
 }
 const emprestimo=confirmacao.acao==='devolver'||confirmacao.acao==='excluirEmprestimo';await enviar(confirmacao.acao==='excluirLeitor'?'/api/pessoas':emprestimo?'/api/emprestimos':'/api/livros',confirmacao.acao==='devolver'?'PUT':'DELETE',{id:confirmacao.id});$('modalConfirmacao').close();mostrarToast(confirmacao.acao==='devolver'?'Devolução registrada.':confirmacao.acao==='excluirEmprestimo'?'Empréstimo excluído. Item disponível.':confirmacao.acao==='excluirLeitor'?'Leitor excluído.':'Item removido.');await carregar();
});});
$('capa').onchange=()=>{const arquivo=$('capa').files[0];if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}if(!arquivo)return;if(!['image/jpeg','image/png','image/webp'].includes(arquivo.type)||arquivo.size>MAX_ARQUIVO_ORIGINAL_BYTES){$('capa').value='';mostrarToast('Use JPG, PNG ou WebP com até 15 MB.');return;}removerCapa=false;previewUrl=URL.createObjectURL(arquivo);$('previewCapa').innerHTML=`<img src="${previewUrl}" alt="Prévia da capa">`;$('btnRemoverCapa').hidden=false;};
$('btnRemoverCapa').onclick=()=>{$('capa').value='';removerCapa=true;$('previewCapa').innerHTML='';$('btnRemoverCapa').hidden=true;};
$('formLivro').addEventListener('submit',event=>{event.preventDefault();const id=Number($('livroId').value),arquivo=$('capa').files[0],dados={quantidade:$('tipoItem').value==='jogo'?Number($('quantidadeItem').value):1,tipo_item:$('tipoItem').value||null,titulo:$('titulo').value,autor:$('autor').value,grupo:$('grupo').value,observacao:$('observacao').value};executarFormulario(event.currentTarget,async()=>{
 if(livros.some(l=>l.id!==id&&normalizar(l.titulo.trim().replace(/\s+/g,' '))===normalizar(dados.titulo.trim().replace(/\s+/g,' '))))throw new Error('Já existe um item com esse nome no acervo.');
 const capa=arquivo?await otimizarCapa(arquivo):null;const salvo=await enviar('/api/livros',id?'PUT':'POST',id?{id,...dados}:dados);$('livroId').value=salvo.id;
 let aviso='';try{if(capa){const form=new FormData();form.append('livroId',salvo.id);form.append('capa',capa);await requisicao('/api/capa',{method:'POST',body:form});}else if(removerCapa&&id)await enviar('/api/capa','DELETE',{id});}catch(e){aviso=' O item foi salvo, mas a capa não foi atualizada. Abra Editar para tentar novamente.';}
 etiquetasSelecionadas.add(salvo.id);$('modalLivro').close();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}mostrarToast('Item salvo.'+aviso);await carregar();
 });});
$('listaEtiquetas').addEventListener('change',e=>{if(!e.target.dataset.etiqueta)return;const id=Number(e.target.dataset.etiqueta);if(e.target.checked)etiquetasSelecionadas.add(id);else etiquetasSelecionadas.delete(id);atualizarSelecaoEtiquetas();});
$('todasEtiquetas').onchange=()=>{itensGestao().forEach(l=>{$('todasEtiquetas').checked?etiquetasSelecionadas.add(l.id):etiquetasSelecionadas.delete(l.id);});renderizarGestao();};
function imprimir(html){$('impressao').innerHTML=html;window.print();}
$('tabelaGestaoEmprestimos').addEventListener('change',e=>{if(!e.target.dataset.selecaoEmprestimo)return;const id=Number(e.target.dataset.selecaoEmprestimo);if(e.target.checked)emprestimosSelecionados.add(id);else emprestimosSelecionados.delete(id);atualizarSelecaoEmprestimos();});
$('todosEmprestimos').onchange=()=>{emprestimosGestao().forEach(e=>{$('todosEmprestimos').checked?emprestimosSelecionados.add(e.id):emprestimosSelecionados.delete(e.id);});renderizarGestao();};
$('imprimirEmprestimos').onclick=imprimirEmprestimos;
for(const id of ['buscaGestaoLeitores','tipoGestaoLeitores'])$(id).addEventListener('input',renderizarGestaoLeitores);
$('tabelaGestaoLeitores').addEventListener('change',e=>{if(!e.target.dataset.selecaoLeitor)return;const id=Number(e.target.dataset.selecaoLeitor);if(e.target.checked)leitoresSelecionados.add(id);else leitoresSelecionados.delete(id);atualizarSelecaoLeitores();});
$('todosLeitores').onchange=()=>{leitoresGestao().forEach(p=>{$('todosLeitores').checked?leitoresSelecionados.add(p.id):leitoresSelecionados.delete(p.id);});renderizarGestaoLeitores();};
$('imprimirLeitores').onclick=imprimirLeitores;
$('tipoEditarLeitor').onchange=atualizarEdicaoLeitor;
$('anoEditarLeitor').onchange=()=>{atualizarTurmas($('anoEditarLeitor'),$('turmaEditarLeitor'));atualizarEdicaoLeitor();};
$('formEditarLeitor').addEventListener('submit',event=>{event.preventDefault();const dados={id:Number($('idEditarLeitor').value),nome:$('nomeEditarLeitor').value,tipo:$('tipoEditarLeitor').value,ano:$('anoEditarLeitor').value,turma:$('turmaEditarLeitor').value};executarFormulario(event.currentTarget,async()=>{await enviar('/api/pessoas','PUT',dados);$('modalEditarLeitor').close();mostrarToast('Leitor atualizado.');await carregar();});});
$('imprimirEtiquetas').onclick=()=>imprimir(`<div class="folha-etiquetas">${itensGestao().filter(l=>etiquetasSelecionadas.has(l.id)).map(l=>`<div class="etiqueta">${conteudoEtiqueta(l)}</div>`).join('')}</div>`);
$('imprimirRelacao').onclick=()=>imprimir(`<h1>Relação do acervo</h1><p>Colégio da Polícia Militar Eraldo Tinoco · ${dataBR(hoje())}</p>${tabela(colunasRelacao(),linhasRelacao())}`);
window.addEventListener('afterprint',()=>$('impressao').innerHTML='');
carregar();
function carregarImagem(arquivo) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();

    imagem.onload = () => {
      URL.revokeObjectURL(url);
      resolve(imagem);
    };

    imagem.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler essa imagem. Tente outra capa.'));
    };

    imagem.src = url;
  });
}

function canvasParaBlob(canvas, tipo, qualidade) {
  return new Promise(resolve => canvas.toBlob(resolve, tipo, qualidade));
}

async function otimizarCapa(arquivo) {
  const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];

  if (!tiposPermitidos.includes(arquivo.type)) {
    throw new Error('Use uma imagem JPG, PNG ou WebP.');
  }

  if (arquivo.size > MAX_ARQUIVO_ORIGINAL_BYTES) {
    throw new Error('A imagem original deve ter no máximo 15 MB.');
  }

  const imagem = await carregarImagem(arquivo);
  const maiorLado = Math.max(imagem.naturalWidth, imagem.naturalHeight);
  let escala = Math.min(1, MAX_CAPA_DIMENSAO / maiorLado);
  let largura = Math.max(1, Math.round(imagem.naturalWidth * escala));
  let altura = Math.max(1, Math.round(imagem.naturalHeight * escala));
  let qualidade = 0.84;
  let blob = null;

  for (let tentativa = 0; tentativa < 8; tentativa += 1) {
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;

    const contexto = canvas.getContext('2d', { alpha: false });
    contexto.fillStyle = '#ffffff';
    contexto.fillRect(0, 0, largura, altura);
    contexto.drawImage(imagem, 0, 0, largura, altura);

    blob = await canvasParaBlob(canvas, 'image/webp', qualidade);
    if (!blob) blob = await canvasParaBlob(canvas, 'image/jpeg', qualidade);
    if (!blob) throw new Error('Não foi possível processar a capa.');

    if (blob.size <= ALVO_CAPA_BYTES) break;

    if (qualidade > 0.58) {
      qualidade -= 0.08;
    } else {
      largura = Math.max(320, Math.round(largura * 0.85));
      altura = Math.max(420, Math.round(altura * 0.85));
    }
  }

  if (!blob || blob.size > 850 * 1024) {
    throw new Error('A capa ficou grande demais mesmo após a compressão. Tente outra imagem.');
  }

  const extensao = blob.type === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `capa.${extensao}`, { type: blob.type });
}




$('btnSair').addEventListener('click',async()=>{const b=$('btnSair');if(b.disabled)return;b.disabled=true;try{await enviar('/auth/logout','POST',{});window.location.replace('/');}catch(e){mostrarToast(e.message);b.disabled=false;}});
window.addEventListener('pageshow',event=>{if(event.persisted)window.location.reload();});
