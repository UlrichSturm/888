const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const telegram = window.Telegram?.WebApp;

if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor?.('#081520');
  telegram.setBackgroundColor?.('#081520');
  telegram.disableVerticalSwipes?.();
}

function haptic(type = 'light') {
  if (telegram?.HapticFeedback) {
    telegram.HapticFeedback.impactOccurred(type);
  } else if (navigator.vibrate) {
    navigator.vibrate(type === 'heavy' ? 35 : 12);
  }
}
const levelBackgroundPaths = [
  'assets/levels/level-01-jungle.png', 'assets/levels/level-02-pyramids.png',
  'assets/levels/level-03-arctic.png', 'assets/levels/level-04-volcano.png',
  'assets/levels/level-05-underwater.png', 'assets/levels/level-06-cybercity.png',
  'assets/levels/level-07-moon.png', 'assets/levels/level-08-castle.png',
  'assets/levels/level-09-sky-islands.png', 'assets/levels/level-10-cosmos.png'
];
const levelBackgrounds = levelBackgroundPaths.map(src=>{const image=new Image();image.src=src;return image});
const ballArt = new Image(); ballArt.src = 'assets/ball-premium.png';
const scoreboardArt = new Image(); scoreboardArt.src = 'assets/ui/scoreboard-panel-v2.png';
const swishAudio = new Audio('assets/audio/net-swish-v3.mp3'); swishAudio.preload = 'auto';
const missAudio = new Audio('assets/audio/net-swish-v2.mp3'); missAudio.preload = 'auto';
const dribbleAudio = new Audio('assets/audio/dribble-hit.mp3'); dribbleAudio.preload = 'auto';
const buzzerAudio = new Audio('assets/audio/shot-clock-buzzer.mp3'); buzzerAudio.preload = 'auto';
const levelCheerAudio = new Audio('assets/audio/level-cheer.mp3'); levelCheerAudio.preload = 'auto';
const menuMusic = new Audio('assets/audio/menu-music.mp3'); menuMusic.preload = 'auto'; menuMusic.loop = true; menuMusic.volume = .28;

