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
  const pasta=path.join(__dirname,'artifacts');fs.mkdirSync(pasta,{recursive:true});
  for(const mapa of ['classico','oval','retangular','triangular']){
    const dados=await avaliar(`
      jogo.rodando=false;document.getElementById('mapSelect').value='${mapa}';
      document.getElementById('mapSelect').dispatchEvent(new Event('change'));
      document.getElementById('startButton').click();jogo.rodando=false;jogo.desenhar();
      ({imagem:jogo.canvas.toDataURL('image/png'),vidas:document.getElementById('lives1').textContent,
        pneus:jogo.pneus.length,largura:jogo.larguraPista})`);
    assert.equal(dados.vidas,'3 vidas');assert.equal(dados.largura,108);assert(dados.pneus>100);
    fs.writeFileSync(path.join(pasta,mapa+'.png'),Buffer.from(dados.imagem.split(',')[1],'base64'));
    console.log('OK navegador file://: '+mapa);
  }
  for(const efeito of ['branca','preta','explosao']) {
    const imagem=await avaliar(`
      jogo.rodando=false; jogo.jogadores[0].reiniciar();
      jogo.jogadores[0].estadoDano='${efeito}';
      if('${efeito}'==='explosao'){
        jogo.jogadores[0].explodir();jogo.jogadores[0].atualizarDano(.2);
      }else{
        for(let i=0;i<10;i++)jogo.jogadores[0].atualizarFumaca(.07);
      }
      jogo.mostrarVidas();jogo.desenhar();jogo.canvas.toDataURL('image/png')`);
    fs.writeFileSync(path.join(pasta,efeito+'.png'),Buffer.from(imagem.split(',')[1],'base64'));
  }
  await avaliar("jogo.iniciar()");
  const antes=await avaliar('jogo.jogadores.map(c=>c.y)');
  for(const [key,code]of [['w','KeyW'],['ArrowUp','ArrowUp']])await enviar('Input.dispatchKeyEvent',{type:'keyDown',key,code});
  await esperar(250);
  for(const [key,code]of [['w','KeyW'],['ArrowUp','ArrowUp']])await enviar('Input.dispatchKeyEvent',{type:'keyUp',key,code});
  const depois=await avaliar('jogo.jogadores.map(c=>c.y)');assert(depois.every((y,i)=>y>antes[i]));
  await avaliar("jogo.rodando=false;document.getElementById('jogo').scrollIntoView({behavior:'instant',block:'start'})");
  const foto=await enviar('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(pasta,'desktop.png'),Buffer.from(foto.data,'base64'));
  await enviar('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await enviar('Emulation.setPageScaleFactor',{pageScaleFactor:1});
  await avaliar("document.querySelector('.map-picker').scrollIntoView({behavior:'instant',block:'start'});window.scrollTo(0,window.scrollY)");
  const responsivo=await avaliar(`({largura:innerWidth,conteudo:document.documentElement.scrollWidth,
    hud:document.querySelector('.hud').getBoundingClientRect().width,
    canvas:document.querySelector('canvas').getBoundingClientRect().width})`);
  assert(responsivo.conteudo<=responsivo.largura,'Overflow no celular');
  assert(responsivo.canvas<390 && responsivo.hud<390);
  const celular=await enviar('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(pasta,'mobile.png'),Buffer.from(celular.data,'base64'));
  assert.equal(erros.length,0,JSON.stringify(erros));assert.equal(rede.length,0,'Dependencia externa: '+rede.join(','));
  console.log('OK: WASD e setas reais, HUD responsivo, nenhuma dependencia de rede e nenhum erro no console.');
 } finally {
  if(socket)socket.close();processo.kill();
  await esperar(500);
  if(path.dirname(perfil)===os.tmpdir() && path.basename(perfil).startsWith('indy500-browser-')){
    fs.rmSync(perfil,{recursive:true,force:true,maxRetries:5,retryDelay:200});
  }
 }
})().catch(e=>{console.error(e);process.exitCode=1});
