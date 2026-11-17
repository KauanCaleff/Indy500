# Verificacao local

O jogo abre diretamente em `../index.html`, sem servidor, instalacao ou acesso a internet.
O backup anterior a estas alteracoes esta em `../backup-antes-das-barreiras/`.

## Configuracoes em game.js

- `LARGURA_PISTA = 108`: largura do asfalto, comum aos quatro mapas.
- `LARGURA_ZEBRA = 8`: largura da zebra de cada lado.
- `RAIO_PNEU = 4`: tamanho dos pneus; sua posicao deriva das duas larguras.
- `VELOCIDADE_MAXIMA = 8`: limite nos dois sentidos; dano a partir de 2/3 desse limite.
- `VIDAS_INICIAIS = 3`: vidas ao iniciar e ao recuperar o carro.
- `DURACAO_EXPLOSAO = 3`: segundos ate retornar a sua vaga na largada.
- `INVULNERABILIDADE = 1`: segundos sem dano apos batida forte ou retorno.

A colisao projeta o vetor de velocidade na normal da borda mais proxima.
Remove a componente que aponta para fora e conserva 98% da componente paralela.
Por isso uma batida perpendicular para o carro, enquanto um raspao perde pouca velocidade.
O alcance do retangulo do carro tambem entra no calculo para manter a carroceria dentro da barreira.
O movimento usa passos de no maximo dois pixels para evitar atravessar as paredes.

O contato tem uma margem de afastamento de dois pixels. Uma nova vida so pode ser perdida
depois de se afastar e terminar a invulnerabilidade. O dano usa a velocidade anterior ao impacto.
O retorno mantem as voltas completas e reinicia os checkpoints da volta em andamento,
impedindo contar uma volta pelo atalho de reaparecer na largada.
Na zebra, a velocidade base fica separada da velocidade reduzida. Frear ou colidir cancela
sua restauracao ao sair. Explodir apaga esse estado completamente.

## Testes

Somente os testes precisam de Node.js. O jogo nao depende dele.

Na raiz do projeto:

```powershell
node --check game.js
node tests/game.test.cjs
node tests/browser.test.cjs
```

`game.test.cjs` usa somente modulos nativos do Node e simula o DOM/Canvas.
Confere os quatro mapas, duas voltas por circuito, checkpoints, colisoes nas duas bordas
incluindo curvas e quinas, angulos de impacto, dano, contato continuo, fumacas,
explosao, bloqueio dos controles, rival ativo, retorno, voltas preservadas,
invulnerabilidade, zebras, limite de particulas, reinicio e resultado durante explosao.

`browser.test.cjs` usa o Chrome instalado no caminho indicado no inicio do arquivo,
Node.js 24 e a porta local 9335 para automatizar o navegador. Nao serve nem hospeda o site:
o endereco aberto e `file://`. Confere os quatro mapas, controles reais WASD/setas,
HUD, largura de tela de 390 pixels, desenho de fumacas/explosao, ausencia de erros
no console e ausencia de requisicoes externas. As imagens ficam em `artifacts/`.
O perfil temporario criado pelo teste e removido ao terminar.

Resultado: ambas as suites passaram. As imagens dos quatro mapas, do HUD no celular,
das fumacas e da explosao foram conferidas no navegador.


## Audio sintetizado

`audio.js` concentra todos os nos da Web Audio API na classe `SistemaAudio`.
O AudioContext e criado/liberado por `SistemaAudio.iniciar()`, chamado por
`Jogo.iniciar()` no clique do botao de largada. Nao existe autoplay ao carregar.
Nenhum arquivo de audio, link, download, biblioteca ou som em Base64 e utilizado.
O ruido e preenchido em memoria com numeros aleatorios.

Em `CONFIG_AUDIO`, no inicio de `audio.js`:

- `volumeGeral = 0.28`: volume inicial (28%). Uma preferencia salva tem prioridade.
- `motorParado = 60` e `motorMaximo = 200`: frequencias do corpo do motor, em Hz.
- `diferencaMotor2 = 10`: frequencia adicional do jogador 2.
- `volumeMotores`, `volumeEfeitos` e `volumeInterface`: niveis dos tres canais.

O botao Som e o controle Volume tambem funcionam durante a partida. As preferencias
sao salvas em localStorage, com fallback quando o armazenamento esta bloqueado.
Se Web Audio nao existir, os controles ficam indisponiveis e o jogo continua normalmente.

Cada motor reutiliza dois osciladores e um ruido em loop com modulacao para a zebra.
`atualizarMotor()` usa o modulo da velocidade (incluindo re), limita a proporcao e
suaviza frequencia/volume com `setTargetAtTime()`. Nenhum no e criado por frame.
A explosao silencia somente o motor afetado; a recuperacao restaura seu ganho.
O encerramento faz fade e para/desconecta as fontes. Reiniciar ou trocar de mapa
limpa os efeitos antigos; o motor novo comeca depois do fade do anterior.

Os sons de barreira e entre carros possuem controles de contato. Perda de vida,
explosao e volta soam nos respectivos eventos, sem depender das atualizacoes do HUD.
O sinal de largada e curto; nao atrasa os controles ou o cronometro.

Testes adicionais, na raiz do projeto:

```powershell
node tests/audio.test.cjs
node tests/audio.browser.test.cjs
```

`audio.test.cjs` verifica os 23 comportamentos solicitados com nos simulados e a
integracao real das classes: motores, re, panorama, danos, contato, zebra, alerta,
explosao/retorno, volta valida, encerramento unico, vitoria/empate, reinicios,
mute/volume, preferencias, limpeza, ganhos e compatibilidade.

`audio.browser.test.cjs` usa o Chrome e Web Audio reais, com um clique de mouse
para liberar AudioContext. Mede o sinal do motor com AnalyserNode, testa os controles,
frequencias, zebra, explosao, retorno e limpeza. Tambem renderiza batidas e a mixagem
em OfflineAudioContext, sem salvar arquivos de som: a batida forte tem maior energia
que a fraca e o pico da mixagem simultanea fica abaixo de 0.98, mesmo com volume 100%.
Verifica persistencia apos reload, ausencia de autoplay, rede e erros de console.

As quatro suites passaram. A verificacao de audio e automatizada por estado dos nos,
eventos e amostras sintetizadas; nao substitui uma avaliacao subjetiva em alto-falantes.
