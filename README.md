# Afro Biblioteca

Sistema de consulta e gestão de um acervo escolar de livros e jogos, desenvolvido para o Colégio da Polícia Militar Eraldo Tinoco, em Vitória da Conquista, Bahia.

O projeto reúne três necessidades: manter uma relação dos itens do acervo, registrar os empréstimos na ficha individual de cada leitor e imprimir etiquetas com uma numeração simples. Não utiliza classificação bibliotecária formal.

Qualquer visitante pode consultar o acervo e a disponibilidade dos itens. Uma conta de administrador permite cadastrar e administrar itens, leitores e empréstimos, além de imprimir etiquetas e relatórios.

## Tecnologias

- **Interface:** HTML, CSS e JavaScript puro, com layout responsivo.
- **Hospedagem:** Cloudflare Pages.
- **Servidor:** Cloudflare Pages Functions, escritas em JavaScript.
- **Banco:** Cloudflare D1, baseado em SQLite.
- **Impressão:** diálogo de impressão do navegador, que também permite salvar como PDF.

Não há framework, etapa de compilação da interface, `package.json` ou instalação de dependências da aplicação. O Wrangler é utilizado via `npx` para desenvolvimento e publicação.

## Acesso público e administrativo

Ao abrir o site, o visitante encontra o **Acervo**, com busca por título, autor ou código e filtros por tipo de item, grupo e disponibilidade.

Sem login, é possível ver os itens, suas capas e sua disponibilidade. Não aparecem nomes de leitores, datas de empréstimo, históricos, botões de empréstimo/devolução ou abas administrativas. A resposta pública da API também omite esses dados pessoais; a restrição não depende apenas de esconder elementos na interface.

O botão **Entrar**, no cabeçalho, abre a tela de login. Ela contém usuário, senha, opção de mostrar a senha e **Voltar ao acervo**. Não há cadastro de contas nem recuperação de senha.

Após entrar, o administrador acessa **Acervo**, **Empréstimos** e **Gestão**. O botão **Sair** encerra a sessão e retorna ao acervo público.

## Funcionalidades

### Itens do acervo

- Cadastro e edição de livros e jogos, com título, tipo, observação e capa.
- Autor obrigatório para livros; autor/fabricante opcional para jogos.
- Grupo obrigatório para livros: Ensino Fundamental ou Ensino Médio. Jogos não utilizam esse campo.
- Quantidade de unidades para jogos; cada registro de livro representa uma unidade.
- Código automático baseado no ID, preenchido com pelo menos quatro dígitos: `1 → 0001`, `2 → 0002`.
- Ordenação por código crescente no acervo, na gestão, nas etiquetas e na relação impressa.
- Bloqueio de nomes repetidos entre itens ativos, incluindo diferenças de maiúsculas, acentos e espaços.
- Remoção lógica: o item sai do acervo, mas suas capas e seu histórico permanecem no banco. Itens com empréstimos ativos não podem ser removidos.

Itens antigos sem tipo continuam aparecendo em **Todos** e podem ser classificados posteriormente pela edição. Novos cadastros exigem Livro ou Jogo.

### Empréstimos

Ao selecionar **Emprestar**, o administrador preenche diretamente os dados do leitor, a data do empréstimo e, opcionalmente, a previsão de devolução.

Leitores são classificados como **Aluno** ou **Professor**. Se os dados corresponderem a um leitor existente, o empréstimo é associado à mesma ficha. A identificação considera nome, vínculo e, para alunos, ano e turma, normalizando maiúsculas e espaços. Não utiliza matrícula ou documento; homônimos com os mesmos dados podem ser associados à mesma ficha.

Para alunos, ano e turma são obrigatórios. Professores podem informar nenhuma, uma ou várias turmas atendidas naquele empréstimo. A mesma combinação de ano e turma não pode ser repetida.

| Item emprestado | Anos disponíveis |
| --- | --- |
| Livro do Ensino Fundamental | 6º, 7º, 8º e 9º |
| Livro do Ensino Médio | 1º, 2º e 3º |
| Jogo | Todos os sete anos |

As turmas disponíveis são A–D para todos os anos, com E também no 2º do Médio e E, F e G no 3º do Médio. Esses valores refletem a organização da escola e estão definidos em `public/script.js`.

Jogos podem ter vários empréstimos ativos, respeitando o saldo de unidades. Por exemplo, um jogo com duas unidades permite emprestar duas de uma vez ou uma para cada leitor. Se uma estiver emprestada, só uma fica disponível. O servidor e os gatilhos do banco impedem ultrapassar o saldo ou reduzir o total de unidades abaixo da quantidade já emprestada.

A tela **Empréstimos** mostra apenas os ativos, ordenados pela previsão de devolução, da mais próxima à mais distante. Registros sem previsão ficam no fim, por data de empréstimo crescente. Há busca e filtro Livro/Jogo.

