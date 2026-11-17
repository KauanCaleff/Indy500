// Testes de audio e integracao sem alto-falantes, bibliotecas ou rede.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Parametro {
  constructor(valor=0){this.value=valor;this.eventos=[]}
  cancelScheduledValues(t){this.eventos.push(['cancelar',t])}
  setTargetAtTime(v,t,c){this.value=v;this.eventos.push(['alvo',v,t,c])}
  setValueAtTime(v,t){this.value=v;this.eventos.push(['valor',v,t])}
  linearRampToValueAtTime(v,t){this.value=v;this.eventos.push(['linear',v,t])}
  exponentialRampToValueAtTime(v,t){this.value=v;this.eventos.push(['exponencial',v,t])}
}
class NoAudio {
  constructor(ctx,tipo){
    this.ctx=ctx;this.tipoNo=tipo;this.conexoes=[];this.desconectado=false;
    for(const nome of ['gain','frequency','pan','threshold','knee','ratio','attack','release'])this[nome]=new Parametro();
    ctx.nos.push(this);
  }
  connect(no){this.conexoes.push(no)}
  disconnect(){this.desconectado=true}
  start(t=0){assert.equal(this.iniciado,undefined,'Fonte reutilizada depois de start');this.iniciado=t}
  stop(t=0){this.fim=t}
}
class ContextoAudio {
  constructor(){this.currentTime=0;this.sampleRate=8000;this.state='suspended';this.nos=[];this.destination={};ContextoAudio.instancias.push(this)}
  createGain(){return new NoAudio(this,'ganho')}
  createOscillator(){return new NoAudio(this,'oscilador')}
  createBufferSource(){return new NoAudio(this,'ruido')}
  createBiquadFilter(){return new NoAudio(this,'filtro')}
  createDynamicsCompressor(){return new NoAudio(this,'compressor')}
  createStereoPanner(){return new NoAudio(this,'panorama')}
  createBuffer(c,n){const dados=new Float32Array(n);return{getChannelData:()=>dados}}
  resume(){this.state='running';return Promise.resolve()}
  avancar(delta){this.currentTime+=delta;for(const no of this.nos){if(!no.terminou && no.fim<=this.currentTime){no.terminou=true;no.onended?.()}}}
}
ContextoAudio.instancias=[];
const elementos={},armazenamento=new Map();let agora=1000;
const desenho=new Proxy({},{get:()=>()=>{}});
const ambiente={document:{getElementById(id){return elementos[id]??={eventos:{},children:[],append(o){this.children.push(o)},addEventListener(e,f){this.eventos[e]=f},getContext:()=>desenho,classList:{add(){},remove(){}}}},createElement:()=>({}),addEventListener(){}},window:{AudioContext:ContextoAudio,localStorage:{getItem:k=>armazenamento.get(k)??null,setItem:(k,v)=>armazenamento.set(k,v)},addEventListener(){}},performance:{now:()=>agora},requestAnimationFrame(){}};
vm.createContext(ambiente);
for(const arquivo of ['audio.js','game.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',arquivo),'utf8'),ambiente);
vm.runInContext('globalThis.teste={jogo,SistemaAudio,CONFIG_AUDIO,VELOCIDADE_MAXIMA};',ambiente);
const {jogo,SistemaAudio,CONFIG_AUDIO,VELOCIDADE_MAXIMA}=ambiente.teste;
const audio=jogo.audio,[carro,rival]=jogo.jogadores;
assert.equal(ContextoAudio.instancias.length,0,'Nao cria contexto antes de iniciar');
elementos.soundButton.eventos.click();elementos.soundButton.eventos.click();assert.equal(ContextoAudio.instancias.length,0);
elementos.startButton.eventos.click();const ctx=audio.contexto;
assert.equal(ctx.state,'running');assert.equal(ContextoAudio.instancias.length,1);assert.equal(audio.motores.size,2);
assert.equal(audio.principal.gain.value,.28);assert(audio.efeitos.size>0);
const motor1=audio.motores.get('1'),motor2=audio.motores.get('2');
assert.equal(motor1.corpo.frequency.value,60);assert.equal(motor2.corpo.frequency.value,70);
const panoramas=ctx.nos.filter(n=>n.tipoNo==='panorama');assert.equal(panoramas[0].pan.value,-.25);assert.equal(panoramas[1].pan.value,.25);
const quantidadeNos=ctx.nos.length;
for(let i=0;i<1000;i++){carro.velocidade=(i%9);audio.atualizarMotor(carro)}
assert.equal(ctx.nos.length,quantidadeNos,'Motor nao cria nos por frame');
carro.velocidade=4;audio.atualizarMotor(carro);assert.equal(motor1.corpo.frequency.value,130);
carro.velocidade=-8;audio.atualizarMotor(carro);assert.equal(motor1.corpo.frequency.value,200);
carro.velocidade=0;audio.atualizarMotor(carro);assert.equal(motor1.corpo.frequency.value,60);
assert(motor1.corpo.frequency.eventos.some(e=>e[0]==='alvo'));
const registrar={};
for(const nome of ['somBatidaBarreira','somBatidaCarros','somDano','somExplosao','somVolta','terminarCorrida']){
  registrar[nome]=[];const original=audio[nome].bind(audio);
  audio[nome]=(...args)=>{registrar[nome].push(args);return original(...args)};
}
// Usa uma reta para comparar os impactos sem alterar as regras do jogo.
jogo.rodando=false;elementos.mapSelect.value='retangular';jogo.selecionarMapa();jogo.iniciar();
function bater(velocidade){carro.x=30;carro.y=250;carro.angulo=Math.PI;carro.velocidade=velocidade;jogo.resolverColisaoBarreira(carro)}
function afastar(){carro.x=80;carro.y=250;jogo.resolverColisaoBarreira(carro);carro.atualizarDano(1.1)}
bater(2);assert.equal(registrar.somBatidaBarreira.length,1);assert.equal(registrar.somDano.length,0);
bater(8);assert.equal(registrar.somBatidaBarreira.length,1);assert.equal(registrar.somDano.length,0);
afastar();bater(8);assert.equal(registrar.somBatidaBarreira.length,2);assert.equal(registrar.somDano.length,1);
assert.equal(registrar.somBatidaBarreira[1][0],8,'Som usa velocidade anterior ao impacto');
// Volume do impacto depende tambem da componente normal.
function picoBatida(v,n){audio.limparEfeitos();audio.somBatidaBarreira(v,n);return Math.max(...Array.from(audio.efeitos,e=>Math.max(...e.ganho.gain.eventos.filter(x=>x[0]==='linear').map(x=>x[1]))))}
assert(picoBatida(8,8)>picoBatida(8,.3));assert(picoBatida(8,8)>picoBatida(2,2));
carro.estaNaZebra=true;carro.velocidade=4;audio.atualizarMotor(carro);assert(motor1!==audio.motores.get('1'));
const atual1=audio.motores.get('1'),atual2=audio.motores.get('2');assert(atual1.ganhoZebra.gain.value>0);
const nosZebra=ctx.nos.length;for(let i=0;i<100;i++)audio.atualizarMotor(carro);assert.equal(ctx.nos.length,nosZebra);
carro.estaNaZebra=false;audio.atualizarMotor(carro);assert.equal(atual1.ganhoZebra.gain.value,0);
afastar();bater(8);afastar();bater(8);assert(carro.explodido);assert.equal(registrar.somExplosao.length,1);assert.equal(registrar.somDano.length,3);
assert.equal(atual1.ganho.gain.value,0);assert(atual2.ganho.gain.value>0);
carro.atualizarDano(3);audio.atualizarMotor(carro);assert(atual1.ganho.gain.value>0);assert.equal(audio.motores.size,2);
// Chegada sem checkpoints fica silenciosa; volta valida emite exatamente uma sequencia.
carro.reiniciar();carro.x=80;carro.y=251;carro.saiuDaLargada=true;carro.verificarVolta(jogo,249);assert.equal(registrar.somVolta.length,0);
carro.checkpoint=jogo.checkpoints.length;carro.verificarVolta(jogo,249);assert.equal(registrar.somVolta.length,1);assert.equal(carro.voltas,1);
// Contato entre carros tem memoria, com liberacao apenas ao se afastar.
carro.reiniciar();rival.reiniciar();carro.x=80;rival.x=90;carro.y=rival.y=250;
jogo.ultimoFrame=agora;jogo.atualizar();assert.equal(registrar.somBatidaCarros.length,1);
rival.x=carro.x+10;rival.y=carro.y;jogo.atualizar();assert.equal(registrar.somBatidaCarros.length,1);
rival.x=150;jogo.atualizar();rival.x=carro.x+10;rival.y=carro.y;jogo.atualizar();assert.equal(registrar.somBatidaCarros.length,2);
// Mute/volume alteram apenas o ganho principal e nao duplicam as fontes.
const motoresAntes=audio.motores.get('1');elementos.soundButton.eventos.click();assert(!audio.ativado);assert.equal(audio.principal.gain.value,0);
elementos.soundVolume.value='35';elementos.soundVolume.eventos.input();assert.equal(audio.volume,.35);assert.equal(audio.principal.gain.value,0);
elementos.soundButton.eventos.click();assert(audio.ativado);assert.equal(audio.principal.gain.value,.35);assert.equal(audio.motores.get('1'),motoresAntes);
assert.equal(armazenamento.get('somAtivado'),'true');assert.equal(armazenamento.get('volumeSom'),'0.35');
const salvo=new SistemaAudio();assert.equal(salvo.volume,.35);assert(salvo.ativado);
// Final emite uma unica vez, separa vitoria de empate e encerra sons continuos.
audio.limparEfeitos();carro.voltas=1;rival.voltas=0;jogo.terminar();assert.equal(audio.motores.size,0);const vitoria=audio.efeitos.size;
jogo.terminar();assert.equal(audio.efeitos.size,vitoria);assert.equal(registrar.terminarCorrida.length,1);
jogo.iniciar();carro.voltas=rival.voltas=0;jogo.terminar();assert(audio.efeitos.size<vitoria);
for(let i=0;i<10;i++){jogo.iniciar();assert.equal(audio.motores.size,2);assert.equal(ContextoAudio.instancias.length,1)}
jogo.rodando=false;jogo.selecionarMapa();assert.equal(audio.motores.size,0);assert.equal(audio.efeitos.size,0);
ctx.avancar(10);assert(ctx.nos.filter(n=>n.iniciado!==undefined).every(n=>n.desconectado),'Limpeza dos nos de audio');
// Todos os ganhos e envelopes permanecem no intervalo permitido.
for(const no of ctx.nos.filter(n=>n.tipoNo==='ganho')){
 assert(no.gain.value>=0 && no.gain.value<=1);
 assert(no.gain.eventos.filter(e=>e[0]!=='cancelar').every(e=>e[1]>=0&&e[1]<=1));
}
// API, panorama ou armazenamento ausentes nunca impedem uma corrida.
ambiente.window.localStorage={getItem(){throw Error('Bloqueado')},setItem(){throw Error('Bloqueado')}};
const bloqueado=new SistemaAudio();bloqueado.definirVolume(.2);bloqueado.definirAtivado(false);
ambiente.window.AudioContext=undefined;const semApi=new SistemaAudio();assert.equal(semApi.iniciar(),false);semApi.iniciarCorrida(jogo.jogadores);semApi.somDano();
ambiente.window.webkitAudioContext=ContextoAudio;const antigo=new SistemaAudio();assert(antigo.iniciar());
antigo.contexto.createStereoPanner=undefined;antigo.iniciarCorrida(jogo.jogadores);assert.equal(antigo.motores.size,2);antigo.limparCorrida();
console.log('OK audio: inicio por interacao, 2 motores, frequencias/re, panorama, impactos, contato, zebra, dano, explosao/retorno, voltas, resultado unico, mute, volume, preferencias, limites, limpeza e fallbacks.');