const state = {
  score: 0, best: Number(localStorage.getItem('basket888-best') || 0), streak: 0,
  phase: 'levelIntro', power: 0, direction: 1, time: 0, shake: 0,
  ball: { x: .5, y: .79, r: 13, flying: false }, trail: [], bounce: null,
  target: .72, targetWidth: .20, spawnX: .5, spawnY: .79, markerSpeed: .76, shotValue: 2, difficulty: 'MID RANGE',
  message: 'HOLD TO SHOOT', sub: 'Release in the green zone', messageTime: 0,
  shots: 0, hits: 0, sound: localStorage.getItem('basket888-sound')!=='off', lastDribbleCycle: 0,
  level: 1, levelTime: 24, gameStarted: false, targetDirection: 1, gameOverTime: 0,
  language: localStorage.getItem('basket888-language')||'en',
};
let W = 0, H = 0, dpr = 1, audio;
const menuScreen=document.querySelector('#menu-screen'),settingsScreen=document.querySelector('#settings-screen');
const copy={
  en:{start:'START',settings:'SETTINGS',sound:'SOUND',language:'LANGUAGE',back:'BACK',on:'ON',off:'OFF',level:'LEVEL',tapStart:'TAP TO START',hold:'HOLD TO SHOOT',best:'BEST',score:'SCORE',complete:'10 LEVELS COMPLETE',final:'FINAL SCORE',conquered:'888 CONQUERED',again:'TAP TO MENU',returning:'RETURNING TO MENU'},
  ru:{start:'СТАРТ',settings:'НАСТРОЙКИ',sound:'ЗВУК',language:'ЯЗЫК',back:'НАЗАД',on:'ВКЛ',off:'ВЫКЛ',level:'УРОВЕНЬ',tapStart:'НАЖМИТЕ, ЧТОБЫ НАЧАТЬ',hold:'УДЕРЖИВАЙТЕ ДЛЯ БРОСКА',best:'РЕКОРД',score:'СЧЁТ',complete:'10 УРОВНЕЙ ЗАВЕРШЕНЫ',final:'ИТОГОВЫЙ СЧЁТ',conquered:'888 ПОКОРЕНО',again:'НАЖМИТЕ ДЛЯ МЕНЮ',returning:'ВОЗВРАЩЕНИЕ В МЕНЮ'}
};
const tr=key=>copy[state.language][key];
function applyLanguage(){
  document.querySelector('#start-button').textContent=tr('start');document.querySelector('#settings-button').textContent=tr('settings');document.querySelector('#settings-title').textContent=tr('settings');document.querySelector('#sound-label').textContent=tr('sound');document.querySelector('#language-label').textContent=tr('language');document.querySelector('#back-button').textContent=tr('back');
  const soundButton=document.querySelector('#sound-toggle');soundButton.textContent=tr(state.sound?'on':'off');soundButton.classList.toggle('is-active',state.sound);
  document.querySelectorAll('.lang-button').forEach(b=>b.classList.toggle('is-active',b.dataset.lang===state.language));
}
function playMenuMusic(){if(state.sound)menuMusic.play().catch(()=>{})}
function showMenu(){menuScreen.classList.remove('is-hidden');settingsScreen.classList.add('is-hidden');playMenuMusic()}
function showSettings(){menuScreen.classList.add('is-hidden');settingsScreen.classList.remove('is-hidden');playMenuMusic()}
document.querySelector('#start-button').addEventListener('click',()=>{menuMusic.pause();menuMusic.currentTime=0;menuScreen.classList.add('is-hidden');reset();playClip(levelCheerAudio,.34,1)});
document.querySelector('#settings-button').addEventListener('click',showSettings);
document.querySelector('#back-button').addEventListener('click',showMenu);
document.querySelector('#sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;localStorage.setItem('basket888-sound',state.sound?'on':'off');if(state.sound)playMenuMusic();else menuMusic.pause();applyLanguage()});
document.querySelectorAll('.lang-button').forEach(b=>b.addEventListener('click',()=>{state.language=b.dataset.lang;localStorage.setItem('basket888-language',state.language);applyLanguage()}));
menuScreen.addEventListener('pointerdown',playMenuMusic,{once:true});settingsScreen.addEventListener('pointerdown',playMenuMusic,{once:true});applyLanguage();

function resize() {
  const box = canvas.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
  if (!box.width || !box.height) return;
  W = box.width; H = box.height; canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
new ResizeObserver(resize).observe(canvas);
requestAnimationFrame(resize);

function randomizeShot() {
  state.spawnY = .57 + Math.random() * .30;
  state.spawnX = .20 + Math.random() * .60;
  state.ball.x = state.spawnX; state.ball.y = state.spawnY;
  configureDifficulty();
}
function configureDifficulty(){
  const dx=Math.abs(state.spawnX-.5)*1.25,dy=(state.spawnY-.31)/.56;
  const distance=Math.min(1,Math.hypot(dx,dy)*.82);
  let baseWidth;
  if(distance<.56){baseWidth=.29;state.markerSpeed=.60;state.shotValue=2;state.difficulty='CLOSE RANGE'}
  else if(distance<.82){baseWidth=.20;state.markerSpeed=.78;state.shotValue=2;state.difficulty='MID RANGE'}
  else{baseWidth=.12;state.markerSpeed=1.02;state.shotValue=3;state.difficulty='3 POINTER'}
  state.targetWidth=Math.max(.045,baseWidth*(1-(state.level-1)*.055));
  const margin=state.targetWidth/2+.035;state.target=margin+Math.random()*(1-margin*2);
  state.targetDirection=Math.random()<.5?-1:1;
}
randomizeShot();

function tone(freq, duration, type = 'sine', volume = .05, delay = 0) {
  if (!state.sound) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(.001, t + duration); o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + duration);
}
function swish() {
  playClip(swishAudio,.41,1);
}
function playClip(source,volume=1,rate=1){
  if(!state.sound)return;
  const clip=source.cloneNode();clip.volume=volume;clip.playbackRate=rate;clip.play().catch(()=>{});
}
function roundRect(x,y,w,h,r,fill,stroke) {
  ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
}
function text(s,x,y,size,weight='700',color='#fff',align='center') {
  ctx.font = `${weight} ${size}px Inter, system-ui, sans-serif`; ctx.textAlign=align; ctx.textBaseline='middle';
  ctx.fillStyle=color; ctx.fillText(s,x,y);
}
function sevenDigit(char,x,y,h){
  const w=h*.56,t=h*.105,on='#ff6b35',off='rgba(85,30,18,.26)';
  if(char===':'){ctx.fillStyle=on;ctx.beginPath();ctx.arc(x+w*.25,y+h*.34,t*.7,0,Math.PI*2);ctx.arc(x+w*.25,y+h*.68,t*.7,0,Math.PI*2);ctx.fill();return w*.38}
  const map={0:'abcedf',1:'bc',2:'abged',3:'abgcd',4:'fgbc',5:'afgcd',6:'afgecd',7:'abc',8:'abcdefg',9:'abfgcd'}[char]||'';
  const seg={a:[t,0,w-2*t,t],g:[t,h*.46,w-2*t,t],d:[t,h-t,w-2*t,t],f:[0,t,t,h*.40],b:[w-t,t,t,h*.40],e:[0,h*.52,t,h*.39],c:[w-t,h*.52,t,h*.39]};
  ctx.save();ctx.shadowColor=on;ctx.shadowBlur=7;
  for(const [key,r] of Object.entries(seg)){ctx.fillStyle=map.includes(key)?on:off;roundRect(x+r[0],y+r[1],r[2],r[3],t*.45,ctx.fillStyle)}
  ctx.restore();return w;
}
function drawScoreboard(){
  const sw=W*.50,sh=sw*(450/1660),sx=W/2-sw/2,sy=H*.145;
  if(scoreboardArt.complete&&scoreboardArt.naturalWidth)ctx.drawImage(scoreboardArt,sx,sy,sw,sh);
  else roundRect(sx,sy,sw,sh,6,'rgba(2,4,7,.9)','#57ddff');
  const seconds=Math.max(0,Math.ceil(state.levelTime)),clock=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,dh=sh*.48;
  let total=0;for(const c of clock)total+=c===':'?dh*.56*.38:dh*.56;total+=(clock.length-1)*dh*.10;
  let x=W/2-total/2,y=sy+sh*.27;for(const c of clock){const used=sevenDigit(c,x,y,dh);x+=used+dh*.10}
  text(`${tr('level')} ${state.level}`,W/2,sy+sh*.82,Math.max(6,sh*.13),'900','#8deeff');
}
function begin() {
  if (state.phase === 'over') { reset(); showMenu(); return; }
  if (state.phase === 'levelIntro') { state.phase='ready';state.gameStarted=true;state.lastDribbleCycle=(state.time*1.55)%1;return; }
  if (state.phase !== 'ready') return;
  state.phase='aim'; state.shotStartY=state.spawnY-.105; state.message='BUILD YOUR SHOT'; state.sub='Release at the sweet spot'; tone(160,.08,'sine',.025);
}
function release() {
  if(state.phase !== 'aim') return;
  state.phase='flight'; state.shots++;
  const accuracy = Math.abs(state.power - state.target); state.hit = accuracy < state.targetWidth / 2;
  state.perfect = accuracy < state.targetWidth * .18; state.flightT=0; state.startPower=state.power;
  state.trail=[];
  tone(240,.12,'triangle',.04); haptic('light');
}
function reset(){ Object.assign(state,{score:0,streak:0,phase:'levelIntro',power:0,direction:1,shots:0,hits:0,level:1,levelTime:24,gameStarted:false,gameOverTime:0,message:'HOLD TO SHOOT',sub:'Find the moving sweet spot'}); randomizeShot(); }
canvas.addEventListener('pointerdown', e=>{e.preventDefault(); begin()});
addEventListener('pointerup', release); canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{ if(e.code==='Space'){e.preventDefault(); if(!e.repeat)begin()} if(e.key.toLowerCase()==='m')state.sound=!state.sound });
addEventListener('keyup',e=>{if(e.code==='Space')release()});