Ao registrar a devolução, o sistema grava a data atual no fuso `America/Bahia` e libera as unidades do registro. A devolução encerra o empréstimo inteiro; não há devolução parcial de unidades dentro de um mesmo registro.

As situações são:

- **Emprestado:** empréstimo ativo sem prazo vencido, inclusive quando não há previsão.
- **Atrasado:** empréstimo ativo cuja previsão é anterior ao dia atual.
- **Devolvido:** devolução até a previsão, ou empréstimo sem previsão.
- **Devolvido com atraso:** data efetiva da devolução posterior à previsão.

Previsão e data efetiva são campos diferentes. A previsão não registra automaticamente uma devolução.

### Gestão

| Aba | Recursos |
| --- | --- |
| **Itens** | Cadastrar, editar e remover itens; consultar tipo, grupo e disponibilidade. |
| **Empréstimos** | Consultar apenas ativos, editar item/leitor/turmas/datas/quantidade, excluir e imprimir os selecionados. Não registra devoluções nessa aba. |
| **Leitores** | Consultar fichas com histórico, editar dados, excluir da relação e imprimir leitores selecionados com seus históricos completos. |
| **Etiquetas** | Selecionar itens e imprimir etiquetas com nome da escola, código e título. |
| **Relação do acervo** | Consultar e imprimir a relação dos itens ativos. |

As impressões de etiquetas, empréstimos e leitores permitem seleção individual ou **Selecionar todos**. A seleção e a impressão respeitam os filtros e buscas da área correspondente.

O nome do leitor no acervo, nas listas de empréstimos e na gestão abre a mesma ficha individual. Ao editar um leitor, é possível apagar um empréstimo **concluído** do histórico, mas não editar seus dados. Empréstimos ativos são administrados em **Gestão → Empréstimos**.

As exclusões têm efeitos diferentes:

- **Item:** sai do acervo, preservando o histórico e o código.
- **Empréstimo ativo:** é apagado da ficha do leitor e suas unidades ficam disponíveis novamente.
- **Leitor:** sai da relação, preservando os registros anteriores. A exclusão é bloqueada enquanto houver empréstimos ativos. Um novo empréstimo com os mesmos dados pode reativar sua ficha.
- **Registro concluído do histórico:** é apagado permanentemente, mediante confirmação.

Editar os dados de um leitor atualiza sua ficha. Editar o leitor associado a um empréstimo altera somente aquele empréstimo, associando-o a uma ficha correspondente aos dados informados.

## Estrutura do projeto

```text
public/
  index.html                 Interface do acervo e das áreas administrativas
  script.js                  Comportamento da aplicação e impressão
  style.css                  Estilos de tela, responsividade e impressão
  login.html                 Tela de login
  login.js                   Login e visualização da senha
  logo-cpm.png               Brasão usado no cabeçalho e no favicon
  _routes.json               Execução das Functions em todas as rotas
functions/
  _middleware.js             Autenticação, sessões e controle de acesso
  api/
    _middleware.js           Inicialização/migração do banco e tratamento de erros
    livros.js                Cadastro de itens e consulta pública/administrativa
    capa.js                  Leitura e manutenção das capas
    pessoas.js               Leitores e histórico
    emprestimos.js           Empréstimos e devoluções
schema.sql                   Estrutura inicial das tabelas do acervo
deploy-catalogo-cpm.bat       Publicação do projeto original pelo Windows
README.md                    Documentação
```

Os nomes internos `livros` e `pessoas` foram mantidos por compatibilidade. A tabela e a API `livros` atendem tanto livros quanto jogos; `pessoas` corresponde aos leitores.

## Configuração de uma nova instalação

Você precisa de Node.js — a versão 24 foi utilizada nas validações locais — e uma conta Cloudflare com acesso a Pages e D1. Os comandos abaixo devem ser executados na raiz do projeto. No PowerShell, use `npx.cmd` caso a execução de `npx.ps1` esteja bloqueada.

### 1. Autenticar o Wrangler

```sh
npx wrangler login
```

Autorize o acesso à conta Cloudflare no navegador.

### 2. Criar os recursos

Escolha nomes disponíveis para sua instalação:

```sh
npx wrangler d1 create afro-biblioteca-db
npx wrangler pages project create afro-biblioteca --production-branch main
```

O nome do projeto Pages determina seu endereço `*.pages.dev`. Os comandos são exemplos para uma instalação nova; não recrie o banco de uma instalação existente.

### 3. Vincular o banco

No painel Cloudflare, abra **Workers & Pages → seu projeto → Settings → Bindings** e adicione um binding D1:

- **Nome da variável:** `DB` — exatamente assim.
- **Banco:** o D1 criado no passo anterior.

