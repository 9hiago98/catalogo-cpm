CATÁLOGO DE LIVROS — COLÉGIO DA POLÍCIA MILITAR ERALDO TINOCO

HTML, CSS e JavaScript puro; Cloudflare Pages Functions e D1.
Único binding necessário: DB, apontando para o banco D1 existente.

USO
Acervo: busca por título, autor ou código, filtros e empréstimo/devolução.
Empréstimos: apenas ativos, com pessoa e data.
Pessoas: pesquisa e ficha individual com todo o histórico. Pessoas novas
são cadastradas junto com o primeiro empréstimo, na mesma transação.
Gestão: livros, etiquetas selecionáveis e relação do acervo para impressão.
O código usa o ID, com pelo menos quatro dígitos. Há um exemplar por livro.

ATUALIZAÇÃO
Execute deploy-catalogo-cpm.bat ou:
  npx.cmd wrangler pages deploy public --project-name=catalogo-cpm
Nenhum comando SQL adicional é necessário, nem outro recurso Cloudflare.
A migração é executada automaticamente antes de atender a primeira chamada
à API. Também funciona em um banco novo com o binding DB configurado.

MIGRAÇÃO E PRESERVAÇÃO
functions/api/_middleware.js centraliza a migração idempotente.
Não há DROP, recriação de tabelas ou alteração dos IDs/capas existentes.
Os livros antigos ganham ativo=1 e grupo=NULL (Não definido).
As colunas antigas categoria e quantidade permanecem no banco existente
apenas por compatibilidade, sem uso na interface ou nas regras novas.
schema.sql representa uma instalação nova; não é necessário executá-lo
sobre o banco antigo. As tabelas de pessoas e empréstimos usam chaves
estrangeiras. Um índice único parcial impede dois empréstimos ativos
para o mesmo livro; gatilhos impedem emprestar inativos e inativar
emprestados. A remoção de livros é lógica e preserva capas e histórico.
A criação de pessoa e empréstimo usa batch transacional do D1.

CAPAS E DATAS
JPG, PNG e WebP, original até 15 MB; compressão no navegador.
Capas continuam como BLOB no D1, acessadas por /api/capa.
Datas de circulação: ISO YYYY-MM-DD; exibição DD/MM/AAAA.
A data atual usa o fuso America/Bahia. A previsão de devolução é opcional.

ARQUIVOS
public/index.html, public/style.css, public/script.js, public/logo-cpm.png
functions/api/livros.js, capa.js, pessoas.js, emprestimos.js, _middleware.js
schema.sql, deploy-catalogo-cpm.bat, README.txt

ACESSO ADMINISTRATIVO
Configure ADMIN_USERNAME, ADMIN_PASSWORD e SESSION_SECRET como secrets
no Cloudflare Pages, em Production e Preview. Não coloque seus valores
no código nem no repositório. Use Fail closed nas configurações Runtime.
functions/_middleware.js controla todas as rotas; public/_routes.json
obriga a verificação também antes dos arquivos estáticos. O acervo e
as capas são públicos para consulta. Dados de leitores, históricos e
operações administrativas exigem login. A resposta pública de /api/livros
contém apenas dados do item e saldo, sem identificação dos leitores.
/login permite entrar ou voltar ao acervo; /auth/session informa o modo
de acesso, /auth/login valida as credenciais e /auth/logout
revoga a sessão. Sessões são persistentes, com cookie Secure/HttpOnly,
renovado a cada acesso. Alterar os secrets invalida sessões anteriores.
As tabelas auth_sessoes e auth_tentativas são criadas automaticamente.
Apenas hashes da sessão são armazenados no banco. Não há cadastro ou
recuperação de senha. Para trocar a senha, altere ADMIN_PASSWORD e publique.
