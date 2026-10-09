const COOKIE='__Host-afro_sessao';
const encoder=new TextEncoder();
const schemas=new WeakMap();
const publicos=new Set(['/style.css','/login.js','/script.js','/logo-cpm.png']);
function json(dados,status=200,headers={}){return new Response(JSON.stringify(dados),{status,headers:{'Content-Type':'application/json; charset=UTF-8',...headers}});}
function proteger(resposta){const r=new Response(resposta.body,resposta);r.headers.set('Cache-Control','no-store');r.headers.set('X-Content-Type-Options','nosniff');r.headers.set('X-Frame-Options','DENY');r.headers.set('Referrer-Policy','same-origin');r.headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");return r;}
const redirecionar=local=>new Response(null,{status:303,headers:{Location:local}});
const cookie=(token,idade=34560000)=>`${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${idade}`;
function tokenCookie(request){const valores=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));if(valores.length!==1)return null;const token=valores[0].slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;}
async function assinatura(env,valor){const key=await crypto.subtle.importKey('raw',encoder.encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(valor)));}
const hexadecimal=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function credencial(env){return hexadecimal(await assinatura(env,'credencial:'+JSON.stringify([env.ADMIN_USERNAME,env.ADMIN_PASSWORD])));}
function iguais(a,b){if(a.length!==b.length)return false;let diferenca=0;for(let i=0;i<a.length;i++)diferenca|=a[i]^b[i];return diferenca===0;}
async function inicializar(db){if(!schemas.has(db))schemas.set(db,db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS auth_sessoes(token_hash TEXT PRIMARY KEY,credencial TEXT NOT NULL,criado_em INTEGER NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS auth_tentativas(chave TEXT PRIMARY KEY,total INTEGER NOT NULL,inicio INTEGER NOT NULL)')
]).catch(e=>{schemas.delete(db);throw e;}));await schemas.get(db);}
async function sessao(request,env){const token=tokenCookie(request);if(!token)return null;const hash=hexadecimal(await assinatura(env,'sessao:'+token));const versao=await credencial(env);const registro=await env.DB.prepare('SELECT token_hash FROM auth_sessoes WHERE token_hash=? AND credencial=?').bind(hash,versao).first();return registro?{hash,token}:null;}
async function entrar(request,env){
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({erro:'Dados de login inválidos.'},400);
 const texto=await request.text();if(encoder.encode(texto).length>4096)return json({erro:'Dados de login inválidos.'},400);
 let dados;try{dados=JSON.parse(texto);}catch{return json({erro:'Dados de login inválidos.'},400);}
 if(typeof dados?.usuario!=='string'||typeof dados?.senha!=='string'||dados.usuario.length>120||dados.senha.length>512)return json({erro:'Usuário ou senha incorretos.'},401);
 const agora=Math.floor(Date.now()/1000),limite=agora-900;
 const chave=hexadecimal(await assinatura(env,'tentativas:'+(request.headers.get('CF-Connecting-IP')||'local')));
 await env.DB.prepare('DELETE FROM auth_tentativas WHERE inicio<?').bind(limite).run();
 await env.DB.prepare('INSERT INTO auth_tentativas(chave,total,inicio) VALUES(?,1,?) ON CONFLICT(chave) DO UPDATE SET total=total+1').bind(chave,agora).run();
 const tentativas=await env.DB.prepare('SELECT total FROM auth_tentativas WHERE chave=?').bind(chave).first();
 if(tentativas.total>10)return json({erro:'Muitas tentativas. Aguarde 15 minutos e tente novamente.'},429,{'Retry-After':'900'});
 const recebido=await assinatura(env,'credencial:'+JSON.stringify([dados.usuario,dados.senha]));
 const esperado=await assinatura(env,'credencial:'+JSON.stringify([env.ADMIN_USERNAME,env.ADMIN_PASSWORD]));
 if(!iguais(recebido,esperado))return json({erro:'Usuário ou senha incorretos.'},401);
 const token=hexadecimal(crypto.getRandomValues(new Uint8Array(32))),hash=hexadecimal(await assinatura(env,'sessao:'+token));
 await env.DB.batch([
  env.DB.prepare('DELETE FROM auth_sessoes WHERE credencial<>?').bind(hexadecimal(esperado)),
  env.DB.prepare('INSERT INTO auth_sessoes(token_hash,credencial,criado_em) VALUES(?,?,?)').bind(hash,hexadecimal(esperado),agora)
 ]);
 return json({ok:true},200,{'Set-Cookie':cookie(token)});
}
export async function onRequest(context){
 const {request,env}=context,url=new URL(request.url),path=url.pathname;
 try{
  if(publicos.has(path)&&['GET','HEAD'].includes(request.method))return proteger(await context.next());
  if(!env.DB||!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD||typeof env.SESSION_SECRET!=='string'||env.SESSION_SECRET.length<32)return proteger(json({erro:'O acesso administrativo ainda não está configurado.'},503));
  await inicializar(env.DB);
  if(!['GET','HEAD','OPTIONS'].includes(request.method)&&request.headers.get('Origin')!==url.origin)return proteger(json({erro:'Origem da solicitação inválida.'},403));
  if(path==='/auth/login')return proteger(request.method==='POST'?await entrar(request,env):json({erro:'Método não permitido.'},405));
  const autenticado=await sessao(request,env);
  if(path==='/auth/logout'){
   if(request.method!=='POST')return proteger(json({erro:'Método não permitido.'},405));
   if(autenticado)await env.DB.prepare('DELETE FROM auth_sessoes WHERE token_hash=?').bind(autenticado.hash).run();
   return proteger(json({ok:true},200,{'Set-Cookie':cookie('',0)}));
  }
  if(path==='/login'||path==='/login/'||path==='/login.html'){
   if(autenticado)return proteger(redirecionar('/'));
   if(path!=='/login')return proteger(redirecionar('/login'));
   const asset=new URL('/login',url);return proteger(await env.ASSETS.fetch(new Request(asset,{method:request.method==='HEAD'?'HEAD':'GET'})));
  }
  context.data.administrador=Boolean(autenticado);
  if(path==='/auth/session')return proteger(request.method==='GET'?json({autenticado:Boolean(autenticado)}):json({erro:'Método não permitido.'},405));
  const consultaPublica=request.method==='GET'&&(path==='/api/livros'||path==='/api/capa');
  const paginaPublica=['GET','HEAD'].includes(request.method)&&(path==='/'||path==='/index.html');
  if(!autenticado&&!consultaPublica&&!paginaPublica)return proteger(path.startsWith('/api/')?json({erro:'Faça login para acessar a administração.'},401):redirecionar('/login'));
  const r=proteger(await context.next());if(autenticado)r.headers.set('Set-Cookie',cookie(autenticado.token));return r;
 }catch{
  return proteger(json({erro:'Não foi possível verificar o acesso. Tente novamente.'},503));
 }
}
