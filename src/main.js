const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const telegram = window.Telegram?.WebApp;
const APP_VERSION = '1.0.7+7';
const TELEGRAM_AUTH_URL = 'https://basketball888-api.ulrichsturm.workers.dev/auth/telegram';
const TELEGRAM_SCORE_URL = 'https://basketball888-api.ulrichsturm.workers.dev/score';
const TELEGRAM_LEADERBOARD_URL = 'https://basketball888-api.ulrichsturm.workers.dev/leaderboard';
let authenticatedPlayer = null;
let lastServerBest = 0;
let bestScoreSyncInFlight = false;
let finalRankRequested = false;

if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor?.('#081520');
  telegram.setBackgroundColor?.('#081520');
  telegram.disableVerticalSwipes?.();
}

async function authenticateTelegramPlayer() {
  if (!telegram?.initData) return;
  try {
    const response = await fetch(TELEGRAM_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: telegram.initData }),
    });
    if (response.ok) {
      authenticatedPlayer = await response.json();
      applyAuthenticatedPlayer();
    }
  } catch {
    // The game stays playable if authorization is temporarily unavailable.
  }
}

authenticateTelegramPlayer();

function haptic(type = 'light') {
  if (telegram?.HapticFeedback) {
    telegram.HapticFeedback.impactOccurred(type);
  } else if (navigator.vibrate) {
    navigator.vibrate(type === 'heavy' ? 35 : 12);
  }
}

function requestTelegramFullscreen() {
  if (!telegram) return;
  try { telegram.expand?.(); } catch {}
  try { telegram.requestFullscreen?.(); } catch {}
}