function finishShot(){
  if(state.hit){
    state.hits++; state.streak++; const multiplier=1+Math.floor((state.level-1)/3),pts=state.shotValue*multiplier; state.score += pts;
    state.best=Math.max(state.best,state.score); localStorage.setItem('basket888-best',state.best);
    state.message=state.perfect?`PERFECT +${pts}`:`BUCKET +${pts}`; state.sub=state.streak>1?`${state.streak}× streak · keep cooking`:'Clean release';
    haptic('medium'); state.shake=2.5;
  } else {
    state.streak=0; state.message=state.startPower<.6?'TOO EARLY':'OFF TARGET'; state.sub='Reset. Breathe. Shoot again.';
    haptic('heavy');
  }
  state.phase='result'; state.messageTime=.08;
}
function flightPosition(t=state.flightT){
  t=Math.min(1,t);const sx=W*state.spawnX,sy=H*(state.shotStartY??state.spawnY-.105),ex=state.hit?W*.5:W*(state.startPower < state.target ? .34 : .7),ey=H*.31;
  const perspective=Math.pow(t,.78);
  return{x:sx+(ex-sx)*t,y:sy+(ey-sy)*t-Math.sin(Math.PI*t)*H*.27,r:32-(perspective*23)};
}
function startBounce(){
  const p=flightPosition(1), side=p.x<W/2?-1:1;
  playClip(missAudio,.48,.98+Math.random()*.04);
  state.bounce={x:p.x,y:p.y,vx:side*(65+Math.random()*45),vy:40,count:0};state.phase='bounce';
}
function update(dt){
  state.time+=dt;
  if(state.gameStarted&&state.phase!=='over'){
    state.levelTime-=dt;
    if(state.levelTime<=0){
      playClip(buzzerAudio,.58,1);
      if(state.level>=10){state.levelTime=0;state.phase='over';state.gameStarted=false;state.gameOverTime=6;state.best=Math.max(state.best,state.score);localStorage.setItem('basket888-best',state.best)}
      else{
        state.level++;state.levelTime=24;state.phase='levelIntro';state.gameStarted=false;state.power=0;state.direction=1;
        state.trail=[];state.bounce=null;state.hit=false;randomizeShot();
        playClip(levelCheerAudio,.34,1);
      }
    }
  }
  if(state.phase==='over'){
    state.gameOverTime-=dt;
    if(state.gameOverTime<=0){reset();showMenu()}
  }
  if(state.level>=4&&(state.phase==='ready'||state.phase==='aim')){
    const zoneSpeed=.035+(state.level-4)*.020,margin=state.targetWidth/2+.025;
    state.target+=state.targetDirection*zoneSpeed*dt;
    if(state.target>=1-margin){state.target=1-margin;state.targetDirection=-1}
    if(state.target<=margin){state.target=margin;state.targetDirection=1}
  }
  if(state.phase==='ready'){
    const cycle=(state.time*1.55)%1;
    if(cycle<state.lastDribbleCycle)playClip(dribbleAudio,.36,.96+Math.random()*.08);
    state.lastDribbleCycle=cycle;
  }
  if(state.phase==='aim') { state.power += dt*state.direction*state.markerSpeed; if(state.power>=1){state.power=1;state.direction=-1} if(state.power<=0){state.power=0;state.direction=1} }
  if(state.phase==='flight'){
    state.flightT+=dt/0.72;const p=flightPosition();state.trail.push({x:p.x,y:p.y,life:1});
    if(state.flightT>=1){
      if(state.hit){state.phase='swish';state.swishT=0;swish()}
      else startBounce()
    }
  }
  if(state.phase==='swish'){
    state.swishT+=dt/.42;
    const t=Math.min(1,state.swishT),x=W*.5+Math.sin(t*Math.PI)*W*.008,y=H*(.31+t*.13);
    state.trail.push({x,y,life:.6*(1-t)});
    if(state.swishT>=1)finishShot();
  }
  if(state.phase==='bounce'){
    const b=state.bounce;b.vy+=H*1.85*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;const floor=H*.88;
    state.trail.push({x:b.x,y:b.y,life:.55});
    if(b.y>=floor){b.y=floor;b.count++;playClip(dribbleAudio,.48,.9+b.count*.05);if(b.count>=2){state.spawnX=Math.max(.16,Math.min(.84,b.x/W));state.spawnY=floor/H;state.ball.x=state.spawnX;state.ball.y=state.spawnY;configureDifficulty();finishShot()}else{b.vy=-H*.38;b.vx*=.72}}
  }
  if(state.phase==='result'){ state.messageTime-=dt; if(state.messageTime<=0){state.phase='ready';state.power=0;state.direction=1;if(state.hit)randomizeShot();state.trail=[];state.message='READY';state.sub='Watch the sweet spot'} }
  state.trail.forEach(p=>p.life-=dt*1.8);state.trail=state.trail.filter(p=>p.life>0);
  state.shake*=Math.pow(.02,dt);
}