Configure o binding nos ambientes **Production** e **Preview**. Para testes independentes dos dados de produção, use outro banco no Preview.

### 4. Configurar os segredos

Em **Settings → Variables and Secrets**, adicione estes valores como **Secret/Encrypt**, em Production e Preview:

| Nome | Finalidade |
| --- | --- |
| `ADMIN_USERNAME` | Usuário da conta administrativa. |
| `ADMIN_PASSWORD` | Senha forte e exclusiva da conta administrativa. |
| `SESSION_SECRET` | Chave aleatória de pelo menos 32 caracteres para a autenticação das sessões. |

Gere uma chave de 64 caracteres com:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Copie a saída para o segredo `SESSION_SECRET`. Não use a senha de login como chave de sessão nem publique os valores desses segredos.

Os três segredos e o binding `DB` são necessários ao funcionamento atual, inclusive para iniciar a consulta pública. Sem a configuração necessária, o servidor responde com erro de configuração.

### 5. Configurar o bloqueio em caso de falha

Em **Settings → Runtime → Fail open / closed**, selecione **Fail closed** para Production e Preview. Isso impede que arquivos sejam servidos ignorando as Functions quando sua execução estiver indisponível.

### 6. Publicar

```sh
npx wrangler pages deploy public --project-name=afro-biblioteca
```

Execute o comando na raiz, onde está a pasta `functions`. O envio de arquivos pelo painel não substitui essa publicação das Pages Functions.

O `deploy-catalogo-cpm.bat` usa o nome do projeto original, `catalogo-cpm`. Para outra instalação, ajuste esse nome ou use o comando acima com o nome correto.

Abra o endereço informado pelo Wrangler. Confira o acervo público, o login, uma operação administrativa e a saída. Os segredos são aplicados à implantação; após alterá-los, publique novamente.

## Desenvolvimento local

Crie, apenas no seu ambiente local, um arquivo `.dev.vars` na raiz com credenciais de teste:

```dotenv
ADMIN_USERNAME=admin-local
ADMIN_PASSWORD=SUBSTITUA_POR_UMA_SENHA_LOCAL
SESSION_SECRET=SUBSTITUA_PELA_CHAVE_ALEATORIA_GERADA
```

Substitua os exemplos antes de executar. Mantenha esse arquivo fora do Git.

Inicie o ambiente local, com D1 local e HTTPS:

```sh
npx wrangler pages dev public --d1 DB --local-protocol=https
```

Acesse a URL exibida no terminal. O certificado local pode exigir confirmação no navegador. HTTPS é necessário para o cookie de sessão marcado como `Secure`.

O banco local é separado do remoto; não use `--remote` para esses testes. Abrir `index.html` diretamente ou usar apenas um servidor de arquivos estáticos não executa autenticação, APIs ou D1.

Não há suíte automatizada de testes incluída no repositório. Para verificar alterações, use dados de teste no ambiente local e confira os fluxos afetados, incluindo acesso público/administrativo, saldo de jogos, devolução, histórico e impressão.

## Banco e migrações

As tabelas principais são:

| Tabela | Conteúdo |
| --- | --- |
| `livros` | Livros/jogos, código, tipo, quantidade, grupo e estado ativo. |
| `capas` | Imagens em BLOB e seus metadados, vinculadas ao item. |
| `pessoas` | Dados e estado ativo dos leitores. |
| `emprestimos` | Item, leitor, quantidade, turmas do professor, datas e previsão. |
| `auth_sessoes` | Identificadores protegidos das sessões administrativas. |
| `auth_tentativas` | Contagem de tentativas de login. |

As tabelas de autenticação são criadas pelo middleware principal. As tabelas do acervo, colunas de compatibilidade, índices e gatilhos são criados ou atualizados automaticamente pelo middleware da API. Não é necessário executar `schema.sql` para iniciar a aplicação em um banco vazio.

`schema.sql` documenta a estrutura inicial do acervo; não contém toda a inicialização de autenticação nem todos os gatilhos adicionados em tempo de execução. O código dos middlewares é a referência completa da inicialização atual.

As migrações preservam tabelas, registros, capas e IDs existentes. A atualização para estoque de jogos substitui o antigo índice que permitia apenas um empréstimo ativo por item; o saldo passa a ser protegido por gatilhos. Não há reset automático, botão de reset ou reutilização automática de códigos excluídos.

Para jogos, várias unidades compartilham um único cadastro e código. As etiquetas identificam o cadastro, não uma unidade física individual.

## Autenticação e privacidade

Há uma única conta administrativa, configurada pelos segredos. Não existem permissões por usuário nem registro de qual funcionário realizou cada operação.

A autenticação acontece no servidor. O cookie é `HttpOnly`, `Secure` e `SameSite=Strict`; seu valor não é salvo em `localStorage`. No banco, o identificador da sessão é armazenado como hash autenticado com a chave de sessão, não como o token enviado ao navegador.

