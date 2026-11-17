// Teclas que estao sendo apertadas
const teclas = {};
const DURACAO_CORRIDA = 60;


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
  }

  mover(jogo) {
    if (teclas[this.controles.acelerar]) this.velocidade += 0.12;
    if (teclas[this.controles.frear]) this.velocidade -= 0.12;
    this.velocidade *= 0.99;

    if (teclas[this.controles.esquerda]) this.angulo -= 0.045;
    if (teclas[this.controles.direita]) this.angulo += 0.045;

    let yAntigo = this.y;
    this.x += Math.cos(this.angulo) * this.velocidade;
    this.y += Math.sin(this.angulo) * this.velocidade;

    if (!jogo.naPista(this.x, this.y)) {
      this.velocidade *= 0.78;
    }

    if (this.distancia({x: this.xInicial, y: this.yInicial}) > 80) {
      this.saiuDaLargada = true;
    }

    // Os pontos precisam ser visitados na ordem certa.
    if (this.saiuDaLargada && this.checkpoint < jogo.checkpoints.length &&
        jogo.noCheckpoint(this, this.checkpoint + 1)) {
      this.checkpoint++;
    }

    // A linha conta somente quando o carro passa para baixo dela
    if (this.saiuDaLargada && this.checkpoint === jogo.checkpoints.length && this.x > 45 && this.x < 135 && yAntigo < jogo.linhaChegadaY && this.y >= jogo.linhaChegadaY) {
      this.voltas++;
      this.checkpoint = 0;
    }
  }

  desenhar(ctx) {
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
    this.larguraPista = 86;
    this.linhaChegadaY = 250;


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

    this.rodando = false;
    this.overlay = document.getElementById('gameOverlay');
    this.overlayKicker = document.getElementById('overlayKicker');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlayText = document.getElementById('overlayText');
    this.voltasTexto = this.jogadores.map((carro) =>
      document.getElementById(`lap${carro.numero}`));
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

  selecionarMapa() {
    if (this.rodando) return;
    const mapa = MAPAS[this.seletorMapa.value];
    this.curvas = mapa.curvas;
    this.checkpoints = mapa.checkpoints.map(([x, y]) => ({x, y}));
    this.pontosPista = [];
    this.criarPontosPista();
    for (const carro of this.jogadores) carro.reiniciar();
    this.tempoRestante = DURACAO_CORRIDA;
    this.mostrarVoltas();
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
      for (let passo = 0; passo <= 35; passo++) {
        let t = passo / 35;
        let outroT = 1 - t;
        let x = outroT * outroT * outroT * c[0] + 3 * outroT * outroT * t * c[2] + 3 * outroT * t * t * c[4] + t * t * t * c[6];
        let y = outroT * outroT * outroT * c[1] + 3 * outroT * outroT * t * c[3] + 3 * outroT * t * t * c[5] + t * t * t * c[7];
        this.pontosPista.push({x, y});
      }
    }
  }

  distanciaAtePista(x, y) {
    let menorDistancia = Infinity;

    for (let i = 0; i < this.pontosPista.length; i++) {
      let a = this.pontosPista[i];
      let b = this.pontosPista[(i + 1) % this.pontosPista.length];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let tamanho = dx * dx + dy * dy;
      let parte = ((x - a.x) * dx + (y - a.y) * dy) / (tamanho || 1);
      parte = Math.max(0, Math.min(1, parte));
      let pertoX = a.x + parte * dx;
      let pertoY = a.y + parte * dy;
      let distancia = Math.hypot(x - pertoX, y - pertoY);
      menorDistancia = Math.min(menorDistancia, distancia);
    }
    return menorDistancia;
  }

  naPista(x, y) {
    return this.distanciaAtePista(x, y) < this.larguraPista / 2;
  }

  noCheckpoint(carro, numero) {
    let ponto = this.checkpoints[numero - 1];
    return carro.distancia(ponto) < 55;
  }

  iniciar() {
    for (const carro of this.jogadores) carro.reiniciar();
    this.rodando = true;
    this.seletorMapa.disabled = true;
    this.tempoInicio = performance.now();
    this.tempoRestante = DURACAO_CORRIDA;
    this.overlay.classList.add('hidden');
    document.getElementById('startButton').textContent = 'CORRER NOVAMENTE';
    this.mostrarVoltas();
    this.mostrarTempo();
  }

  terminar() {
    this.rodando = false;
    this.seletorMapa.disabled = false;
    this.overlay.classList.remove('hidden');
    this.overlayKicker.textContent = 'BANDEIRA QUADRICULADA';
    const [carro1, carro2] = this.jogadores;
    const vencedor = carro1.voltas > carro2.voltas ? carro1 : carro2;
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

  desenharPista() {
    let ctx = this.ctx;
    let primeiro = this.pontosPista[0];

    ctx.beginPath();
    ctx.moveTo(primeiro.x, primeiro.y);
    for (let i = 1; i < this.pontosPista.length; i++) {
      ctx.lineTo(this.pontosPista[i].x, this.pontosPista[i].y);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // O mesmo caminho recebe a borda, o asfalto e a faixa do meio
    ctx.strokeStyle = 'black';
    ctx.lineWidth = this.larguraPista;
    ctx.stroke();
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = this.larguraPista - 8;
    ctx.stroke();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 18]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Linha de largada e chegada; os checkpoints nao aparecem na tela
    ctx.strokeStyle = 'yellow';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(45, this.linhaChegadaY);
    ctx.lineTo(135, this.linhaChegadaY);
    ctx.stroke();
  }

  desenhar() {
    let ctx = this.ctx;
    ctx.fillStyle = 'green';
    ctx.fillRect(0, 0, 800, 500);
    this.desenharPista();

    for (const carro of this.jogadores) carro.desenhar(ctx);
  }

  atualizar() {
    if (this.rodando) {
      this.tempoRestante = DURACAO_CORRIDA - (performance.now() - this.tempoInicio) / 1000;
      if (this.tempoRestante <= 0) {
        this.tempoRestante = 0;
        this.mostrarTempo();
        this.terminar();
      }

      if (this.rodando) {
        for (const carro of this.jogadores) carro.mover(this);

        const [carro1, carro2] = this.jogadores;
        if (carro1.distancia(carro2) < 22) {
          carro1.x -= 1;
          carro2.x += 1;
        }
        this.mostrarVoltas();
        this.mostrarTempo();
      }
    }
    this.desenhar();
    requestAnimationFrame(() => this.atualizar());
  }
}

document.addEventListener('keydown', function(evento) {
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
