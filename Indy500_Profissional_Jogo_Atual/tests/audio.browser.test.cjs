const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'indy500-browser-'));
const processo = spawn(chrome, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=9335','--remote-allow-origins=*',`--user-data-dir=${perfil}`,'about:blank'], {windowsHide:true, stdio:'ignore'});
const esperar = ms => new Promise(resolve => setTimeout(resolve,ms));
const pendentes = new Map();
const erros = [];
const rede = [];
let socket,contador=0;
function enviar(method, params={}) {
  return new Promise((resolve,reject)=>{
    const id=++contador;pendentes.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));
  });
}
async function avaliar(expression) {
  const r=await enviar('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
(async()=>{
 try {
  let paginas;
  for(let i=0;i<100;i++){
    try{paginas=await(await fetch('http://127.0.0.1:9335/json')).json();break}catch{await esperar(100)}
  }
  assert(paginas,'Chrome nao iniciou');
  socket=new WebSocket(paginas.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});
  socket.onmessage=evento=>{
    const m=JSON.parse(evento.data);
    if(m.id){const p=pendentes.get(m.id);pendentes.delete(m.id);if(m.error)p.reject(m.error);else p.resolve(m.result)}
    if(m.method==='Runtime.exceptionThrown')erros.push(m.params);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')erros.push(m.params);
    if(m.method==='Network.requestWillBeSent'&&/^https?:/.test(m.params.request.url))rede.push(m.params.request.url);
  };
  await enviar('Runtime.enable');await enviar('Page.enable');await enviar('Network.enable');
  await enviar('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
  await enviar('Page.navigate',{url:pathToFileURL(path.resolve(__dirname,'..','index.html')).href});
  for(let i=0;i<100;i++){if(await avaliar("document.readyState==='complete' && typeof jogo!=='undefined'"))break;await esperar(100)}

  assert.equal(await avaliar('jogo.audio.contexto'),null,'Audio nao deve iniciar ao carregar');
  async function clicar(seletor){
    const pos=await avaliar(`document.querySelector('${seletor}').scrollIntoView({behavior:'instant',block:'center'});
      (()=>{const r=document.querySelector('${seletor}').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
    await enviar('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...pos});
    await enviar('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...pos});
  }
  await clicar('#startButton');await esperar(250);
  let estado=await avaliar(`({contexto:jogo.audio.contexto.state,motores:jogo.audio.motores.size,
    ativo:jogo.audio.ativado,volume:jogo.audio.volume})`);
  assert.equal(estado.contexto,'running');assert.equal(estado.motores,2);assert.equal(estado.volume,.28);
  await avaliar(`globalThis.analisador=jogo.audio.contexto.createAnalyser();
    analisador.fftSize=2048;jogo.audio.principal.connect(analisador);`);
  await esperar(100);
  const energia=await avaliar(`(()=>{const a=new Float32Array(analisador.fftSize);analisador.getFloatTimeDomainData(a);
    return Math.sqrt(a.reduce((s,v)=>s+v*v,0)/a.length)})()`);
  assert(energia>0.00001,'Motor precisa gerar sinal real depois do clique');
  console.log('OK: AudioContext inicia por clique real, dois motores e sinal de audio mensuravel.');
  // Frequencias reais mudam suavemente e consideram marcha re.
  await avaliar(`jogo.rodando=false;jogo.jogadores[0].velocidade=8;jogo.audio.atualizarMotor(jogo.jogadores[0]);`);
  await esperar(250);
  const alta=await avaliar("jogo.audio.motores.get('1').corpo.frequency.value");assert(alta>190&&alta<=201);
  await avaliar(`jogo.jogadores[0].velocidade=0;jogo.audio.atualizarMotor(jogo.jogadores[0]);`);await esperar(250);
  const baixa=await avaliar("jogo.audio.motores.get('1').corpo.frequency.value");assert(baixa<70);
  await avaliar(`jogo.jogadores[0].velocidade=-8;jogo.audio.atualizarMotor(jogo.jogadores[0]);`);await esperar(250);
  assert(await avaliar("jogo.audio.motores.get('1').corpo.frequency.value")>190);
  // Vibra apenas quando em movimento na zebra, reutilizando o mesmo motor.
  await avaliar(`globalThis.motorOriginal=jogo.audio.motores.get('1');
    jogo.jogadores[0].estaNaZebra=true;jogo.audio.atualizarMotor(jogo.jogadores[0]);`);await esperar(150);
  assert(await avaliar('motorOriginal.ganhoZebra.gain.value')>0);
  await avaliar('jogo.jogadores[0].estaNaZebra=false;jogo.audio.atualizarMotor(jogo.jogadores[0]);');await esperar(150);
  assert(await avaliar('motorOriginal.ganhoZebra.gain.value')<.001);
  await clicar('#soundButton');await esperar(250);
  assert.equal(await avaliar('jogo.audio.ativado'),false);assert(await avaliar('jogo.audio.principal.gain.value')<.0001);
  await avaliar(`document.getElementById('soundVolume').value=35;document.getElementById('soundVolume').dispatchEvent(new Event('input'));`);
  await clicar('#soundButton');await esperar(250);
  assert.equal(await avaliar("jogo.audio.motores.get('1')===motorOriginal"),true);
  assert(Math.abs(await avaliar('jogo.audio.principal.gain.value')-.35)<.001);
  assert.equal(await avaliar("localStorage.getItem('volumeSom')"),'0.35');
  // Explosao silencia somente um motor e a recuperacao reativa os mesmos nos.
  await avaliar(`jogo.jogadores[0].explodir();jogo.audio.atualizarMotor(jogo.jogadores[0]);`);await esperar(120);
  const explosao=await avaliar(`({p1:jogo.audio.motores.get('1').ganho.gain.value,p2:jogo.audio.motores.get('2').ganho.gain.value})`);
  assert(explosao.p1<.001);assert(explosao.p2>.01);
  await avaliar('jogo.jogadores[0].atualizarDano(3);jogo.audio.atualizarMotor(jogo.jogadores[0]);');await esperar(250);
  assert(await avaliar('motorOriginal.ganho.gain.value')>.09);
  await avaliar(`jogo.rodando=true;jogo.jogadores[0].voltas=1;jogo.terminar();globalThis.efeitosFinal=jogo.audio.efeitos.size;jogo.terminar();`);
  assert.equal(await avaliar('jogo.audio.motores.size'),0);
  assert.equal(await avaliar('jogo.audio.efeitos.size===efeitosFinal'),true);
  await esperar(1200);assert.equal(await avaliar('jogo.audio.efeitos.size'),0,'Efeitos curtos precisam encerrar e desconectar');
  // Renders locais com a Web Audio real: sem gravar ou baixar arquivos de som.
  const niveis=await avaliar(`(async()=>{
    const ContextoOriginal=window.AudioContext;
    async function renderizar(tipo){
      window.AudioContext=function(){const ctx=new OfflineAudioContext(2,48000,48000);ctx.resume=()=>Promise.resolve();return ctx};
      const audio=new SistemaAudio();audio.iniciar();audio.definirAtivado(true);audio.definirVolume(1);
      const jogadores=[{numero:'1',velocidade:8,estaNaZebra:true},{numero:'2',velocidade:8,estaNaZebra:true}];
      if(tipo==='fraca')audio.somBatidaBarreira(2,2);
      if(tipo==='forte')audio.somBatidaBarreira(8,8);
      if(tipo==='metais')audio.somBatidaCarros(16);
      if(tipo==='maximo'){
        audio.iniciarCorrida(jogadores);for(const c of jogadores){audio.somExplosao(c);audio.somDano();audio.somVolta(c)}
        audio.somBatidaBarreira(8,8);audio.somBatidaCarros(16);
      }
      window.AudioContext=ContextoOriginal;
      const buffer=await audio.contexto.startRendering();const dados=buffer.getChannelData(0);
      let pico=0,soma=0;for(const v of dados){pico=Math.max(pico,Math.abs(v));soma+=v*v}
      return{pico,rms:Math.sqrt(soma/dados.length)};
    }
    try{return{fraca:await renderizar('fraca'),forte:await renderizar('forte'),metais:await renderizar('metais'),maximo:await renderizar('maximo')}}
    finally{window.AudioContext=ContextoOriginal;jogo.audio.definirVolume(.35)}
  })()`);
  assert(niveis.forte.rms>niveis.fraca.rms*1.5,'Batida forte deve soar mais intensa');
  assert(niveis.metais.rms>0);assert(niveis.maximo.pico<.98,'Mixagem sem clipping mesmo no volume maximo');
  assert(niveis.maximo.rms>0);
  console.log('OK: frequencias, re, zebra, mute/volume, preferencias, explosao/retorno e limpeza.');
  console.log('OK render Web Audio: '+JSON.stringify(niveis));
  // Reinicios repetidos deixam somente os motores da corrida atual.
  await avaliar(`for(let i=0;i<8;i++)jogo.iniciar();jogo.rodando=false`);await esperar(250);
  assert.equal(await avaliar('jogo.audio.motores.size'),2);
  await avaliar('jogo.audio.limparCorrida()');await esperar(250);
  assert.equal(await avaliar('jogo.audio.motores.size'),0);assert.equal(await avaliar('jogo.audio.efeitos.size'),0);
  // Preferencias sobrevivem ao recarregamento e ainda nao ha autoplay.
  await enviar('Page.reload');
  for(let i=0;i<100;i++){if(await avaliar("document.readyState==='complete' && typeof jogo!=='undefined'"))break;await esperar(100)}
  assert.equal(await avaliar('jogo.audio.contexto'),null);assert.equal(await avaliar('jogo.audio.volume'),.35);
  assert.equal(erros.length,0,JSON.stringify(erros));assert.equal(rede.length,0);
  console.log('OK: reinicios, troca/limpeza, preferencias apos reload, sem autoplay, sem rede e sem erros de console.');
 } finally {
  if(socket)socket.close();processo.kill();
  await esperar(500);
  if(path.dirname(perfil)===os.tmpdir() && path.basename(perfil).startsWith('indy500-browser-')){
    fs.rmSync(perfil,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});
