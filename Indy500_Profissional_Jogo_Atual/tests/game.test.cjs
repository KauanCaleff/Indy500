const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const elementos = {};
const contexto = new Proxy({}, {get: () => () => {}});
let agora = 1000;
const ambiente = {
  document: {
    getElementById(id) {
      return elementos[id] ??= {children: [], append(o) {this.children.push(o)},
        getContext: () => contexto, classList: {add() {}, remove() {}}, addEventListener() {}};
    },
    createElement: () => ({}), addEventListener() {}
  },
  window: {addEventListener() {}},
  performance: {now: () => agora}, requestAnimationFrame() {}
};
vm.createContext(ambiente);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'audio.js'), 'utf8'), ambiente);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'game.js'), 'utf8') +
  '\nglobalThis.teste = {jogo, MAPAS, teclas, LARGURA_PISTA, LARGURA_ZEBRA, VELOCIDADE_MAXIMA, DURACAO_EXPLOSAO, ParticulaFumaca, ObjetoJogo};', ambiente);
const {jogo, MAPAS, teclas, LARGURA_PISTA, LARGURA_ZEBRA, VELOCIDADE_MAXIMA, DURACAO_EXPLOSAO, ParticulaFumaca, ObjetoJogo} = ambiente.teste;
const [carro, rival] = jogo.jogadores;
function perto(valor, esperado, tolerancia = 0.001) {assert(Math.abs(valor-esperado) < tolerancia, `${valor} != ${esperado}`)}
function carregar(id) {jogo.rodando = false; elementos.mapSelect.value = id; jogo.selecionarMapa()}
function dentro(c) {
  const t = jogo.encontrarTrechoMaisProximo(c.x, c.y);
  assert(t.distancia + jogo.alcanceCarro(c,t.normal) <= LARGURA_PISTA/2+LARGURA_ZEBRA+0.01, 'Carro atravessou a barreira');
}
function impacto(angulo, velocidade, reiniciar = true) {
  if (reiniciar) carro.reiniciar();
  carro.x=30; carro.y=250; carro.angulo=angulo; carro.velocidade=velocidade;
  jogo.resolverColisaoBarreira(carro);
  dentro(carro);
}
assert(LARGURA_PISTA > 86);
assert.equal(elementos.mapSelect.children.length, 4);
for(const id of Object.keys(MAPAS)) {
  carregar(id);
  assert(jogo.jogadores.every(c=>jogo.naPista(c.x,c.y)));
  assert(jogo.checkpoints.every(p=>jogo.naPista(p.x,p.y)));
  assert(jogo.pneus.length > 100);
  assert(jogo.pneus.every(p=>jogo.distanciaAtePista(p.x,p.y)>=LARGURA_PISTA/2+LARGURA_ZEBRA+2.9));
  assert(jogo.pneus.some(p=>p.x<80) && jogo.pneus.some(p=>p.x>80));
  jogo.iniciar(); assert.equal(elementos.mapSelect.disabled,true);
  const curvas=jogo.curvas; jogo.selecionarMapa(); assert.equal(jogo.curvas,curvas);
  // Percorre o circuito com deslocamentos menores que a velocidade maxima.
  let inicio=0;
  for(let i=0;i<jogo.pontosPista.length;i++) if(carro.distancia(jogo.pontosPista[i])<carro.distancia(jogo.pontosPista[inicio])) inicio=i;
  for(let i=0;i<=jogo.pontosPista.length*3;i++) {
    const alvo=jogo.pontosPista[(inicio+i)%jogo.pontosPista.length];
    carro.angulo=Math.atan2(alvo.y-carro.y,alvo.x-carro.x);
    carro.velocidade=carro.distancia(alvo)/.99;
    carro.mover(jogo); dentro(carro);
  }
  assert.equal(carro.voltas,2,id+': voltas');
  // Testa as duas bordas em curvas, incluindo extremos e pontas apertadas.
  for(let i=0;i<jogo.bordas.length;i+=5) {
    const {ponto,normal}=jogo.bordas[i];
    for(const lado of [-1,1]) {
      carro.reiniciar();
      carro.x=ponto.x+normal.x*lado*55; carro.y=ponto.y+normal.y*lado*55;
      carro.angulo=Math.atan2(normal.y*lado,normal.x*lado);carro.velocidade=8;
      jogo.resolverColisaoBarreira(carro);dentro(carro);
      for(let j=0;j<3;j++){carro.mover(jogo);dentro(carro)}
    }
  }
  jogo.desenhar();
  console.log('OK mapa '+id+': largura, bordas, pneus, curvas, checkpoints, voltas e bloqueio do seletor');
}
carregar('retangular');
impacto(Math.PI,8); perto(carro.velocidade,0);assert.equal(carro.vidas,2);
impacto(Math.PI*3/4,8);assert(Math.abs(carro.velocidade)>4 && Math.abs(carro.velocidade)<6);
impacto(Math.PI/2+0.08,8);assert(carro.velocidade>7.7);
impacto(Math.PI/2,8);perto(carro.velocidade,8);
impacto(Math.PI,5);assert.equal(carro.vidas,3);assert.equal(carro.estadoDano,'normal');
impacto(Math.PI,VELOCIDADE_MAXIMA*2/3);assert.equal(carro.vidas,2);assert.equal(carro.estadoDano,'branca');
carro.atualizarFumaca(.07);assert.equal(carro.particulas[0].cor,'#f5f5f5');
assert(carro.particulas[0] instanceof ParticulaFumaca && carro.particulas[0] instanceof ObjetoJogo);
carro.atualizarDano(1.1);
impacto(Math.PI,8,false);assert.equal(carro.vidas,2,'Contato continuo nao tira outra vida');
carro.x=80;carro.y=250;jogo.resolverColisaoBarreira(carro);
impacto(Math.PI,8,false);assert.equal(carro.vidas,1);assert.equal(carro.estadoDano,'preta');
carro.particulas=[];carro.atualizarFumaca(.07);assert.equal(carro.particulas[0].cor,'#252525');
carro.atualizarDano(1.1);carro.x=80;jogo.resolverColisaoBarreira(carro);
carro.voltas=4;carro.checkpoint=2;
impacto(Math.PI,8,false);assert.equal(carro.vidas,0);assert(carro.explodido);assert.equal(carro.velocidade,0);
teclas.KeyW=true;teclas.ArrowUp=true;
const pos={x:carro.x,y:carro.y};rival.reiniciar();const rivalY=rival.y;
carro.mover(jogo,.1);rival.mover(jogo,.1);
assert.equal(carro.x,pos.x);assert.equal(carro.y,pos.y);assert(rival.y>rivalY);
let piscou=false,visivel=false;
for(let i=0;i<28;i++){carro.mover(jogo,.1);piscou ||= carro.piscando;visivel ||= !carro.piscando}
assert(carro.explodido);assert(piscou&&visivel);
carro.mover(jogo,.11);assert(!carro.explodido);assert.equal(carro.vidas,3);
assert.equal(carro.voltas,4);assert.equal(carro.checkpoint,0);assert.equal(carro.estadoDano,'normal');assert.equal(carro.particulas.length,0);
assert(carro.tempoInvulneravel>0);assert(!carro.podeSofrerDano);
assert.equal(carro.x,carro.xInicial);dentro(carro);
teclas.KeyW=false;teclas.ArrowUp=false;
// Zebra aplica uma unica reducao e devolve somente velocidade valida.
carro.reiniciar();carro.x=33;carro.y=250;carro.velocidade=4;
carro.verificarZebra(jogo);assert(carro.estaNaZebra);perto(carro.velocidade,3);
for(let i=0;i<10;i++)carro.verificarZebra(jogo);perto(carro.velocidade,3);
carro.x=80;carro.verificarZebra(jogo);perto(carro.velocidade,4);
carro.x=33;carro.verificarZebra(jogo);teclas.KeyS=true;carro.mover(jogo);teclas.KeyS=false;
const freada=carro.velocidade;carro.x=80;carro.verificarZebra(jogo);perto(carro.velocidade,freada);
carro.reiniciar();carro.x=33;carro.velocidade=6;carro.verificarZebra(jogo);
carro.x=25;carro.angulo=Math.PI;jogo.resolverColisaoBarreira(carro);
const aposColisao=carro.velocidade;carro.x=80;carro.verificarZebra(jogo);perto(carro.velocidade,aposColisao);
// Particulas expiram e permanecem limitadas.
carro.reiniciar();carro.estadoDano='preta';for(let i=0;i<10000;i++)carro.atualizarFumaca(1/60);
assert(carro.particulas.length<80);carro.estadoDano='normal';carro.atualizarFumaca(2);assert.equal(carro.particulas.length,0);
// Fim da corrida durante uma explosao usa normalmente as voltas.
jogo.iniciar();carro.voltas=3;rival.voltas=2;carro.explodir();agora+=60000;jogo.atualizar();
assert.equal(jogo.rodando,false);assert.equal(jogo.tempoRestante,0);assert.equal(elementos.overlayTitle.textContent,'Jogador 1 venceu!');assert.equal(elementos.mapSelect.disabled,false);
jogo.iniciar();assert.equal(carro.vidas,3);assert.equal(carro.voltas,0);assert.equal(carro.explodido,false);
console.log('OK: angulos, limiar de dano, contato, fumacas, explosao de '+DURACAO_EXPLOSAO+'s, rival, retorno, invulnerabilidade, zebras, particulas, HUD e resultado');