Não há encerramento da sessão após algumas horas de uso. O cookie persistente tem duração máxima configurada de 400 dias, renovada nos acessos autenticados. Sair revoga a sessão no servidor. Limpar os dados do navegador ou alterar as credenciais/chave também exige novo login.

O login limita tentativas por endereço IP em uma janela de 15 minutos. Operações de alteração exigem origem compatível com o site. As APIs de leitores, históricos e empréstimos continuam protegidas mesmo que alguém tente acessá-las diretamente.

`public/_routes.json` é necessário: sua configuração inclui todas as rotas na execução das Functions. Mantenha-o na publicação.

## API

| Rota | Métodos e acesso |
| --- | --- |
| `/auth/session` | `GET`: informa se há sessão administrativa válida. |
| `/auth/login` | `POST`: valida usuário/senha e cria a sessão. |
| `/auth/logout` | `POST`: revoga a sessão e remove o cookie. |
| `/api/livros` | `GET` público com dados limitados; autenticado inclui detalhes administrativos. `POST`, `PUT` e `DELETE` exigem login. |
| `/api/capa?id=ID` | `GET` público para a imagem. `POST` e `DELETE` exigem login. |
| `/api/pessoas` | `GET`, `PUT`, `DELETE` e `PATCH` exigem login. `GET` com `?id=ID` inclui histórico; `PATCH` apaga um registro concluído. |
| `/api/emprestimos` | Todos exigem login: `GET` lista ativos; `POST` empresta; `PUT` devolve; `PATCH` edita; `DELETE` exclui um ativo. |

As chamadas utilizam JSON, exceto o envio de capa, que utiliza `multipart/form-data`. O cliente também envia o cookie de sessão nas operações administrativas.

## Capas, datas e impressão

- Imagens aceitas: JPG, PNG e WebP; arquivo original de até 15 MB.
- A interface redimensiona e comprime as imagens antes de enviá-las. A API aceita imagens processadas de até 900 KiB.
- As capas são armazenadas no D1; não há dependência de R2 ou de um serviço externo de imagens.
- Datas são armazenadas em `YYYY-MM-DD`, exibidas em `DD/MM/AAAA` e calculadas no fuso `America/Bahia`.
- A impressão possui estilos próprios para A4. O usuário escolhe impressora ou PDF no diálogo do navegador.

## Backup e recuperação

Os dados cadastrados ficam no D1, não nos arquivos da interface. Publicar uma atualização do código não cria uma cópia de segurança dos registros.

É possível exportar o banco completo, incluindo capas e históricos:

```sh
npx wrangler d1 export afro-biblioteca-db --remote --output=backup.sql
```

Substitua o nome pelo banco correto e guarde o arquivo em local privado. Uma rotina diária pode executar essa exportação e armazená-la fora da Cloudflare, por exemplo em um repositório **privado** com GitHub Actions. Essa automação é configurada separadamente e não está incluída nos arquivos desta aplicação.

Para testar uma recuperação, crie um banco separado e importe o SQL:

```sh
npx wrangler d1 create afro-biblioteca-restauracao-teste
npx wrangler d1 execute afro-biblioteca-restauracao-teste --remote --file=backup.sql
```

Confira itens, capas, leitores, quantidades, históricos e sequências antes de usar o banco restaurado. Capas em BLOB podem gerar instruções SQL grandes; se o D1 rejeitar uma instrução por tamanho, a importação precisará ser adaptada. Um backup exportado com sucesso não substitui o teste de restauração.

O export também pode incluir as tabelas de autenticação. Trate a cópia inteira como privada; não publique backups no repositório do código.

## Publicação do código no Git

O repositório pode conter `public/`, `functions/`, `schema.sql`, este README e o script de publicação. O banco preenchido, as credenciais e a rotina privada de backup não precisam acompanhar o código.

Antes de enviar, configure um `.gitignore`, por exemplo:

```gitignore
.wrangler/
node_modules/
.env
.env.*
.dev.vars
.dev.vars.*
*.log
backup*.sql
*.sqlite
*.sqlite3
```

Não ignore todos os arquivos `.sql`: `schema.sql` faz parte da documentação do projeto. Inclua regras adicionais para pastas ou nomes usados nos seus backups.

A identidade visual e os textos de etiquetas/relatórios estão adaptados ao CPM Eraldo Tinoco. Para utilizar o projeto em outra instituição, revise esses textos e seus próprios recursos visuais.

## Referências

- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Bindings e segredos](https://developers.cloudflare.com/pages/functions/bindings/)
- [Middleware e proteção de arquivos estáticos](https://developers.cloudflare.com/pages/functions/middleware/)
- [Roteamento e Fail closed](https://developers.cloudflare.com/pages/functions/routing/)
- [Importação e exportação do D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
