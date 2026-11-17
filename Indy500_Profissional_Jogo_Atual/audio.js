// Sons sintetizados: nenhuma midia, biblioteca ou requisicao externa.
const CONFIG_AUDIO = {
  volumeGeral: 0.28,
  motorParado: 60,
  motorMaximo: 200,
  diferencaMotor2: 10,
  volumeMotores: 0.22,
  volumeEfeitos: 0.65,
  volumeInterface: 0.45
};

class SistemaAudio {
  constructor() {
    this.contexto = null;
    this.disponivel = Boolean(window.AudioContext || window.webkitAudioContext);
    this.ativado = true;
    this.volume = CONFIG_AUDIO.volumeGeral;
    this.motores = new Map();
    this.efeitos = new Set();
    this.emCorrida = false;
    try {
      this.ativado = window.localStorage.getItem('somAtivado') !== 'false';
      const salvo = window.localStorage.getItem('volumeSom');
      if (salvo !== null && Number.isFinite(Number(salvo))) {
        this.volume = this.limitar(Number(salvo));
      }
    } catch {
      // Armazenamento pode estar bloqueado em arquivos locais.
    }
  }

  limitar(valor) {
    return Math.max(0, Math.min(1, valor));
  }

  iniciar() {
    if (!this.disponivel) return false;
    try {
      if (!this.contexto) {
        const AudioContexto = window.AudioContext || window.webkitAudioContext;
        this.contexto = new AudioContexto();
        this.principal = this.contexto.createGain();
        this.principal.gain.value = this.ativado ? this.volume : 0;
        this.compressor = this.contexto.createDynamicsCompressor();
        this.compressor.threshold.value = -12;
        this.compressor.knee.value = 12;
        this.compressor.ratio.value = 8;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;
        this.principal.connect(this.compressor);
        this.compressor.connect(this.contexto.destination);
        this.canalMotores = this.criarCanal(CONFIG_AUDIO.volumeMotores);
        this.canalEfeitos = this.criarCanal(CONFIG_AUDIO.volumeEfeitos);
        this.canalInterface = this.criarCanal(CONFIG_AUDIO.volumeInterface);
        this.ruido = this.contexto.createBuffer(1, this.contexto.sampleRate, this.contexto.sampleRate);
        const amostras = this.ruido.getChannelData(0);
        for (let i = 0; i < amostras.length; i++) amostras[i] = Math.random() * 2 - 1;
      }
      if (this.contexto.state === 'suspended') {
        // A chamada ocorre no clique; uma recusa do navegador nao afeta a corrida.
        this.contexto.resume().catch(() => {});
      }
      return this.contexto.state !== 'closed';
    } catch {
      this.disponivel = false;
      return false;
    }
  }

  criarCanal(volume) {
    const canal = this.contexto.createGain();
    canal.gain.value = this.limitar(volume);
    canal.connect(this.principal);
    return canal;
  }

  suavizar(parametro, valor, tempo = 0.04) {
    const agora = this.contexto.currentTime;
    parametro.cancelScheduledValues(agora);
    parametro.setTargetAtTime(valor, agora, tempo);
  }

