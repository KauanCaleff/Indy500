// Teclas que estao sendo apertadas
const teclas = {};
const DURACAO_CORRIDA = 60;
const LARGURA_PISTA = 108;
const LARGURA_ZEBRA = 8;
const RAIO_PNEU = 4;
const VELOCIDADE_MAXIMA = 8;
const VIDAS_INICIAIS = 3;
const DURACAO_EXPLOSAO = 3; // Segundos parado antes de retornar.
const INVULNERABILIDADE = 1;
const LIMITE_PARTICULAS = 160;
const MEIO_COMPRIMENTO_CARRO = 15;
const MEIA_LARGURA_CARRO = 9;


// Todos os circuitos passam pela largada à esquerda, no sentido para baixo.
const MAPAS = {
  classico: {
    nome: 'Clássico', descricao: 'Duas curvas largas e um estreitamento no centro.',
    curvas: [
      // Parte superior central para o alto esquerdo
      [400, 170, 360, 120, 310, 70, 240, 70],

      // Alto esquerdo até a curva esquerda
      [240, 70, 140, 70, 70, 140, 80, 250],

      // Curva esquerda até a parte inferior esquerda
      [80, 250, 70, 360, 140, 430, 240, 430],

      // Inferior esquerdo até o centro inferior
      [240, 430, 310, 430, 360, 380, 400, 330],

      // Centro inferior até o inferior direito
      [400, 330, 440, 380, 490, 430, 560, 430],

      // Inferior direito até a curva direita
      [560, 430, 660, 430, 730, 360, 720, 250],

      // Curva direita até a parte superior direita
      [720, 250, 730, 140, 660, 70, 560, 70],

      // Superior direito até o centro superior
      [560, 70, 490, 70, 440, 120, 400, 170]
    ],
    checkpoints: [[400, 330], [720, 250], [400, 170]]
  },
  oval: {
    nome: 'Oval', descricao: 'Curvas abertas para manter a velocidade.',
    curvas: [
      [80,250,80,350,220,410,400,410],
      [400,410,580,410,720,350,720,250],
      [720,250,720,150,580,90,400,90],
      [400,90,220,90,80,150,80,250]
    ],
    checkpoints: [[400,410], [720,250], [400,90]]
  },
  retangular: {
    nome: 'Retangular', descricao: 'Retas longas e quatro curvas fechadas.',
    curvas: [
      [80,250,80,280,80,320,80,350],
      [80,350,80,395,105,420,150,420],
      [150,420,300,420,500,420,650,420],
      [650,420,695,420,720,395,720,350],
      [720,350,720,280,720,220,720,150],
      [720,150,720,105,695,80,650,80],
      [650,80,500,80,300,80,150,80],
      [150,80,105,80,80,105,80,150],
      [80,150,80,180,80,220,80,250]
    ],
    checkpoints: [[400,420], [720,250], [400,80]]
  },
  triangular: {
    nome: 'Triangular', descricao: 'Três pontas arredondadas e uma grande diagonal.',
    curvas: [
      [80,250,80,290,80,330,80,360],
      [80,360,80,400,110,420,160,420],
      [160,420,310,420,500,420,650,420],
      [650,420,710,420,725,390,675,360],
      [675,360,520,280,320,170,170,90],
      [170,90,115,60,80,80,80,140],
      [80,140,80,175,80,215,80,250]
    ],
    checkpoints: [[400,420], [675,360], [170,90]]
  }
};

class ObjetoJogo {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  distancia(outro) {
    return Math.hypot(this.x - outro.x, this.y - outro.y);
  }
}

class ParticulaFumaca extends ObjetoJogo {
  constructor(x, y, cor) {
    super(x, y);
    this.cor = cor;
    this.tamanho = 3;
    this.duracao = 0.9;
    this.tempo = 0;
    this.velocidadeX = (Math.random() - 0.5) * 12;
    this.velocidadeY = -12 - Math.random() * 8;
  }

  atualizar(delta) {
    this.tempo += delta;
    this.x += this.velocidadeX * delta;
    this.y += this.velocidadeY * delta;
    this.tamanho += 7 * delta;
  }

