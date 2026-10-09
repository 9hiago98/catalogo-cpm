const form=document.getElementById('formLogin'),erro=document.getElementById('erroLogin'),botao=document.getElementById('entrarLogin');
document.getElementById('mostrarSenha').addEventListener('change',event=>{document.getElementById('senhaLogin').type=event.target.checked?'text':'password';});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(botao.disabled)return;
 erro.hidden=true;botao.disabled=true;botao.textContent='Entrando…';
 try{
  const resposta=await fetch('/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario:document.getElementById('usuarioLogin').value,senha:document.getElementById('senhaLogin').value})});
  const dados=await resposta.json();if(!resposta.ok)throw new Error(dados.erro||'Não foi possível entrar.');
  document.getElementById('senhaLogin').value='';window.location.replace('/');
 }catch(e){erro.textContent=e.message||'Confira sua conexão e tente novamente.';erro.hidden=false;}finally{botao.disabled=false;botao.textContent='Entrar';}
});
