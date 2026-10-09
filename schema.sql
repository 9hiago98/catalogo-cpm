CREATE TABLE IF NOT EXISTS livros (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT NOT NULL, chave_titulo TEXT, autor TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>=1), tipo_item TEXT CHECK(tipo_item IN ('livro','jogo')), grupo TEXT CHECK(grupo IN ('Ensino Médio','Ensino Fundamental')), observacao TEXT NOT NULL DEFAULT '', ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)), criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS capas (livro_id INTEGER PRIMARY KEY REFERENCES livros(id), tipo TEXT NOT NULL, dados BLOB NOT NULL, tamanho INTEGER NOT NULL DEFAULT 0, atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS pessoas (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, chave TEXT, ativo INTEGER NOT NULL DEFAULT 1 CHECK(ativo IN (0,1)), tipo TEXT NOT NULL CHECK(tipo IN ('aluno','professor')), ano TEXT, turma TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK((tipo='professor' AND ano IS NULL AND turma IS NULL) OR (tipo='aluno' AND length(trim(ano))>0 AND length(trim(turma))>0 AND ano IS NOT NULL AND turma IS NOT NULL)));

CREATE TABLE IF NOT EXISTS emprestimos (id INTEGER PRIMARY KEY AUTOINCREMENT, livro_id INTEGER NOT NULL REFERENCES livros(id), pessoa_id INTEGER NOT NULL REFERENCES pessoas(id), data_emprestimo TEXT NOT NULL, quantidade INTEGER NOT NULL DEFAULT 1 CHECK(quantidade>=1), previsao_devolucao TEXT, turmas_professor TEXT, data_devolucao TEXT, criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, CHECK(data_devolucao IS NULL OR data_devolucao >= data_emprestimo));

CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros(titulo);

CREATE INDEX IF NOT EXISTS idx_livros_ativo_grupo ON livros(ativo,grupo);

CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome COLLATE NOCASE);

CREATE INDEX IF NOT EXISTS idx_pessoas_tipo_ano_turma ON pessoas(tipo,ano,turma);

CREATE INDEX IF NOT EXISTS idx_emprestimo_ativo ON emprestimos(livro_id) WHERE data_devolucao IS NULL;

CREATE INDEX IF NOT EXISTS idx_emprestimos_pessoa ON emprestimos(pessoa_id,data_emprestimo);

CREATE TRIGGER IF NOT EXISTS emprestar_apenas_ativo BEFORE INSERT ON emprestimos WHEN NOT EXISTS (SELECT 1 FROM livros WHERE id=NEW.livro_id AND ativo=1) BEGIN SELECT RAISE(ABORT,'livro_inativo'); END;

CREATE TRIGGER IF NOT EXISTS impedir_inativacao_emprestado BEFORE UPDATE OF ativo ON livros WHEN NEW.ativo=0 AND EXISTS(SELECT 1 FROM emprestimos WHERE livro_id=NEW.id AND data_devolucao IS NULL) BEGIN SELECT RAISE(ABORT,'livro_emprestado'); END;
CREATE INDEX IF NOT EXISTS idx_pessoas_chave ON pessoas(chave);