  desenhar(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - this.tempo / this.duracao) * 0.65;
    ctx.fillStyle = this.cor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.tamanho, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class Carro extends ObjetoJogo {
  constructor(x, y, cor, numero, controles) {
    super(x, y);
    this.xInicial = x;
    this.yInicial = y;
    this.cor = cor;
    this.numero = numero;
    this.controles = controles;
    this.reiniciar();
  }

  reiniciar() {
    this.x = this.xInicial;
    this.y = this.yInicial;
    this.angulo = Math.PI / 2;
    this.velocidade = 0;
    this.voltas = 0;
    this.checkpoint = 0;
    this.saiuDaLargada = false;
    this.reiniciarDano();
  }

  reiniciarDano() {
    this.vidas = VIDAS_INICIAIS;
    this.emContatoComBarreira = false;
    this.podeSofrerDano = true;
    this.tempoInvulneravel = 0;
    this.estadoDano = 'normal';
    this.explodido = false;
    this.tempoExplosao = 0;
    this.piscando = false;
    this.tempoFumaca = 0;
    this.particulas = [];
    this.limparZebra();
  }

  limparZebra() {
    this.estaNaZebra = false;
    this.velocidadeAntesDaZebra = 0;
    this.recuperarVelocidadeZebra = false;
  }

  verificarZebra(jogo) {
    const trecho = jogo.encontrarTrechoMaisProximo(this.x, this.y);
    const alcance = jogo.alcanceCarro(this, trecho.normal);
    const naZebra = trecho.distancia + alcance >= LARGURA_PISTA / 2;
    if (naZebra && !this.estaNaZebra) {
      this.velocidadeAntesDaZebra = this.velocidade;
      this.velocidade *= 0.75;
      this.recuperarVelocidadeZebra = true;
    } else if (!naZebra && this.estaNaZebra) {
      if (this.recuperarVelocidadeZebra) {
        this.velocidade = Math.max(-VELOCIDADE_MAXIMA,
          Math.min(VELOCIDADE_MAXIMA, this.velocidadeAntesDaZebra));
      }
      this.limparZebra();
    }
    this.estaNaZebra = naZebra;
  }

  receberDano(velocidadeImpacto) {
    if (!this.podeSofrerDano || this.emContatoComBarreira || this.explodido ||
        velocidadeImpacto < VELOCIDADE_MAXIMA * 2 / 3) return;
    this.vidas--;
    this.audio?.somDano();
    this.tempoInvulneravel = INVULNERABILIDADE;
    this.podeSofrerDano = false;
    this.estadoDano = this.vidas === 2 ? 'branca' : 'preta';
    if (this.vidas === 0) this.explodir();
  }

  explodir() {
    if (this.explodido) return;
    this.explodido = true;
    this.audio?.somExplosao(this);
    this.estadoDano = 'explodido';
    this.tempoExplosao = 0;
    this.velocidade = 0;
    this.particulas = [];
    this.limparZebra();
  }

  atualizarDano(delta) {
    this.tempoInvulneravel = Math.max(0, this.tempoInvulneravel - delta);
    this.podeSofrerDano = this.tempoInvulneravel === 0 && !this.explodido;
    if (this.explodido) {
      this.tempoExplosao += delta;
      this.piscando = Math.floor(this.tempoExplosao * 10) % 2 === 0;
      if (this.tempoExplosao >= DURACAO_EXPLOSAO) {
        // Mantem as voltas completas; recomeca o percurso para nao contar atalhos.
        this.x = this.xInicial;
        this.y = this.yInicial;
        this.angulo = Math.PI / 2;
        this.velocidade = 0;
        this.checkpoint = 0;
        this.saiuDaLargada = false;
        this.reiniciarDano();
        this.tempoInvulneravel = INVULNERABILIDADE;
        this.podeSofrerDano = false;
      }
    } else {
      this.piscando = this.tempoInvulneravel > 0 &&
        Math.floor(this.tempoInvulneravel * 10) % 2 === 0;
    }
  }

  atualizarFumaca(delta) {
    for (const particula of this.particulas) particula.atualizar(delta);
    this.particulas = this.particulas.filter(p => p.tempo < p.duracao);
    if (this.explodido || this.estadoDano === 'normal') return;
    this.tempoFumaca += delta;
    if (this.tempoFumaca >= 0.06 && this.particulas.length < LIMITE_PARTICULAS / 2) {
      this.tempoFumaca = 0;
      this.particulas.push(new ParticulaFumaca(
        this.x - Math.cos(this.angulo) * 12,
        this.y - Math.sin(this.angulo) * 12,
        this.estadoDano === 'branca' ? '#f5f5f5' : '#252525'));
    }
  }

  mover(jogo, delta = 1 / 60) {
    const estavaExplodido = this.explodido;
    this.atualizarDano(delta);
    this.atualizarFumaca(delta);
    if (estavaExplodido) return;
    const fator = Math.min(delta, 0.05) * 60;
    let velocidadeBase = this.estaNaZebra ? this.velocidadeAntesDaZebra : this.velocidade;
    if (teclas[this.controles.acelerar]) velocidadeBase += 0.12 * fator;
    if (teclas[this.controles.frear]) {
      velocidadeBase -= 0.12 * fator;
      this.recuperarVelocidadeZebra = false;
    }
    velocidadeBase *= Math.pow(0.99, fator);
    velocidadeBase = Math.max(-VELOCIDADE_MAXIMA, Math.min(VELOCIDADE_MAXIMA, velocidadeBase));
    if (this.estaNaZebra) this.velocidadeAntesDaZebra = velocidadeBase;
    this.velocidade = velocidadeBase * (this.estaNaZebra ? 0.75 : 1);
    if (teclas[this.controles.esquerda]) this.angulo -= 0.045 * fator;
    if (teclas[this.controles.direita]) this.angulo += 0.045 * fator;

    const yAntigo = this.y;
    // Passos curtos impedem atravessar paredes mesmo em curvas e frames lentos.
    const passos = Math.max(1, Math.ceil(Math.abs(this.velocidade) * fator / 2));
    for (let i = 0; i < passos && !this.explodido; i++) {
      this.x += Math.cos(this.angulo) * this.velocidade * fator / passos;
      this.y += Math.sin(this.angulo) * this.velocidade * fator / passos;
      jogo.resolverColisaoBarreira(this);
    }
    if (this.explodido) return;
    this.verificarZebra(jogo);
    this.verificarVolta(jogo, yAntigo);
  }

  verificarVolta(jogo, yAntigo) {
    if (this.distancia({x: this.xInicial, y: this.yInicial}) > 80) {
      this.saiuDaLargada = true;
    }
    if (this.saiuDaLargada && this.checkpoint < jogo.checkpoints.length &&
        jogo.noCheckpoint(this, this.checkpoint + 1)) this.checkpoint++;
    if (this.saiuDaLargada && this.checkpoint === jogo.checkpoints.length &&
        Math.abs(this.x - jogo.largadaX) < LARGURA_PISTA / 2 &&
        yAntigo < jogo.linhaChegadaY && this.y >= jogo.linhaChegadaY) {
      this.voltas++;
      this.audio?.somVolta(this);
      this.checkpoint = 0;
    }
  }

  desenharExplosao(ctx) {
    if (!this.explodido || this.tempoExplosao > 0.65) return;
    const progresso = this.tempoExplosao / 0.65;
    ctx.save();
    ctx.globalAlpha = 1 - progresso;
    for (const [cor, escala] of [['#f44320', 1], ['#ffb300', 0.7], ['#fff176', 0.4]]) {
      ctx.fillStyle = cor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, (10 + progresso * 38) * escala, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffb300';
    for (let i = 0; i < 12; i++) {
      const angulo = i * Math.PI / 6;
      const raio = 12 + progresso * 60;
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(angulo) * raio, this.y + Math.sin(angulo) * raio,
        3 * (1 - progresso), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  desenhar(ctx) {
    if (this.piscando) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angulo);
    ctx.fillStyle = this.cor;
    ctx.fillRect(-15, -9, 30, 18);
    ctx.fillStyle = '#d8edf2';
    ctx.fillRect(-5, -7, 9, 14);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.numero, 9, 0);
    ctx.fillStyle = 'yellow';
    ctx.beginPath();
    ctx.arc(14, -4, 4, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(14, 4, 4, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.restore();
  }
}

class Jogo {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.larguraPista = LARGURA_PISTA;
    this.largadaX = 80;
    this.ultimoFrame = performance.now();
    this.linhaChegadaY = 250;
    this.audio = new SistemaAudio();
    this.emContatoEntreCarros = false;


    this.jogadores = [
      new Carro(
        65,
        210,
        '#ff3b30',
        '1',
        {
          acelerar: 'KeyW',
          frear: 'KeyS',
          esquerda: 'KeyA',
          direita: 'KeyD'
        }
      ),

      new Carro(
        95,
        210,
        '#29a9ff',
        '2',
        {
          acelerar: 'ArrowUp',
          frear: 'ArrowDown',
          esquerda: 'ArrowLeft',
          direita: 'ArrowRight'
        }
      )
    ];

    for (const carro of this.jogadores) carro.audio = this.audio;
    this.configurarAudio();
    this.rodando = false;
    this.overlay = document.getElementById('gameOverlay');
    this.overlayKicker = document.getElementById('overlayKicker');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayText = document.getElementById('overlayText');
    this.voltasTexto = this.jogadores.map((carro) =>
      document.getElementById(`lap${carro.numero}`));
    this.vidasTexto = this.jogadores.map(carro => document.getElementById(`lives${carro.numero}`));
    this.timerTexto = document.getElementById('timer');
    this.tempoInicio = 0;
    this.tempoRestante = DURACAO_CORRIDA;
    this.seletorMapa = document.getElementById('mapSelect');
    for (const [id, mapa] of Object.entries(MAPAS)) {
      const opcao = document.createElement('option');
      opcao.value = id;
      opcao.textContent = mapa.nome;
      this.seletorMapa.append(opcao);
    }
    this.seletorMapa.addEventListener('change', () => this.selecionarMapa());
    this.seletorMapa.value = 'classico';
    this.selecionarMapa();
    this.atualizar();
  }

  configurarAudio() {
    this.botaoSom = document.getElementById('soundButton');
    this.controleVolume = document.getElementById('soundVolume');
    this.textoVolume = document.getElementById('soundVolumeValue');
    this.botaoSom.addEventListener('click', () => {
      this.audio.definirAtivado(!this.audio.ativado);
      this.mostrarAudio();
    });
    this.controleVolume.addEventListener('input', () => {
      this.audio.definirVolume(Number(this.controleVolume.value) / 100);
      this.mostrarAudio();
    });
    this.mostrarAudio();
  }

  mostrarAudio() {
    this.botaoSom.textContent = this.audio.disponivel
      ? `Som: ${this.audio.ativado ? 'ligado' : 'desligado'}` : 'Som indisponível';
    this.botaoSom.ariaPressed = String(this.audio.ativado && this.audio.disponivel);
    this.botaoSom.disabled = !this.audio.disponivel;
    this.controleVolume.disabled = !this.audio.disponivel;
    this.controleVolume.value = Math.round(this.audio.volume * 100);
    this.textoVolume.textContent = `${this.controleVolume.value}%`;
  }

  selecionarMapa() {
    if (this.rodando) return;
    this.audio.limparCorrida();
    this.emContatoEntreCarros = false;
    const mapa = MAPAS[this.seletorMapa.value];
    this.curvas = mapa.curvas;
    this.checkpoints = mapa.checkpoints.map(([x, y]) => ({x, y}));
    this.pontosPista = [];
    this.criarPontosPista();
    this.criarBordas();
    for (const carro of this.jogadores) carro.reiniciar();
    this.tempoRestante = DURACAO_CORRIDA;
    this.mostrarVoltas();
    this.mostrarVidas();
    this.mostrarTempo();
    this.overlayKicker.textContent = 'INDY 500';
    this.overlayTitle.textContent = mapa.nome;
    this.overlayText.textContent = 'Faça mais voltas que o rival em 60 segundos.';
    document.getElementById('mapDescription').textContent = mapa.descricao;
    this.desenhar();
  }

  criarPontosPista() {
    // Cada curva e dividida em pontos para desenhar e medir a pista
    for (const c of this.curvas) {
      for (let passo = 0; passo < 60; passo++) {
        let t = passo / 60;
        let outroT = 1 - t;
        let x = outroT * outroT * outroT * c[0] + 3 * outroT * outroT * t * c[2] + 3 * outroT * t * t * c[4] + t * t * t * c[6];
        let y = outroT * outroT * outroT * c[1] + 3 * outroT * outroT * t * c[3] + 3 * outroT * t * t * c[5] + t * t * t * c[7];
        this.pontosPista.push({x, y});
      }
    }
  }

  encontrarTrechoMaisProximo(x, y) {
    let melhor = {distancia: Infinity};
    for (let i = 0; i < this.pontosPista.length; i++) {
      const a = this.pontosPista[i];
      const b = this.pontosPista[(i + 1) % this.pontosPista.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const tamanho = Math.hypot(dx, dy);
      if (tamanho < 0.0001) continue;
      const parte = Math.max(0, Math.min(1,
        ((x - a.x) * dx + (y - a.y) * dy) / (tamanho * tamanho)));
      const ponto = {x: a.x + parte * dx, y: a.y + parte * dy};
      const distancia = Math.hypot(x - ponto.x, y - ponto.y);
      if (distancia < melhor.distancia) {
        const tangente = {x: dx / tamanho, y: dy / tamanho};
        const normal = distancia > 0.0001
          ? {x: (x - ponto.x) / distancia, y: (y - ponto.y) / distancia}
          : {x: -tangente.y, y: tangente.x};
        melhor = {ponto, distancia, tangente, normal};
      }
    }
    return melhor;
  }

  distanciaAtePista(x, y) {
    return this.encontrarTrechoMaisProximo(x, y).distancia;
  }

  naPista(x, y) {
    return this.distanciaAtePista(x, y) < LARGURA_PISTA / 2;
  }

  alcanceCarro(carro, normal) {
    const cos = Math.cos(carro.angulo);
    const sen = Math.sin(carro.angulo);
    return Math.abs(cos * normal.x + sen * normal.y) * MEIO_COMPRIMENTO_CARRO +
      Math.abs(-sen * normal.x + cos * normal.y) * MEIA_LARGURA_CARRO;
  }

  resolverColisaoBarreira(carro, aplicarDano = true) {
    if (carro.explodido) return;
    let trecho = this.encontrarTrechoMaisProximo(carro.x, carro.y);
    let limite = LARGURA_PISTA / 2 + LARGURA_ZEBRA - this.alcanceCarro(carro, trecho.normal);
    if (trecho.distancia < limite - 2) carro.emContatoComBarreira = false;
    if (trecho.distancia <= limite) return;

    const velocidadeImpacto = Math.abs(carro.velocidade);
    const vx = Math.cos(carro.angulo) * carro.velocidade;
    const vy = Math.sin(carro.angulo) * carro.velocidade;
    const contraParede = vx * trecho.normal.x + vy * trecho.normal.y;
    if (contraParede > 0.001) {
      if (aplicarDano && !carro.emContatoComBarreira) {
        this.audio.somBatidaBarreira(velocidadeImpacto, contraParede);
      }
      if (aplicarDano) carro.receberDano(velocidadeImpacto);
      if (!carro.explodido) {
        // Remove a componente normal; conserva 98% da componente paralela.
        const paraleloX = (vx - contraParede * trecho.normal.x) * 0.98;
        const paraleloY = (vy - contraParede * trecho.normal.y) * 0.98;
        const sentido = Math.sign(carro.velocidade) || 1;
        carro.velocidade = Math.hypot(paraleloX, paraleloY) * sentido;
        if (Math.abs(carro.velocidade) < 0.05) carro.velocidade = 0;
        else carro.angulo = Math.atan2(paraleloY * sentido, paraleloX * sentido);
        carro.recuperarVelocidadeZebra = false;
        if (carro.estaNaZebra) carro.velocidadeAntesDaZebra = carro.velocidade / 0.75;
      }
    }
    carro.emContatoComBarreira = true;
    // Recalcula o alcance porque a orientacao pode ter mudado no impacto.
    for (let i = 0; i < 4; i++) {
      trecho = this.encontrarTrechoMaisProximo(carro.x, carro.y);
      limite = LARGURA_PISTA / 2 + LARGURA_ZEBRA - this.alcanceCarro(carro, trecho.normal);
      if (trecho.distancia <= limite - 0.1) break;
      carro.x = trecho.ponto.x + trecho.normal.x * (limite - 0.2);
      carro.y = trecho.ponto.y + trecho.normal.y * (limite - 0.2);
    }
  }

  noCheckpoint(carro, numero) {
    let ponto = this.checkpoints[numero - 1];
    return carro.distancia(ponto) < 55;
  }

  iniciar() {
    for (const carro of this.jogadores) carro.reiniciar();
    this.emContatoEntreCarros = false;
    this.audio.iniciarCorrida(this.jogadores);
    this.mostrarAudio();
    this.rodando = true;
    this.seletorMapa.disabled = true;
    this.tempoInicio = performance.now();
    this.ultimoFrame = this.tempoInicio;
    this.tempoRestante = DURACAO_CORRIDA;
    this.overlay.classList.add('hidden');
    document.getElementById('startButton').textContent = 'CORRER NOVAMENTE';
    this.mostrarVoltas();
    this.mostrarVidas();
    this.mostrarTempo();
  }

  terminar() {
    if (!this.rodando) return;
    this.rodando = false;
    this.seletorMapa.disabled = false;
    this.overlay.classList.remove('hidden');
    this.overlayKicker.textContent = 'BANDEIRA QUADRICULADA';
    const [carro1, carro2] = this.jogadores;
    const vencedor = carro1.voltas > carro2.voltas ? carro1 : carro2;
    this.audio.terminarCorrida(carro1.voltas === carro2.voltas, vencedor);
    this.overlayTitle.textContent = carro1.voltas === carro2.voltas
      ? 'Empate!'
      : `Jogador ${vencedor.numero} venceu!`;
    this.overlayText.textContent = `Placar final: ${carro1.voltas} x ${carro2.voltas} voltas`;
  }

  mostrarVoltas() {
    this.jogadores.forEach((carro, indice) => {
      this.voltasTexto[indice].textContent = `${carro.voltas} voltas`;
    });
  }

  mostrarTempo() {
    this.timerTexto.textContent = `Tempo: ${Math.ceil(this.tempoRestante)}s`;
  }

  mostrarVidas() {
    this.jogadores.forEach((carro, indice) => {
      this.vidasTexto[indice].textContent = carro.explodido
        ? '0 vidas - retorno' : `${carro.vidas} vidas`;
    });
  }

  tracarPista() {
    const ctx = this.ctx;
    ctx.beginPath();
    this.pontosPista.forEach((ponto, indice) => {
      if (indice === 0) ctx.moveTo(ponto.x, ponto.y);
      else ctx.lineTo(ponto.x, ponto.y);
    });
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  }

  criarBordas() {
    // Normais suavizadas unem as faixas sem deixar frestas entre os trechos.
    this.bordas = this.pontosPista.map((ponto, indice, pontos) => {
      const antes = pontos[(indice + pontos.length - 1) % pontos.length];
      const depois = pontos[(indice + 1) % pontos.length];
      const dx = depois.x - antes.x;
      const dy = depois.y - antes.y;
      const tamanho = Math.hypot(dx, dy) || 1;
      return {ponto, normal: {x: -dy / tamanho, y: dx / tamanho}};
    });
    // Os pneus sao apenas coordenadas estaticas, nao objetos com fisica propria.
    this.pneus = [];
    this.cantos = [];
    // Nas quinas, completa o arco externo que une as normais dos dois trechos.
    this.pontosPista.forEach((ponto, i, pontos) => {
      const antes = pontos[(i + pontos.length - 1) % pontos.length];
      const depois = pontos[(i + 1) % pontos.length];
      const entrada = Math.atan2(ponto.y - antes.y, ponto.x - antes.x);
      const saida = Math.atan2(depois.y - ponto.y, depois.x - ponto.x);
      const giro = Math.atan2(Math.sin(saida - entrada), Math.cos(saida - entrada));
      if (Math.abs(giro) < 0.12) return;
      const normalExterna = entrada - Math.sign(giro) * Math.PI / 2;
      this.cantos.push({ponto, angulo: normalExterna, giro});
    });
    let restante = 0;
    for (let i = 0; i < this.bordas.length; i++) {
      const a = this.bordas[i];
      const b = this.bordas[(i + 1) % this.bordas.length];
      const tamanho = Math.hypot(b.ponto.x - a.ponto.x, b.ponto.y - a.ponto.y);
      while (restante < tamanho) {
        const t = restante / tamanho;
        const nx = a.normal.x * (1 - t) + b.normal.x * t;
        const ny = a.normal.y * (1 - t) + b.normal.y * t;
        for (const lado of [-1, 1]) {
          const distancia = (LARGURA_PISTA / 2 + LARGURA_ZEBRA + RAIO_PNEU) * lado;
          const x = a.ponto.x + (b.ponto.x - a.ponto.x) * t + nx * distancia;
          const y = a.ponto.y + (b.ponto.y - a.ponto.y) * t + ny * distancia;
          // Nao desenha pneus que invadam outro trecho nas pontas estreitas.
          if (this.distanciaAtePista(x, y) >= LARGURA_PISTA / 2 + LARGURA_ZEBRA + RAIO_PNEU - 1) {
            this.pneus.push({x, y});
          }
        }
        restante += RAIO_PNEU * 1.9;
      }
      restante -= tamanho;
    }
    const raio = LARGURA_PISTA / 2 + LARGURA_ZEBRA + RAIO_PNEU;
    for (const canto of this.cantos) {
      const passos = Math.ceil(Math.abs(canto.giro) * raio / (RAIO_PNEU * 1.9));
      for (let i = 0; i <= passos; i++) {
        const angulo = canto.angulo + canto.giro * i / passos;
        const x = canto.ponto.x + Math.cos(angulo) * raio;
        const y = canto.ponto.y + Math.sin(angulo) * raio;
        if (this.distanciaAtePista(x, y) >= raio - 1 &&
            !this.pneus.some(p => Math.hypot(p.x - x, p.y - y) < RAIO_PNEU * 1.5)) {
          this.pneus.push({x, y});
        }
      }
    }
  }

  desenharZebras() {
    const ctx = this.ctx;
    let distancia = 0;
    for (let i = 0; i < this.bordas.length; i++) {
      const a = this.bordas[i];
      const b = this.bordas[(i + 1) % this.bordas.length];
      ctx.fillStyle = Math.floor(distancia / 18) % 2 === 0 ? '#e53935' : '#fff';
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.8;
      for (const lado of [-1, 1]) {
        ctx.beginPath();
        for (const [borda, afastamento] of [[a, 0], [b, 0], [b, LARGURA_ZEBRA], [a, LARGURA_ZEBRA]]) {
          const offset = (LARGURA_PISTA / 2 + afastamento) * lado;
          const x = borda.ponto.x + borda.normal.x * offset;
          const y = borda.ponto.y + borda.normal.y * offset;
          if (borda === a && afastamento === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      distancia += Math.hypot(b.ponto.x - a.ponto.x, b.ponto.y - a.ponto.y);
    }
    for (const canto of this.cantos) {
      const raio = LARGURA_PISTA / 2 + LARGURA_ZEBRA / 2;
      const faixas = Math.max(1, Math.ceil(Math.abs(canto.giro) * raio / 18));
      ctx.lineWidth = LARGURA_ZEBRA;
      ctx.lineCap = 'butt';
      for (let i = 0; i < faixas; i++) {
        const a = canto.angulo + canto.giro * i / faixas;
        const b = canto.angulo + canto.giro * (i + 1) / faixas;
        ctx.strokeStyle = i % 2 === 0 ? '#e53935' : '#fff';
        ctx.beginPath();
        ctx.arc(canto.ponto.x, canto.ponto.y, raio, a, b, canto.giro < 0);
        ctx.stroke();
      }
    }
  }

  desenharBarreiras() {
    const ctx = this.ctx;
    for (const pneu of this.pneus) {
      ctx.fillStyle = '#17191c';
      ctx.beginPath();
      ctx.arc(pneu.x, pneu.y, RAIO_PNEU, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#555b60';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pneu.x, pneu.y, RAIO_PNEU * 0.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  desenharPista() {
    const ctx = this.ctx;
    this.tracarPista();
    ctx.strokeStyle = '#24282a';
    ctx.lineWidth = LARGURA_PISTA + 2 * (LARGURA_ZEBRA + RAIO_PNEU);
    ctx.stroke();
    this.desenharZebras();
    this.tracarPista();
    ctx.strokeStyle = '#707579';
    ctx.lineWidth = LARGURA_PISTA;
    ctx.stroke();
    // Pneus ficam por fora das zebras e nao invadem o asfalto.
    this.desenharBarreiras();
    this.tracarPista();
    ctx.strokeStyle = '#f2e9c9';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 18]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(this.largadaX - LARGURA_PISTA / 2, this.linhaChegadaY);
    ctx.lineTo(this.largadaX + LARGURA_PISTA / 2, this.linhaChegadaY);
    ctx.stroke();
  }

  desenhar() {
    let ctx = this.ctx;
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, 800, 500);
    this.desenharPista();

    for (const carro of this.jogadores) {
      for (const particula of carro.particulas) particula.desenhar(ctx);
    }
    for (const carro of this.jogadores) carro.desenhar(ctx);
    for (const carro of this.jogadores) carro.desenharExplosao(ctx);
  }

  atualizar() {
    const agora = performance.now();
    const delta = Math.max(0, (agora - this.ultimoFrame) / 1000);
    this.ultimoFrame = agora;
    if (this.rodando) {
      this.tempoRestante = DURACAO_CORRIDA - (performance.now() - this.tempoInicio) / 1000;
      if (this.tempoRestante <= 0) {
        this.tempoRestante = 0;
        this.mostrarTempo();
        this.terminar();
      }

      if (this.rodando) {
        for (const carro of this.jogadores) carro.mover(this, delta);

        const [carro1, carro2] = this.jogadores;
        if (carro1.distancia(carro2) > 24 || carro1.explodido || carro2.explodido) {
          this.emContatoEntreCarros = false;
        }
        if (!carro1.explodido && !carro2.explodido && carro1.distancia(carro2) < 22) {
          if (!this.emContatoEntreCarros) {
            const relativoX = Math.cos(carro1.angulo) * carro1.velocidade - Math.cos(carro2.angulo) * carro2.velocidade;
            const relativoY = Math.sin(carro1.angulo) * carro1.velocidade - Math.sin(carro2.angulo) * carro2.velocidade;
            this.audio.somBatidaCarros(Math.hypot(relativoX, relativoY));
          }
          this.emContatoEntreCarros = true;
          const distancia = carro1.distancia(carro2);
          const nx = distancia > 0 ? (carro2.x - carro1.x) / distancia : 1;
          const ny = distancia > 0 ? (carro2.y - carro1.y) / distancia : 0;
          const empurrao = (22 - distancia) / 2;
          carro1.x -= nx * empurrao;
          carro1.y -= ny * empurrao;
          carro2.x += nx * empurrao;
          carro2.y += ny * empurrao;
          this.resolverColisaoBarreira(carro1, false);
          this.resolverColisaoBarreira(carro2, false);
        }
        for (const carro of this.jogadores) this.audio.atualizarMotor(carro);
        this.mostrarVoltas();
        this.mostrarVidas();
        this.mostrarTempo();
      }
    }
    this.desenhar();
    requestAnimationFrame(() => this.atualizar());
  }
}

document.addEventListener('keydown', function(evento) {
  if (['INPUT', 'SELECT'].includes(evento.target?.tagName)) return;
  teclas[evento.code] = true;
  if (jogo.rodando && evento.code.startsWith('Arrow')) evento.preventDefault();
});

document.addEventListener('keyup', function(evento) {
  teclas[evento.code] = false;
});

const jogo = new Jogo();
document.getElementById('startButton').addEventListener('click', function() {
  jogo.iniciar();
});

window.addEventListener('blur', () => {
  for (const codigo of Object.keys(teclas)) teclas[codigo] = false;
});

window.addEventListener('pagehide', () => jogo.audio.limparCorrida());