function court(){
  const courtArt=levelBackgrounds[Math.max(0,Math.min(9,state.level-1))];
  if (courtArt.complete && courtArt.naturalWidth) ctx.drawImage(courtArt, 0, 0, W, H);
  else { const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#061b37');g.addColorStop(1,'#8f431e');ctx.fillStyle=g;ctx.fillRect(0,0,W,H); }
  const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(2,8,18,.12)');shade.addColorStop(.45,'rgba(2,8,18,.02)');shade.addColorStop(1,'rgba(2,8,18,.35)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
}
function hoop(){
  ctx.fillStyle='#d8ebf2';ctx.shadowColor='#71d3ff';ctx.shadowBlur=16;roundRect(W*.35,H*.16,W*.3,H*.15,6,'rgba(218,240,246,.15)','#9ac4d4');ctx.shadowBlur=0;
  ctx.fillStyle='#ff6633';roundRect(W*.34,H*.278,W*.32,7,4,'#ff6335');
  ctx.strokeStyle='rgba(255,255,255,.65)';ctx.lineWidth=1.3;
  for(let i=0;i<8;i++){let x=W*(.37+i*.037);ctx.beginPath();ctx.moveTo(x,H*.286);ctx.lineTo(W*.5+(x-W*.5)*.55,H*.385);ctx.stroke()}
  for(let y=H*.31;y<H*.385;y+=15){ctx.beginPath();ctx.moveTo(W*.37,y);ctx.lineTo(W*.63,y);ctx.stroke()}
}
function ball(x,y,r=14){
  ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(state.time*1.8);ctx.shadowColor='#ff6a2a';ctx.shadowBlur=22;
  ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.clip();
  if(ballArt.complete&&ballArt.naturalWidth){
    const inset=ballArt.naturalWidth*.085, crop=ballArt.naturalWidth-inset*2;
    ctx.drawImage(ballArt,inset,inset,crop,crop,-r,-r,r*2,r*2);
  }
  else{ctx.fillStyle='#f47725';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill()}
  ctx.restore();
}
function player(){
  const x=W*state.spawnX,y=H*state.spawnY;
  const pulse=18+Math.sin(state.time*3)*3;ctx.strokeStyle='rgba(65,225,255,.55)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+18,pulse,pulse*.34,0,0,Math.PI*2);ctx.stroke();
  const g=ctx.createRadialGradient(x,y+12,2,x,y+12,38);g.addColorStop(0,'rgba(51,213,255,.28)');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-40,y-28,80,80);
}
function hud(){
  const hudY=H*.072;
  const scoreText=String(state.score).padStart(3,'0'),scoreX=24,gap=10;
  text(tr('score'),scoreX,hudY-14,9,'800','rgba(255,255,255,.5)','left');
  ctx.font='900 29px Inter, system-ui, sans-serif';const scoreWidth=ctx.measureText(scoreText).width;
  ctx.font='600 20px Inter, system-ui, sans-serif';const slashWidth=ctx.measureText('/').width,slashX=scoreX+scoreWidth+gap;
  text(scoreText,scoreX,hudY+7,29,'900','#fff','left');
  text('/',slashX,hudY+7,20,'600','rgba(255,255,255,.35)','left');
  text('888',slashX+slashWidth+gap,hudY+7,29,'900','#ff7b39','left');
  text(tr('best'),W-112,hudY-14,9,'800','rgba(255,255,255,.5)','left');
  text(String(state.best).padStart(3,'0'),W-112,hudY+7,25,'900','#fff','left');
  if(state.phase==='levelIntro'||state.phase==='over')return;
  if(state.streak>1){
    roundRect(W/2-34,hudY-14,68,29,15,'rgba(255,102,51,.18)','rgba(255,126,67,.55)');
    text(`${state.streak}× HEAT`,W/2,hudY+1,10,'900','#ff9b60');
  }
  const bx=32,by=H*.945,bw=W-64,bh=10;roundRect(bx,by,bw,bh,5,'rgba(255,255,255,.1)');
  const zoneStart=state.target-state.targetWidth/2;roundRect(bx+bw*zoneStart,by-3,bw*state.targetWidth,bh+6,8,'rgba(50,255,158,.32)','#5affb4');
  const pg=ctx.createLinearGradient(bx,0,bx+bw,0);pg.addColorStop(0,'#ff405d');pg.addColorStop(.5,'#ffb33b');pg.addColorStop(1,'#ff405d');ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(bx,by,bw*state.power,bh,5);ctx.fill();
  const mx=bx+bw*state.power;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(mx,by+bh/2,6,0,Math.PI*2);ctx.fill();
  text(tr('hold'),W/2,by-24,11,'900','rgba(255,255,255,.82)');
}
function levelIntroOverlay(){
  if(state.phase!=='levelIntro')return;
  ctx.fillStyle='rgba(2,8,18,.50)';ctx.fillRect(0,0,W,H);
  text(tr('level'),W/2,H*.49,14,'900','#7ceaff');
  text(String(state.level),W/2,H*.555,62,'900','#fff');
  text(tr('tapStart'),W/2,H*.63,11,'800','rgba(255,255,255,.68)');
}
function gameOverOverlay(){
  if(state.phase!=='over')return;
  ctx.fillStyle='rgba(2,8,18,.76)';ctx.fillRect(0,0,W,H);
  text(tr('complete'),W/2,H*.42,12,'900','#75e8ff');
  text(String(state.score),W/2,H*.485,54,'900',state.score>=888?'#64ffb2':'#fff');
  text(state.score>=888?tr('conquered'):tr('final'),W/2,H*.535,14,'900',state.score>=888?'#ff9b55':'rgba(255,255,255,.68)');
  text(`${tr('best')}  ${String(state.best).padStart(3,'0')}`,W/2,H*.585,17,'900','#75e8ff');
  text(`${tr('returning')} · ${Math.max(1,Math.ceil(state.gameOverTime))}`,W/2,H*.65,10,'800','rgba(255,255,255,.55)');
  text(tr('again'),W/2,H*.69,9,'800','rgba(255,255,255,.42)');
}
function idleDribble(){
  const cycle=(state.time*1.55)%1;
  const lift=4*cycle*(1-cycle);
  return{x:W*state.spawnX,y:H*(state.spawnY-lift*.105)};
}
function draw(){
  ctx.save();ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);court();drawScoreboard();
  if(state.phase!=='levelIntro'&&state.phase!=='over')player();
  if(state.trail.length>1){ctx.save();ctx.lineCap='round';for(let i=1;i<state.trail.length;i++){const a=state.trail[i-1],b=state.trail[i];ctx.globalAlpha=b.life*.55;ctx.strokeStyle='#67e8ff';ctx.lineWidth=Math.max(1,7*b.life);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.restore()}
  if(state.phase==='flight'){
    const p=flightPosition();ball(p.x,p.y,p.r);
  } else if(state.phase==='swish') {
    const t=Math.min(1,state.swishT),x=W*.5+Math.sin(t*Math.PI)*W*.008,y=H*(.31+t*.13);
    ball(x,y,9-t*1.5);
  } else if(state.phase==='bounce') {
    const depth=Math.max(0,Math.min(1,(state.bounce.y-H*.31)/(H*.88-H*.31)));
    ball(state.bounce.x,state.bounce.y,12+depth*16);
  } else if(state.phase==='ready') {
    const d=idleDribble();
    ball(d.x,d.y,30);
  } else if(state.phase==='aim'||state.phase==='result') ball(W*state.spawnX,H*(state.spawnY-.105),32);
  ctx.globalAlpha=1;hud();levelIntroOverlay();gameOverOverlay();ctx.restore();
}
let last=performance.now();function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
