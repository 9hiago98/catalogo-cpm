const MAX_BYTES = 900 * 1024;
const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);

function json(dados, status = 200) {
  return new Response(JSON.stringify(dados), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store'
    }
  });
}

function validarId(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = validarId(url.searchParams.get('id'));
  if (!id) return new Response(null, { status: 400 });

  try {

    const registro = await env.DB.prepare(
      'SELECT tipo, dados, atualizado_em FROM capas WHERE livro_id = ?'
    ).bind(id).first();

    if (!registro?.dados) return new Response(null, { status: 404 });

    // D1 devolve BLOB como Array de bytes.
    const bytes = Uint8Array.from(registro.dados);

    return new Response(bytes, {
      headers: {
        'Content-Type': registro.tipo || 'image/webp',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (erro) {
    console.error('Erro GET /api/capa:', erro);
    return new Response(null, { status: 500 });
  }
}

export async function onRequestPost({ request, env }) {
  try {


    const formData = await request.formData();
    const id = validarId(formData.get('livroId'));
    const arquivo = formData.get('capa');

    if (!id) return json({ erro: 'Livro inválido.' }, 400);
    if (!arquivo || typeof arquivo.arrayBuffer !== 'function') {
      return json({ erro: 'Selecione uma imagem para a capa.' }, 400);
    }
    if (!TIPOS_PERMITIDOS.has(arquivo.type)) {
      return json({ erro: 'Use uma imagem JPG, PNG ou WebP.' }, 400);
    }
    if (arquivo.size > MAX_BYTES) {
      return json({ erro: 'A imagem processada ficou grande demais. Tente outra capa.' }, 400);
    }

    const existe = await env.DB.prepare('SELECT id FROM livros WHERE id = ? AND ativo = 1').bind(id).first();
    if (!existe) return json({ erro: 'Livro não encontrado.' }, 404);

    const buffer = await arquivo.arrayBuffer();

    await env.DB.prepare(`
      INSERT INTO capas (livro_id, tipo, dados, tamanho, atualizado_em)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(livro_id) DO UPDATE SET
        tipo = excluded.tipo,
        dados = excluded.dados,
        tamanho = excluded.tamanho,
        atualizado_em = CURRENT_TIMESTAMP
    `).bind(id, arquivo.type, buffer, arquivo.size).run();

    return json({ ok: true });
  } catch (erro) {
    console.error('Erro POST /api/capa:', erro);
    return json({ erro: 'Não foi possível salvar a capa no D1.' }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  try {

    const corpo = await request.json().catch(() => null);
    const id = validarId(corpo?.id);
    if (!id) return json({ erro: 'Livro inválido.' }, 400);

    await env.DB.prepare('DELETE FROM capas WHERE livro_id = ?').bind(id).run();
    return json({ ok: true });
  } catch (erro) {
    console.error('Erro DELETE /api/capa:', erro);
    return json({ erro: 'Não foi possível remover a capa.' }, 500);
  }
}