function ballRadiusForDepth(y = state.spawnY) {
  const depth = Math.max(0, Math.min(1, (y - .55) / .34));
  return 17 + depth * 17;
}
const levelBackgroundPaths = [
  'assets/levels/level-01-jungle.webp', 'assets/levels/level-02-pyramids.webp',
  'assets/levels/level-03-arctic.webp', 'assets/levels/level-04-volcano.webp',
  'assets/levels/level-05-underwater.webp', 'assets/levels/level-06-cybercity.webp',
  'assets/levels/level-07-moon.webp', 'assets/levels/level-08-castle.webp',
  'assets/levels/level-09-sky-islands.webp', 'assets/levels/level-10-cosmos.webp'
];
const levelBackgrounds = levelBackgroundPaths.map(src=>{const image=new Image();image.src=src;return image});
const arcScenes = [
  {src:'assets/arc-hall-01.webp',ball:[.20,.80],hoop:[.62,.36]},
  {src:'assets/arc-hall-02.webp',ball:[.50,.82],hoop:[.50,.40]},
  {src:'assets/arc-hall-03.webp',ball:[.82,.80],hoop:[.20,.35]},
  {src:'assets/arc-hall-04.webp',ball:[.15,.81],hoop:[.66,.45]},
  {src:'assets/arc-hall-05.webp',ball:[.70,.80],hoop:[.45,.34]},
].map(scene=>({...scene,image:Object.assign(new Image(),{src:scene.src})}));
const rhythmBackground = new Image(); rhythmBackground.src = 'assets/modes/rhythm-court.webp';
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
  language: localStorage.getItem('basket888-language')||'en', finalRank: null, league: 888, mode: 'full', endlessShots: 0, endlessMisses: 0, endlessDifficulty: 0,
  arcScene: 0, arcOrder: [], arcAttempt: 0, arcSuccesses: 0, arcPath: [], arcFlightPath: [], arcFlightT: 0, arcWillScore: false,
  rhythmScore: 0, rhythmBest: Number(localStorage.getItem('basket888-rhythm-best') || 0), rhythmInterval: 0, rhythmLastTap: 0,
  rhythmTolerance: 0, rhythmFailedAt: 0, rhythmPulse: 0, rhythmFall: null,
};
let W = 0, H = 0, dpr = 1, audio;
const menuScreen=document.querySelector('#menu-screen'),settingsScreen=document.querySelector('#settings-screen'),leaderboardScreen=document.querySelector('#leaderboard-screen');
const copy={
  en:{start:'START',settings:'SETTINGS',leaderboard:'LEADERBOARD',top100:'TOP 100',loading:'LOADING',noScores:'NO SCORES YET',yourBest:'YOUR BEST',sound:'SOUND',language:'LANGUAGE',back:'BACK',on:'ON',off:'OFF',level:'LEVEL',tapStart:'TAP TO START',hold:'HOLD TO SHOOT',best:'BEST',score:'SCORE',complete:'10 LEVELS COMPLETE',final:'FINAL SCORE',worldRank:'WORLD RANK',conquered:'888 CONQUERED',again:'TAP TO MENU',returning:'RETURNING TO MENU',modes:'GAME MODES',chooseRun:'CHOOSE YOUR RUN',fullGame:'FULL GAME',fullGameSub:'10 LEVELS · 24 SEC EACH',endless:'ENDLESS',endlessSub:'3 MISSES · GET HARDER EVERY SHOT',endlessReady:'3 MISSES. HOW FAR CAN YOU GO?',endlessOver:'ENDLESS OVER',misses:'MISSES',arcShot:'ARC SHOT',arcShotSub:'DRAW THE PERFECT CURVE',arcReady:'TRACE THE ARC TO THE RIM',arcLearn:'FOLLOW THE GLOWING ARC',arcResult:'ARC SHOT COMPLETE',shots:'SHOTS',point:'POINT',rhythm:'RHYTHM DRIBBLE',rhythmSub:'FIND YOUR BEAT',setRhythm:'TAP TWICE TO SET THE RHYTHM',keepRhythm:'KEEP THE RHYTHM',rhythmLost:'RHYTHM LOST',bounces:'BOUNCES',rhythmBest:'RHYTHM BEST'},
  ru:{start:'СТАРТ',settings:'НАСТРОЙКИ',leaderboard:'РЕЙТИНГ',top100:'ТОП 100',loading:'ЗАГРУЗКА',noScores:'ПОКА НЕТ РЕЗУЛЬТАТОВ',yourBest:'ВАШ РЕКОРД',sound:'ЗВУК',language:'ЯЗЫК',back:'НАЗАД',on:'ВКЛ',off:'ВЫКЛ',level:'УРОВЕНЬ',tapStart:'НАЖМИТЕ, ЧТОБЫ НАЧАТЬ',hold:'УДЕРЖИВАЙТЕ ДЛЯ БРОСКА',best:'РЕКОРД',score:'СЧЁТ',complete:'10 УРОВНЕЙ ЗАВЕРШЕНЫ',final:'ИТОГОВЫЙ СЧЁТ',worldRank:'МИРОВОЕ МЕСТО',conquered:'888 ПОКОРЕНО',again:'НАЖМИТЕ ДЛЯ МЕНЮ',returning:'ВОЗВРАЩЕНИЕ В МЕНЮ',modes:'РЕЖИМЫ ИГРЫ',chooseRun:'ВЫБЕРИТЕ РЕЖИМ',fullGame:'ПОЛНАЯ ИГРА',fullGameSub:'10 УРОВНЕЙ · ПО 24 СЕК',endless:'БЕСКОНЕЧНЫЙ',endlessSub:'3 ПРОМАХА · СЛОЖНЕЕ КАЖДЫЙ БРОСОК',endlessReady:'3 ПРОМАХА. КАК ДАЛЕКО ЗАЙДЁТЕ?',endlessOver:'КОНЕЦ ЗАБЕГА',misses:'ПРОМАХИ',arcShot:'БРОСОК ПО ДУГЕ',arcShotSub:'НАРИСУЙТЕ ИДЕАЛЬНУЮ ДУГУ',arcReady:'ПРОВЕДИТЕ ДУГУ К КОЛЬЦУ',arcLearn:'СЛЕДУЙТЕ СВЕТЯЩЕЙСЯ ДУГЕ',arcResult:'ДУГА ЗАВЕРШЕНА',shots:'БРОСКИ',point:'ТОЧКА',rhythm:'НАБИВАНИЕ В РИТМ',rhythmSub:'ПОЙМАЙТЕ СВОЙ РИТМ',setRhythm:'ДВА УДАРА ЗАДАДУТ РИТМ',keepRhythm:'ДЕРЖИТЕ РИТМ',rhythmLost:'РИТМ СБИТ',bounces:'УДАРЫ',rhythmBest:'РЕКОРД РИТМА'}
};
const tr=key=>copy[state.language][key];
function refreshBestUI(){document.querySelector('#menu-best-score').textContent=String(state.best).padStart(3,'0')}
function applyAuthenticatedPlayer(){
  const player=authenticatedPlayer?.player;if(!player)return;
  const serverBest=Number(player.bestScore)||0;
  lastServerBest=Math.max(lastServerBest,serverBest);state.best=Math.max(state.best,serverBest);state.league=Number(player.league)||888;localStorage.setItem('basket888-best',state.best);refreshBestUI();
}
function applyLanguage(){
  document.querySelector('#start-button').textContent=tr('start');document.querySelector('#leaderboard-button').textContent=tr('leaderboard');document.querySelector('#settings-button').textContent=tr('settings');document.querySelector('#settings-title').textContent=tr('settings');document.querySelector('#sound-label').textContent=tr('sound');document.querySelector('#language-label').textContent=tr('language');document.querySelector('#back-button').textContent=tr('back');document.querySelector('#your-best-label').textContent=tr('yourBest');document.querySelector('#leaderboard-title').textContent=tr('top100');document.querySelector('#leaderboard-back-button').textContent=tr('back');
  const soundButton=document.querySelector('#sound-toggle');soundButton.textContent=tr(state.sound?'on':'off');soundButton.classList.toggle('is-active',state.sound);
  document.querySelector('#app-version').textContent=`VERSION ${APP_VERSION}`;
  document.querySelector('#modes-kicker').textContent=tr('chooseRun');document.querySelector('#modes-title').textContent=tr('modes');
  document.querySelector('#full-mode-button').querySelector('strong').textContent=tr('fullGame');document.querySelector('#full-mode-button').querySelector('small').textContent=tr('fullGameSub');
  document.querySelector('#endless-mode-button').querySelector('strong').textContent=tr('endless');document.querySelector('#endless-mode-button').querySelector('small').textContent=tr('endlessSub');document.querySelector('#modes-back-button').textContent=tr('back');
  document.querySelector('#arc-mode-button').querySelector('strong').textContent=tr('arcShot');document.querySelector('#arc-mode-button').querySelector('small').textContent=tr('arcShotSub');
  document.querySelector('#rhythm-mode-button').querySelector('strong').textContent=tr('rhythm');document.querySelector('#rhythm-mode-button').querySelector('small').textContent=tr('rhythmSub');
  document.querySelectorAll('.lang-button').forEach(b=>b.classList.toggle('is-active',b.dataset.lang===state.language));
}
function playMenuMusic(){if(state.sound)menuMusic.play().catch(()=>{})}
const modesScreen=document.querySelector('#modes-screen');
function hideScreens(){menuScreen.classList.add('is-hidden');settingsScreen.classList.add('is-hidden');leaderboardScreen.classList.add('is-hidden');modesScreen.classList.add('is-hidden')}
function showMenu(){hideScreens();menuScreen.classList.remove('is-hidden');refreshBestUI();playMenuMusic()}
function showSettings(){hideScreens();settingsScreen.classList.remove('is-hidden');playMenuMusic()}
function showModes(){hideScreens();modesScreen.classList.remove('is-hidden');playMenuMusic()}
async function showLeaderboard(){
  hideScreens();leaderboardScreen.classList.remove('is-hidden');playMenuMusic();
  const list=document.querySelector('#leaderboard-list'),status=document.querySelector('#leaderboard-status');list.replaceChildren();status.textContent=tr('loading');
  try{const response=await fetch(`${TELEGRAM_LEADERBOARD_URL}?league=${state.league}`);const data=await response.json();if(!response.ok)throw Error('leaderboard');
    if(!data.leaderboard.length){const item=document.createElement('li');item.className='leaderboard-empty';item.textContent=tr('noScores');list.append(item)}
    else data.leaderboard.forEach(player=>{const item=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=player.displayName;score.textContent=String(player.bestScore).padStart(3,'0');item.append(name,score);list.append(item)});
    status.textContent=`${data.league} LEAGUE`;
  }catch{status.textContent='OFFLINE';const item=document.createElement('li');item.className='leaderboard-empty';item.textContent=tr('noScores');list.append(item)}
}
function startMode(mode){requestTelegramFullscreen();menuMusic.pause();menuMusic.currentTime=0;hideScreens();state.mode=mode;if(mode==='rhythm')resetRhythm();else reset();playClip(levelCheerAudio,.34,1)}
document.querySelector('#start-button').addEventListener('click',showModes);
document.querySelector('#full-mode-button').addEventListener('click',()=>startMode('full'));
document.querySelector('#endless-mode-button').addEventListener('click',()=>startMode('endless'));
document.querySelector('#arc-mode-button').addEventListener('click',()=>startMode('arc'));
document.querySelector('#rhythm-mode-button').addEventListener('click',()=>startMode('rhythm'));
document.querySelector('#modes-back-button').addEventListener('click',showMenu);
document.querySelector('#leaderboard-button').addEventListener('click',showLeaderboard);
document.querySelector('#settings-button').addEventListener('click',showSettings);
document.querySelector('#back-button').addEventListener('click',showMenu);
document.querySelector('#leaderboard-back-button').addEventListener('click',showMenu);
document.querySelector('#sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;localStorage.setItem('basket888-sound',state.sound?'on':'off');if(state.sound)playMenuMusic();else menuMusic.pause();applyLanguage()});
document.querySelectorAll('.lang-button').forEach(b=>b.addEventListener('click',()=>{state.language=b.dataset.lang;localStorage.setItem('basket888-language',state.language);applyLanguage()}));
menuScreen.addEventListener('pointerdown',event=>{playMenuMusic();if(event.target.closest('#start-button'))requestTelegramFullscreen()},{once:true});settingsScreen.addEventListener('pointerdown',playMenuMusic,{once:true});applyLanguage();refreshBestUI();

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
  const endlessScale=state.mode==='endless'?Math.max(.34,1-state.endlessDifficulty*.01):1;
  state.targetWidth=Math.max(.035,baseWidth*(1-(state.level-1)*.055)*endlessScale);
  if(state.mode==='endless')state.markerSpeed*=1+state.endlessDifficulty*.01;
  const margin=state.targetWidth/2+.035;state.target=margin+Math.random()*(1-margin*2);
  state.targetDirection=Math.random()<.5?-1:1;
}
randomizeShot();