  definirVolume(valor) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) return;
    this.volume = this.limitar(numero);
    if (this.principal) this.suavizar(this.principal.gain, this.ativado ? this.volume : 0);
    this.salvarPreferencias();
  }

  definirAtivado(ativado) {
    this.ativado = Boolean(ativado);
    if (!this.ativado) this.limparEfeitos();
    if (this.contexto && this.ativado) this.iniciar();
    if (this.principal) this.suavizar(this.principal.gain, this.ativado ? this.volume : 0, 0.015);
    this.salvarPreferencias();
  }

  salvarPreferencias() {
    try {
      window.localStorage.setItem('somAtivado', String(this.ativado));
      window.localStorage.setItem('volumeSom', String(this.volume));
    } catch {
      // Volume e mute continuam funcionando sem localStorage.
    }
  }

  criarSom({frequencia = 220, fim = frequencia, duracao = 0.12,
      volume = 0.25, atraso = 0, tipo = 'triangle', ruido = false,
      filtro = 900, interface: somInterface = false} = {}) {
    if (!this.contexto || !this.ativado || !this.disponivel) return;
    // Limita tambem a polifonia em eventos simultaneos dos dois jogadores.
    if (this.efeitos.size >= 48) return;
    const inicio = this.contexto.currentTime + atraso + 0.005;
    const ganho = this.contexto.createGain();
    ganho.gain.setValueAtTime(0, inicio);
    ganho.gain.linearRampToValueAtTime(this.limitar(volume), inicio + 0.008);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);
    ganho.gain.linearRampToValueAtTime(0, inicio + duracao + 0.01);
    ganho.connect(somInterface ? this.canalInterface : this.canalEfeitos);
    let fonte;
    const nos = [ganho];
    if (ruido) {
      fonte = this.contexto.createBufferSource();
      fonte.buffer = this.ruido;
      const passaBaixa = this.contexto.createBiquadFilter();
      passaBaixa.type = 'lowpass';
      passaBaixa.frequency.value = filtro;
      fonte.connect(passaBaixa);
      passaBaixa.connect(ganho);
      nos.push(passaBaixa);
    } else {
      fonte = this.contexto.createOscillator();
      fonte.type = tipo;
      fonte.frequency.setValueAtTime(frequencia, inicio);
      fonte.frequency.exponentialRampToValueAtTime(Math.max(1, fim), inicio + duracao);
      fonte.connect(ganho);
    }
    nos.push(fonte);
    const efeito = {fonte, ganho, nos};
    this.efeitos.add(efeito);
    fonte.onended = () => {
      for (const no of nos) no.disconnect();
      this.efeitos.delete(efeito);
    };
    fonte.start(inicio);
    fonte.stop(inicio + duracao + 0.02);
  }

  limparEfeitos() {
    if (!this.contexto) return;
    const agora = this.contexto.currentTime;
    for (const efeito of this.efeitos) {
      this.suavizar(efeito.ganho.gain, 0, 0.005);
      efeito.fonte.stop(agora + 0.025);
    }
    this.efeitos.clear();
  }

  criarMotor(carro, atraso = 0) {
    if (this.motores.has(carro.numero)) return;
    const ctx = this.contexto;
    const ganho = ctx.createGain();
    ganho.gain.value = 0;
    const corpo = ctx.createOscillator();
    corpo.type = 'sawtooth';
    const base = CONFIG_AUDIO.motorParado + (carro.numero === '2' ? CONFIG_AUDIO.diferencaMotor2 : 0);
    corpo.frequency.value = base;
    const textura = ctx.createOscillator();
    textura.type = 'triangle';
    textura.frequency.value = base / 2;
    const volumeTextura = ctx.createGain();
    volumeTextura.gain.value = 0.25;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 650;
    corpo.connect(filtro);
    textura.connect(volumeTextura);
    volumeTextura.connect(filtro);
    filtro.connect(ganho);
    const nos = [corpo, textura, volumeTextura, filtro, ganho];
    let saida = this.canalMotores;
    if (typeof ctx.createStereoPanner === 'function') {
      const panorama = ctx.createStereoPanner();
      panorama.pan.value = carro.numero === '1' ? -0.25 : 0.25;
      panorama.connect(saida);
      saida = panorama;
      nos.push(panorama);
    }
    ganho.connect(saida);

    // Ruido em loop, pulsado por um LFO: nenhum no novo por frame na zebra.
    const zebra = ctx.createBufferSource();
    zebra.buffer = this.ruido;
    zebra.loop = true;
    const filtroZebra = ctx.createBiquadFilter();
    filtroZebra.type = 'lowpass';
    filtroZebra.frequency.value = 700;
    const ganhoPulso = ctx.createGain();
    ganhoPulso.gain.value = 0.035;
    const pulso = ctx.createOscillator();
    pulso.type = 'square';
    pulso.frequency.value = 22;
    const modulacao = ctx.createGain();
    modulacao.gain.value = 0.03;
    pulso.connect(modulacao);
    modulacao.connect(ganhoPulso.gain);
    const ganhoZebra = ctx.createGain();
    ganhoZebra.gain.value = 0;
    zebra.connect(filtroZebra);
    filtroZebra.connect(ganhoPulso);
    ganhoPulso.connect(ganhoZebra);
    ganhoZebra.connect(saida);
    nos.push(zebra, filtroZebra, ganhoPulso, pulso, modulacao, ganhoZebra);
    const fontes = [corpo, textura, zebra, pulso];
    const motor = {corpo, textura, ganho, ganhoZebra, pulso, fontes, nos};
    this.motores.set(carro.numero, motor);
    for (const fonte of fontes) fonte.start(ctx.currentTime + atraso);
    this.atualizarMotor(carro);
  }

  atualizarMotor(carro) {
    const motor = this.motores.get(carro.numero);
    if (!motor || !this.emCorrida) return;
    const proporcao = this.limitar(Math.abs(carro.velocidade) / VELOCIDADE_MAXIMA);
    const diferenca = carro.numero === '2' ? CONFIG_AUDIO.diferencaMotor2 : 0;
    const frequencia = CONFIG_AUDIO.motorParado + diferenca +
      (CONFIG_AUDIO.motorMaximo - CONFIG_AUDIO.motorParado) * proporcao;
    this.suavizar(motor.corpo.frequency, frequencia);
    this.suavizar(motor.textura.frequency, frequencia / 2);
    this.suavizar(motor.ganho.gain, carro.explodido ? 0 : 0.10 + proporcao * 0.16,
      carro.explodido ? 0.005 : 0.04);
    this.suavizar(motor.ganhoZebra.gain,
      carro.estaNaZebra && !carro.explodido && proporcao > 0.01 ? 0.4 * proporcao : 0, 0.015);
    this.suavizar(motor.pulso.frequency, 15 + proporcao * 25);
  }

  pararMotores() {
    this.emCorrida = false;
    if (!this.contexto) return;
    const fim = this.contexto.currentTime + 0.12;
    for (const motor of this.motores.values()) {
      this.suavizar(motor.ganho.gain, 0, 0.02);
      this.suavizar(motor.ganhoZebra.gain, 0, 0.01);
      motor.corpo.onended = () => {
        for (const no of motor.nos) no.disconnect();
      };
      for (const fonte of motor.fontes) fonte.stop(fim);
    }
    this.motores.clear();
  }

  iniciarCorrida(jogadores) {
    if (!this.iniciar()) return;
    this.limparEfeitos();
    this.pararMotores();
    this.emCorrida = true;
    // A largada e imediata, acompanhada de um sinal curto ascendente.
    this.criarSom({frequencia: 330, fim: 660, duracao: 0.18, volume: 0.4, interface: true});
    // O sinal acompanha a largada; os motores entram apos o fade da corrida anterior.
    for (const carro of jogadores) this.criarMotor(carro, 0.18);
  }

  somBatidaBarreira(velocidade, contraParede) {
    const forca = this.limitar((velocidade * 0.25 + Math.abs(contraParede) * 0.75) / VELOCIDADE_MAXIMA);
    const duracao = 0.08 + forca * 0.15;
    this.criarSom({frequencia: 95 - forca * 25, fim: 32, duracao, volume: 0.04 + forca * 0.35});
    this.criarSom({ruido: true, filtro: 450, duracao, volume: 0.03 + forca * 0.25});
  }

  somBatidaCarros(velocidadeRelativa) {
    const forca = this.limitar(velocidadeRelativa / (VELOCIDADE_MAXIMA * 2));
    this.criarSom({tipo: 'square', frequencia: 430, fim: 135, duracao: 0.10, volume: 0.04 + forca * 0.22});
    this.criarSom({frequencia: 670, fim: 240, duracao: 0.08, volume: 0.03 + forca * 0.16});
  }

  somDano() {
    for (const [indice, frequencia] of [310, 200].entries()) {
      this.criarSom({frequencia, duracao: 0.1, atraso: indice * 0.11, volume: 0.3});
    }
  }

  somExplosao(carro) {
    const motor = this.motores.get(carro.numero);
    if (motor) {
      this.suavizar(motor.ganho.gain, 0, 0.005);
      this.suavizar(motor.ganhoZebra.gain, 0, 0.005);
    }
    this.criarSom({ruido: true, filtro: 1100, duracao: 0.75, volume: 0.6});
    this.criarSom({frequencia: 110, fim: 24, duracao: 0.65, volume: 0.45});
  }

  somVolta(carro) {
    const fator = carro.numero === '2' ? 1.12 : 1;
    for (const [indice, nota] of [330, 440, 550].entries()) {
      this.criarSom({frequencia: nota * fator, duracao: 0.12,
        atraso: indice * 0.09, volume: 0.3, interface: true});
    }
  }

  terminarCorrida(empate, vencedor) {
    if (!this.emCorrida) return;
    this.pararMotores();
    this.limparEfeitos();
    this.criarSom({frequencia: 260, fim: 110, duracao: 0.25, volume: 0.4, interface: true});
    const notas = empate ? [330, 330] : [330, 440, 550, 660];
    const fator = !empate && vencedor.numero === '2' ? 1.12 : 1;
    notas.forEach((nota, indice) => {
      this.criarSom({frequencia: nota * fator, duracao: 0.18,
        atraso: 0.32 + indice * 0.15, volume: 0.35, interface: true});
    });
  }

  limparCorrida() {
    this.pararMotores();
    this.limparEfeitos();
  }
}