function tone(freq, duration, type = 'sine', volume = .05, delay = 0) {
  if (!state.sound) return;
  audio ||= new (window.AudioContext || window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume().catch(()=>{});
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + delay;
  o.type = type; o.frequency.setValueAtTime(freq, t); g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(.001, t + duration); o.connect(g).connect(audio.destination);
  o.start(t); o.stop(t + duration);
}
function swish() {
  playClip(swishAudio,.41,1);
}
function playRhythmBounce(rate=1){
  if(!state.sound)return;
  playClip(dribbleAudio,.92,rate);
  tone(86,.11,'sine',.14);
  tone(172,.045,'triangle',.055,.008);
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
  if(state.mode==='arc'){text(tr('arcShot'),W/2,sy+sh*.42,Math.max(10,sh*.28),'950','#ff713d');text(`${state.arcScene+1}/5  ·  ${tr('shots')} ${Math.min(state.arcAttempt+1,3)}/3`,W/2,sy+sh*.75,Math.max(6,sh*.13),'900','#8deeff');return}
  if(state.mode==='endless'){text(tr('endless'),W/2,sy+sh*.42,Math.max(10,sh*.28),'950','#ff713d');text(`${tr('misses')} ${state.endlessMisses}/3`,W/2,sy+sh*.75,Math.max(6,sh*.13),'900','#8deeff');return}
  const seconds=Math.max(0,Math.ceil(state.levelTime)),clock=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`,dh=sh*.48;
  let total=0;for(const c of clock)total+=c===':'?dh*.56*.38:dh*.56;total+=(clock.length-1)*dh*.10;
  let x=W/2-total/2,y=sy+sh*.27;for(const c of clock){const used=sevenDigit(c,x,y,dh);x+=used+dh*.10}
  text(`${tr('level')} ${state.level}`,W/2,sy+sh*.82,Math.max(6,sh*.13),'900','#8deeff');
}
function begin() {
  if(state.mode==='rhythm'){rhythmTap();return}
  if (state.phase === 'over') { reset(); showMenu(); return; }
  if (state.phase === 'levelIntro') { state.phase='ready';state.gameStarted=true;state.lastDribbleCycle=(state.time*1.55)%1;return; }
  if (state.phase !== 'ready') return;
  state.phase='aim'; state.shotStartY=state.spawnY-.105; state.message='BUILD YOUR SHOT'; state.sub='Release at the sweet spot'; tone(160,.08,'sine',.025);
}
function release() {
  if(state.mode==='arc')return;
  if(state.phase !== 'aim') return;
  state.phase='flight'; state.shots++;
  const accuracy = Math.abs(state.power - state.target); state.hit = accuracy < state.targetWidth / 2;
  state.perfect = accuracy < state.targetWidth * .18; state.flightT=0; state.startPower=state.power;
  state.trail=[];
  tone(240,.12,'triangle',.04); haptic('light');
}
function arcScene(){return arcScenes[state.arcOrder[state.arcScene]??0]}
function arcStart(){return{x:W*arcScene().ball[0],y:H*arcScene().ball[1]}}
function arcHoop(){return{x:W*arcScene().hoop[0],y:H*arcScene().hoop[1]}}
function cubic(a,b,c,d,t){const u=1-t;return{x:u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x,y:u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y}}
function arcCurve(t){const a=arcStart(),d=arcHoop(),dx=d.x-a.x,dy=d.y-a.y;return cubic(a,{x:a.x+dx*.14,y:a.y-H*.43},{x:d.x-dx*.28,y:d.y+H*.10},d,t)}
function closestArcPoint(point){let best={distance:Infinity,t:0};for(let i=0;i<=40;i++){const t=i/40,p=arcCurve(t),distance=Math.hypot(point.x-p.x,point.y-p.y);if(distance<best.distance)best={distance,t}}return best}
function pointerPosition(event){const box=canvas.getBoundingClientRect();return{x:(event.clientX-box.left)*(W/box.width),y:(event.clientY-box.top)*(H/box.height)}}
function finishArcAttempt(hit){
  state.arcAttempt++;state.arcPath=[];state.hit=hit;
  if(hit){state.arcSuccesses++;state.score+=3;state.best=Math.max(state.best,state.score);localStorage.setItem('basket888-best',state.best);syncBestScore();state.message='BUCKET +3';state.sub='Clean curve'}
  else {state.message='OFF ARC';state.sub='Find the line to the rim'}
  if(state.arcAttempt>=3){
    if(state.arcScene<arcScenes.length-1){state.arcScene++;state.arcAttempt=0;const start=arcStart();state.spawnX=start.x/W;state.spawnY=start.y/H;state.phase='levelIntro';state.gameStarted=false;state.message=tr('arcReady');state.sub=`${tr('shots')} ${state.arcScene+1}/5`;return}
    state.phase='over';state.gameStarted=false;state.gameOverTime=7;state.best=Math.max(state.best,state.score);refreshBestUI();syncBestScore(true);return
  }
  state.phase='result';state.messageTime=.75;
}
function validateArc(path){
  const start=arcStart(),hoop=arcHoop(),end=path.at(-1);
  if(path.length<6||Math.hypot(path[0].x-start.x,path[0].y-start.y)>Math.max(44,W*.10)||Math.hypot(end.x-hoop.x,end.y-hoop.y)>Math.max(58,W*.16))return false;
  const direct=Math.hypot(hoop.x-start.x,hoop.y-start.y),length=path.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-path[i].x,p.y-path[i].y),0);
  const apex=Math.min(...path.slice(1,-1).map(point=>point.y));
  // It only needs to rise visibly above the rim and be longer than a direct line.
  // This deliberately tolerates different, natural-looking hand-drawn arcs.
  const hasArc=length>direct*1.025 && apex<Math.min(start.y,hoop.y)-H*.035;
  const tail=path[Math.max(0,path.length-5)],entry={x:end.x-tail.x,y:end.y-tail.y};
  // A generous entry window rewards a clearly downward finish without demanding a pixel-perfect stroke.
  const verticalEntry=entry.y>Math.max(7,H*.009)&&Math.abs(entry.x)<=entry.y*1.15;
  return hasArc&&verticalEntry;
}
function arcImpactPoint(path,willScore){
  const hoop=arcHoop();if(willScore)return hoop;
  const end=path.at(-1),offset=Math.max(-W*.07,Math.min(W*.07,(end.x-hoop.x)*.25));return{x:hoop.x+offset,y:hoop.y-H*.045};
}
function beginArc(event){
  if(state.phase==='levelIntro'){begin();return}
  if(state.phase!=='ready')return;const point=pointerPosition(event),start=arcStart();
  if(Math.hypot(point.x-start.x,point.y-start.y)>Math.max(34,ballRadiusForDepth()+15)){state.message='START AT BALL';state.sub='Touch the ball, then draw';return}
  state.phase='arcDraw';state.arcPath=[point];canvas.setPointerCapture?.(event.pointerId);
}
function moveArc(event){if(state.mode!=='arc'||state.phase!=='arcDraw')return;const point=pointerPosition(event),last=state.arcPath.at(-1);if(!last||Math.hypot(point.x-last.x,point.y-last.y)>3)state.arcPath.push(point)}
function releaseArc(event){
  if(state.mode!=='arc'||state.phase!=='arcDraw')return false;const point=pointerPosition(event),last=state.arcPath.at(-1);if(!last||Math.hypot(point.x-last.x,point.y-last.y)>2)state.arcPath.push(point);
  state.arcWillScore=validateArc(state.arcPath);const impact=arcImpactPoint(state.arcPath,state.arcWillScore),flightPath=[...state.arcPath];
  if(Math.hypot(flightPath.at(-1).x-impact.x,flightPath.at(-1).y-impact.y)>3)flightPath.push(impact);
  state.arcFlightPath=flightPath;state.arcFlightT=0;state.phase='arcFlight';return true;
}
function resetRhythm(){
  Object.assign(state,{score:0,phase:'rhythmReady',rhythmScore:0,rhythmInterval:0,rhythmLastTap:0,rhythmTolerance:0,rhythmFailedAt:0,rhythmPulse:0,rhythmFall:null,trail:[],message:tr('setRhythm'),sub:''});
}
function rhythmFloor(){return H*.80}
function rhythmBallPosition(){
  const x=W*.5, floor=rhythmFloor();
  if(state.phase==='rhythmOver'&&state.rhythmFall)return state.rhythmFall;
  if(state.phase!=='rhythmPlaying'||!state.rhythmInterval){const lift=(1+Math.sin(state.time*3.4))*H*.018;return{x,y:floor-lift};}
  const phase=Math.max(0,Math.min(1,(state.time-state.rhythmLastTap)/state.rhythmInterval));
  return{x,y:floor-Math.sin(Math.PI*phase)*H*.17};
}
function failRhythm(){
  if(state.phase==='rhythmOver')return;
  const p=rhythmBallPosition();
  state.phase='rhythmOver';state.rhythmFailedAt=state.time;state.rhythmFall={x:p.x,y:p.y,vx:(Math.random()<.5?-1:1)*W*.19,vy:-H*.12,bounces:0};
  state.rhythmBest=Math.max(state.rhythmBest,state.rhythmScore);localStorage.setItem('basket888-rhythm-best',state.rhythmBest);
  playClip(buzzerAudio,.34,1.18);tone(58,.16,'sawtooth',.09);haptic('heavy');state.shake=5;
}
function rhythmTap(){
  if(state.phase==='rhythmOver'){if(state.time-state.rhythmFailedAt>.45)showModes();return}
  if(state.phase==='rhythmReady'){
    state.phase='rhythmPlaying';state.rhythmScore=1;state.score=1;state.rhythmLastTap=state.time;state.rhythmPulse=1;playRhythmBounce(1);haptic('light');return;
  }
  if(state.phase!=='rhythmPlaying')return;
  const elapsed=state.time-state.rhythmLastTap;
  if(!state.rhythmInterval){
    if(elapsed<.07){failRhythm();return}
    state.rhythmInterval=elapsed;state.rhythmTolerance=Math.max(.028,elapsed*.22);
  }else{
    if(Math.abs(elapsed-state.rhythmInterval)>state.rhythmTolerance){failRhythm();return}
    state.rhythmInterval=state.rhythmInterval*.82+elapsed*.18;
    state.rhythmTolerance=Math.max(.025,state.rhythmTolerance*.985);
  }
  state.rhythmLastTap=state.time;state.rhythmScore++;state.score=state.rhythmScore;state.rhythmPulse=1;
  playRhythmBounce(Math.max(.82,Math.min(1.35,1/state.rhythmInterval*.48)));haptic('light');
}
function reset(){
  const shuffledArcOrder=[...arcScenes.keys()].sort(()=>Math.random()-.5);
  Object.assign(state,{score:state.mode==='full'&&state.league===8888?state.best:0,streak:0,phase:'levelIntro',power:0,direction:1,shots:0,hits:0,level:1,levelTime:24,gameStarted:false,gameOverTime:0,message:'HOLD TO SHOOT',sub:'Find the moving sweet spot',finalRank:null,endlessShots:0,endlessMisses:0,endlessDifficulty:0,arcScene:0,arcOrder:state.mode==='arc'?shuffledArcOrder:state.arcOrder,arcAttempt:0,arcSuccesses:0,arcPath:[],arcFlightPath:[],arcFlightT:0,arcWillScore:false});
  if(state.mode==='arc'){const start=arcStart();state.spawnX=start.x/W;state.spawnY=start.y/H;configureDifficulty()}else randomizeShot();
}
async function syncBestScore(final=false){
  if(final)finalRankRequested=true;
  if(bestScoreSyncInFlight||!telegram?.initData||(!finalRankRequested&&state.score<=lastServerBest))return;
  const scoreToSync=state.score;bestScoreSyncInFlight=true;
  let saved=false;
  try{
    const response=await fetch(TELEGRAM_SCORE_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:telegram.initData,score:scoreToSync})});
    if(!response.ok)return;const data=await response.json();authenticatedPlayer={player:data.player};lastServerBest=Math.max(lastServerBest,Number(data.player.bestScore)||0);state.best=Math.max(state.best,lastServerBest);state.league=Number(data.player.league)||888;if(finalRankRequested)state.finalRank=Number(data.rank)||null;finalRankRequested=false;localStorage.setItem('basket888-best',state.best);refreshBestUI();saved=true;
  }catch{/* A local best is kept when the player is offline. */}
  finally{bestScoreSyncInFlight=false;if(saved&&state.score>lastServerBest)syncBestScore(final)}
}
canvas.addEventListener('pointerdown', e=>{e.preventDefault();requestTelegramFullscreen();if(state.mode==='rhythm')rhythmTap();else if(state.mode==='arc')beginArc(e);else begin()});
canvas.addEventListener('pointermove',moveArc);canvas.addEventListener('pointerup',e=>{if(!releaseArc(e))release()});canvas.addEventListener('pointercancel',e=>{if(state.mode==='arc'&&state.phase==='arcDraw')finishArcAttempt(false)});canvas.addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('keydown',e=>{ if(e.code==='Space'){e.preventDefault(); if(!e.repeat)begin()} if(e.key.toLowerCase()==='m')state.sound=!state.sound });
addEventListener('keyup',e=>{if(e.code==='Space'&&state.mode!=='rhythm')release()});

function finishShot(){
  if(state.hit){
    state.hits++; state.streak++; const multiplier=1+Math.floor((state.level-1)/3),pts=state.shotValue*multiplier; state.score += pts;
    state.best=Math.max(state.best,state.score); localStorage.setItem('basket888-best',state.best);
    syncBestScore();
    state.message=state.perfect?`PERFECT +${pts}`:`BUCKET +${pts}`; state.sub=state.streak>1?`${state.streak}× streak · keep cooking`:'Clean release';
    haptic('medium'); state.shake=2.5;
  } else {
    state.streak=0; state.message=state.startPower<.6?'TOO EARLY':'OFF TARGET'; state.sub='Reset. Breathe. Shoot again.';
    haptic('heavy');
  }
  if(state.mode==='endless'){
    state.endlessShots++;state.endlessDifficulty++;
    if(!state.hit)state.endlessMisses++;
    configureDifficulty();
    if(state.endlessMisses>=3){state.phase='over';state.gameStarted=false;state.gameOverTime=7;state.best=Math.max(state.best,state.score);localStorage.setItem('basket888-best',state.best);refreshBestUI();syncBestScore(true);return}
  }
  state.phase='result'; state.messageTime=.08;
}
function flightPosition(t=state.flightT){
  t=Math.min(1,t);const sx=W*state.spawnX,sy=H*(state.shotStartY??state.spawnY-.105),ex=state.hit?W*.5:W*(state.startPower < state.target ? .34 : .7),ey=H*.31;
  const perspective=Math.pow(t,.78);
  return{x:sx+(ex-sx)*t,y:sy+(ey-sy)*t-Math.sin(Math.PI*t)*H*.27,r:ballRadiusForDepth()-(perspective*(ballRadiusForDepth()-9))};
}
function startBounce(){
  const p=flightPosition(1), side=p.x<W/2?-1:1;
  playClip(missAudio,.48,.98+Math.random()*.04);
  state.bounce={x:p.x,y:p.y,vx:side*(65+Math.random()*45),vy:40,count:0};state.phase='bounce';
}
function update(dt){
  state.time+=dt;
  if(state.mode==='rhythm'){
    state.rhythmPulse=Math.max(0,state.rhythmPulse-dt*3.6);
    if(state.phase==='rhythmPlaying'&&state.rhythmInterval&&state.time-state.rhythmLastTap>state.rhythmInterval+state.rhythmTolerance)failRhythm();
    if(state.phase==='rhythmOver'&&state.rhythmFall){
      const b=state.rhythmFall;b.vy+=H*1.7*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;
      const floor=rhythmFloor();
      if(b.y>=floor&&b.bounces<2){b.y=floor;b.vy=-Math.abs(b.vy)*.44;b.vx*=.68;b.bounces++;playClip(dribbleAudio,.4,.78+b.bounces*.08)}
    }
    state.shake*=Math.pow(.02,dt);return;
  }
  if(state.mode==='full'&&state.gameStarted&&state.phase!=='over'){
    state.levelTime-=dt;
    if(state.levelTime<=0){
      playClip(buzzerAudio,.58,1);
      if(state.level>=10){state.levelTime=0;state.phase='over';state.gameStarted=false;state.gameOverTime=6;state.best=Math.max(state.best,state.score);localStorage.setItem('basket888-best',state.best);refreshBestUI();syncBestScore(true)}
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
  if((state.level>=4||state.mode==='endless')&&(state.phase==='ready'||state.phase==='aim')){
    const zoneSpeed=(state.mode==='endless'?.035+state.endlessDifficulty*.010:.035+(state.level-4)*.020),margin=state.targetWidth/2+.025;
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
  if(state.phase==='arcFlight'){
    state.arcFlightT+=dt/.62;const path=state.arcFlightPath,position=path[Math.min(path.length-1,Math.floor(state.arcFlightT*(path.length-1)))];
    if(position)state.trail.push({x:position.x,y:position.y,life:1});
    if(state.arcFlightT>=1){if(state.arcWillScore){swish();finishArcAttempt(true)}else{playClip(missAudio,.48,.98+Math.random()*.04);state.shake=3;finishArcAttempt(false)}}
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
  if(state.phase==='result'){ state.messageTime-=dt; if(state.messageTime<=0){state.phase='ready';state.power=0;state.direction=1;if(state.mode==='full'||state.mode==='endless'){if(state.hit)randomizeShot()}state.trail=[];state.message=state.mode==='arc'?tr('arcReady'):'READY';state.sub=state.mode==='arc'?'Draw from the ball to the rim':'Watch the sweet spot'} }
  state.trail.forEach(p=>p.life-=dt*1.8);state.trail=state.trail.filter(p=>p.life>0);
  state.shake*=Math.pow(.02,dt);
}

function court(){
  if(state.mode==='arc'){const scene=arcScene();if(scene.image.complete&&scene.image.naturalWidth)ctx.drawImage(scene.image,0,0,W,H);else ctx.fillStyle='#081520',ctx.fillRect(0,0,W,H);return}
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
  text(String(state.league),slashX+slashWidth+gap,hudY+7,29,'900','#ff7b39','left');
  text(tr('best'),W-112,hudY-14,9,'800','rgba(255,255,255,.5)','left');
  text(String(state.best).padStart(3,'0'),W-112,hudY+7,25,'900','#fff','left');
  if(state.mode==='arc'){text(`${state.arcScene+1}/5 · ${tr('shots')} ${Math.min(state.arcAttempt+1,3)}/3`,W/2,hudY-12,10,'900','#ffb15e');return}
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
  if(state.mode==='arc'){text(tr('arcShot'),W/2,H*.47,27,'950','#ff9b55');text(`${tr('point')} ${state.arcScene+1} / 5`,W/2,H*.525,12,'900','#75e8ff');text(state.arcScene===0?tr('arcLearn'):tr('arcReady'),W/2,H*.575,11,'800','rgba(255,255,255,.76)');text(tr('tapStart'),W/2,H*.635,11,'800','rgba(255,255,255,.68)');return}
  if(state.mode==='endless'){text(tr('endless'),W/2,H*.49,29,'950','#ff713d');text(tr('endlessReady'),W/2,H*.57,11,'800','rgba(255,255,255,.76)');text(tr('tapStart'),W/2,H*.63,11,'800','rgba(255,255,255,.68)');return}
  text(tr('level'),W/2,H*.49,14,'900','#7ceaff');
  text(String(state.level),W/2,H*.555,62,'900','#fff');
  text(tr('tapStart'),W/2,H*.63,11,'800','rgba(255,255,255,.68)');
}
function gameOverOverlay(){
  if(state.phase!=='over')return;
  ctx.fillStyle='rgba(2,8,18,.76)';ctx.fillRect(0,0,W,H);
  if(state.mode==='arc'){text(tr('arcResult'),W/2,H*.42,13,'900','#75e8ff');text(`${state.arcSuccesses}/15`,W/2,H*.485,54,'900',state.arcSuccesses===15?'#64ffb2':'#fff');text(`${tr('score')}  ${String(state.score).padStart(3,'0')}`,W/2,H*.54,14,'900','#ff9b55');text(`${tr('best')}  ${String(state.best).padStart(3,'0')}`,W/2,H*.59,17,'900','#75e8ff');text(`${tr('returning')} · ${Math.max(1,Math.ceil(state.gameOverTime))}`,W/2,H*.65,10,'800','rgba(255,255,255,.55)');return}
  if(state.mode==='endless'){
    text(tr('endlessOver'),W/2,H*.42,13,'900','#75e8ff');text(String(state.score),W/2,H*.485,54,'900','#fff');
    text(`${tr('misses')}  ${state.endlessMisses}/3`,W/2,H*.54,13,'900','#ff9b55');text(`${tr('best')}  ${String(state.best).padStart(3,'0')}`,W/2,H*.59,17,'900','#75e8ff');
    text(`${tr('returning')} · ${Math.max(1,Math.ceil(state.gameOverTime))}`,W/2,H*.65,10,'800','rgba(255,255,255,.55)');return
  }
  text(tr('complete'),W/2,H*.42,12,'900','#75e8ff');
  text(String(state.score),W/2,H*.485,54,'900',state.score>=888?'#64ffb2':'#fff');
  text(state.score>=888?tr('conquered'):tr('final'),W/2,H*.535,14,'900',state.score>=888?'#ff9b55':'rgba(255,255,255,.68)');
  text(`${tr('best')}  ${String(state.best).padStart(3,'0')}`,W/2,H*.585,17,'900','#75e8ff');
  if(state.finalRank)text(`${tr('worldRank')}  #${state.finalRank}`,W/2,H*.625,13,'900','#ffb15e');
  text(`${tr('returning')} · ${Math.max(1,Math.ceil(state.gameOverTime))}`,W/2,state.finalRank?H*.67:H*.65,10,'800','rgba(255,255,255,.55)');
  text(tr('again'),W/2,state.finalRank?H*.71:H*.69,9,'800','rgba(255,255,255,.42)');
}
function idleDribble(){
  const cycle=(state.time*1.55)%1;
  const lift=4*cycle*(1-cycle);
  return{x:W*state.spawnX,y:H*(state.spawnY-lift*.105)};
}
function draw(){
  if(state.mode==='rhythm'){drawRhythm();return}
  ctx.save();ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);court();drawScoreboard();
  if(state.phase!=='levelIntro'&&state.phase!=='over')player();
  if(state.mode==='arc'&&state.arcScene===0&&state.arcAttempt===0&&(state.phase==='ready'||state.phase==='arcDraw')){ctx.save();ctx.strokeStyle='rgba(103,232,255,.38)';ctx.lineWidth=Math.max(24,W*.105);ctx.lineCap='round';ctx.beginPath();for(let i=0;i<=40;i++){const p=arcCurve(i/40);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)}ctx.stroke();ctx.strokeStyle='#72ffe4';ctx.lineWidth=2.5;ctx.shadowColor='#4cf7ff';ctx.shadowBlur=14;ctx.stroke();ctx.restore()}
  if(state.mode==='arc'&&state.arcPath.length>1){ctx.save();ctx.strokeStyle=state.phase==='arcDraw'?'#fff':'rgba(255,109,73,.7)';ctx.lineCap='round';ctx.lineJoin='round';ctx.lineWidth=5;ctx.shadowColor='#5cecff';ctx.shadowBlur=10;ctx.beginPath();state.arcPath.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();ctx.restore()}
  if(state.trail.length>1){ctx.save();ctx.lineCap='round';for(let i=1;i<state.trail.length;i++){const a=state.trail[i-1],b=state.trail[i];ctx.globalAlpha=b.life*.55;ctx.strokeStyle='#67e8ff';ctx.lineWidth=Math.max(1,7*b.life);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()}ctx.restore()}
  if(state.phase==='arcFlight'){
    const path=state.arcFlightPath,p=path[Math.min(path.length-1,Math.floor(state.arcFlightT*(path.length-1)))];if(p)ball(p.x,p.y,Math.max(9,ballRadiusForDepth()*(1-state.arcFlightT*.42)));
  } else if(state.phase==='flight'){
    const p=flightPosition();ball(p.x,p.y,p.r);
  } else if(state.phase==='swish') {
    const t=Math.min(1,state.swishT),x=W*.5+Math.sin(t*Math.PI)*W*.008,y=H*(.31+t*.13);
    ball(x,y,9-t*1.5);
  } else if(state.phase==='bounce') {
    const depth=Math.max(0,Math.min(1,(state.bounce.y-H*.31)/(H*.88-H*.31)));
    ball(state.bounce.x,state.bounce.y,12+depth*16);
  } else if(state.phase==='ready') {
    const d=idleDribble();
    ball(d.x,d.y,ballRadiusForDepth());
  } else if(state.phase==='aim'||state.phase==='result') ball(W*state.spawnX,H*(state.spawnY-.105),ballRadiusForDepth());
  ctx.globalAlpha=1;hud();levelIntroOverlay();gameOverOverlay();ctx.restore();
}
function drawRhythm(){
  ctx.save();ctx.translate((Math.random()-.5)*state.shake,(Math.random()-.5)*state.shake);
  if(rhythmBackground.complete&&rhythmBackground.naturalWidth)ctx.drawImage(rhythmBackground,0,0,W,H);
  else {const g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#101333');g.addColorStop(1,'#071722');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
  const shade=ctx.createLinearGradient(0,0,0,H);shade.addColorStop(0,'rgba(3,8,24,.1)');shade.addColorStop(1,'rgba(3,8,24,.42)');ctx.fillStyle=shade;ctx.fillRect(0,0,W,H);
  const hudY=H*.075;
  text(tr('bounces'),24,hudY-14,9,'800','rgba(255,255,255,.58)','left');text(String(state.rhythmScore).padStart(3,'0'),24,hudY+8,30,'900','#fff','left');
  text(tr('rhythmBest'),W-118,hudY-14,9,'800','rgba(255,255,255,.58)','left');text(String(state.rhythmBest).padStart(3,'0'),W-118,hudY+8,26,'900','#9aefff','left');
  if(state.rhythmInterval)text(`${Math.round(60/state.rhythmInterval)} BPM`,W/2,hudY+2,14,'950','#ffb365');
  const floor=rhythmFloor();ctx.save();ctx.globalAlpha=.75;ctx.strokeStyle='rgba(87,230,255,.52)';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(W*.5,floor+20,W*.10,W*.018,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  const p=rhythmBallPosition(),radius=Math.max(14,W*.05)*(1+state.rhythmPulse*.08);ball(p.x,p.y,radius);
  if(state.phase==='rhythmReady'){text(tr('rhythm'),W/2,H*.64,24,'950','#fff');text(tr('setRhythm'),W/2,H*.69,11,'900','#91eaff');text(tr('tapStart'),W/2,H*.74,10,'800','rgba(255,255,255,.72)')}
  else if(state.phase==='rhythmPlaying'){text(state.rhythmInterval?tr('keepRhythm'):tr('setRhythm'),W/2,H*.90,12,'950','#fff')}
  else if(state.phase==='rhythmOver'){
    ctx.fillStyle='rgba(1,6,16,.58)';ctx.fillRect(0,0,W,H);text(tr('rhythmLost'),W/2,H*.44,26,'950','#ff825f');text(`${tr('bounces')}  ${state.rhythmScore}`,W/2,H*.50,15,'900','#fff');text(`${tr('rhythmBest')}  ${state.rhythmBest}`,W/2,H*.545,13,'900','#9aefff');text(tr('tapStart'),W/2,H*.63,10,'800','rgba(255,255,255,.75)');
  }
  ctx.restore();
}
let last=performance.now();function loop(now){const dt=Math.min(.033,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
