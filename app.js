/* 《猜猜我》MVP v2 — 题库随机抽题 + 双向自答互猜
 * 隐私红线：不发起网络请求；数据只经 URL Fragment 与内存。
 */
(function () {
  'use strict';
  var VERSION=3,Q_COUNT=5,OPT_COUNT=4,HASH_MAX=64000,JSON_MAX=30000;
  var LETTERS=['A','B','C','D'];
  var screens={home:$('screen-home'),answer:$('screen-answer'),share:$('screen-share'),result:$('screen-result'),error:$('screen-error')};
  var session={stage:0,payload:null};
  function $(id){return document.getElementById(id);}
  function show(n){Object.keys(screens).forEach(function(k){screens[k].classList.toggle('hidden',k!==n);});window.scrollTo(0,0);}
  function error(){session.stage=0;session.payload=null;show('error');}
  function encode(o){var bytes=new TextEncoder().encode(JSON.stringify(o)),bin='';for(var i=0;i<bytes.length;i++)bin+=String.fromCharCode(bytes[i]);return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function decode(s){if(s.length>HASH_MAX||!/^[A-Za-z0-9_-]+$/.test(s))throw Error();var b=s.replace(/-/g,'+').replace(/_/g,'/');while(b.length%4)b+='=';var bin=atob(b),bytes=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);var t=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(t.length>JSON_MAX)throw Error();return t;}
  function bankMap(){
    var m=Object.create(null);(window.GUESS_ME_BANK||[]).forEach(function(q){if(q&&typeof q.id==='string'&&!m[q.id])m[q.id]=q;});return m;
  }
  function idsExist(ids){var m=bankMap();return Array.isArray(ids)&&ids.length===Q_COUNT&&ids.every(function(id){return typeof id==='string'&&!!m[id]&&m[id].enabled!==false;});}
  function disjoint(a,b){var m=Object.create(null);a.forEach(function(id){m[id]=true;});return b.every(function(id){return !m[id];});}
  function validIds(a){return Array.isArray(a)&&a.length===Q_COUNT&&idsExist(a)&&a.every(function(x,i){return a.indexOf(x)===i;});}
  function validAnswers(a){return Array.isArray(a)&&a.length===Q_COUNT&&a.every(function(x){return Number.isInteger(x)&&x>=0&&x<OPT_COUNT;});}
  function questionsFromIds(ids){var m=bankMap();return ids.map(function(id){var q=m[id];return {id:q.id,c:q.c,question:q.q,options:q.o.slice()};});}
  function validate(o){
    if(!o||typeof o!=='object'||o.pv!==VERSION||o.bv!==window.QUESTION_BANK_VERSION)return null;
    if(o.st===1){if(!validIds(o.q)||!validAnswers(o.a))return null;return o;}
    if(o.st===2){if(!validIds(o.q)||!validIds(o.bq)||!disjoint(o.q,o.bq)||!validAnswers(o.a)||!validAnswers(o.ba)||!validAnswers(o.bg))return null;return o;}
    return null;
  }
  function url(f){return location.href.split('#')[0]+'#'+f;}
  function sampleQuestions(exclude){
    var excluded=Object.create(null);(exclude||[]).forEach(function(id){excluded[id]=true;});
    var byCat=Object.create(null);
    window.GUESS_ME_BANK.forEach(function(q){if(q.enabled!==false&&!excluded[q.id]){(byCat[q.c]||(byCat[q.c]=[])).push(q);}});
    var catKeys=Object.keys(byCat);if(catKeys.length<Q_COUNT)throw Error('ERR_BANK_TOO_SMALL');var cats=catKeys.sort(function(){return Math.random()-.5;}).slice(0,Q_COUNT),out=[];
    cats.forEach(function(c){var a=byCat[c];out.push(a[Math.floor(Math.random()*a.length)]);});
    return out;
  }
  function cloneQs(qs){return qs.map(function(q){return {id:q.id,c:q.c,question:q.q,options:q.o.slice()};});}
  function renderSelfQuiz(questions,role){
    var wrap=$('answer-form');wrap.innerHTML='';$('answer-error').textContent='';
    questions.forEach(function(q,i){
      var box=document.createElement('div');box.className='ans-q';
      var title=document.createElement('p');title.className='ans-title';title.textContent=(i+1)+'. '+q.question;box.appendChild(title);
      q.options.forEach(function(opt,j){var lab=document.createElement('label');lab.className='ans-opt';var inp=document.createElement('input');inp.type='radio';inp.name='answer-'+i;inp.value=j;
        inp.addEventListener('change',function(){lab.parentElement.querySelectorAll('.ans-opt').forEach(function(e){e.classList.remove('selected');});lab.classList.add('selected');updateProgress();});
        lab.appendChild(inp);lab.appendChild(document.createTextNode(opt));box.appendChild(lab);});
      wrap.appendChild(box);
    });
    $('answer-title').textContent=role==='A'?'先选出“你自己的答案”':'先选出“你自己的答案”';
    $('answer-sub').textContent='这 5 题是从内置精选题库随机抽取的。先选最像你自己的答案。';
    $('btn-submit-answers').textContent='确定我的答案';
    $('btn-submit-answers').disabled=true;
  }
  function renderGuess(questions){
    var wrap=$('answer-form');wrap.innerHTML='';$('answer-error').textContent='';
    questions.forEach(function(q,i){
      var box=document.createElement('div');box.className='ans-q';
      var title=document.createElement('p');title.className='ans-title';title.textContent=(i+1)+'. '+q.question;box.appendChild(title);
      q.options.forEach(function(opt,j){var lab=document.createElement('label');lab.className='ans-opt';var inp=document.createElement('input');inp.type='radio';inp.name='answer-'+i;inp.value=j;
        inp.addEventListener('change',function(){lab.parentElement.querySelectorAll('.ans-opt').forEach(function(e){e.classList.remove('selected');});lab.classList.add('selected');updateProgress();});
        lab.appendChild(inp);lab.appendChild(document.createTextNode(opt));box.appendChild(lab);});
      wrap.appendChild(box);
    });
    $('answer-title').textContent='猜 TA 的答案';
    $('answer-sub').textContent='凭你对 TA 的了解，选出你认为 TA 会选的答案。';
    $('btn-submit-answers').textContent='提交猜测';
    $('btn-submit-answers').disabled=true;
  }
  function updateProgress(){var done=0;for(var i=0;i<Q_COUNT;i++)if($('answer-form').querySelector('input[name="answer-'+i+'"]:checked'))done++;$('answer-sub').textContent=$('answer-sub').textContent.replace(/已选择 \d+ \/ 5。/,'')+' 已选择 '+done+' / 5。';$('btn-submit-answers').disabled=done<Q_COUNT;}
  function collect(){var a=[];for(var i=0;i<Q_COUNT;i++){var x=$('answer-form').querySelector('input[name="answer-'+i+'"]:checked');if(!x)return null;a.push(Number(x.value));}return a;}
  function setShare(kind,frag){
    $('share-title').textContent=kind==='toB'?'把链接发给对方':'把链接发回给对方';
    $('share-sub').textContent=kind==='toB'?'TA 打开后会先猜你的 5 个答案，然后回答 TA 自己的 5 个题。':'对方打开后会猜你的 5 个答案，之后双方结果揭晓。';
    $('share-url').value=url(frag);$('copy-feedback').textContent='';
    $('btn-native-share').classList.toggle('hidden',typeof navigator.share!=='function');show('share');
  }
  function copy(){var u=$('share-url').value,done=function(){$('copy-feedback').textContent='链接已复制，发给对方即可。';},fail=function(){$('copy-feedback').textContent='复制失败，请手动复制上方链接。';$('share-url').focus();$('share-url').select();};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(u).then(done,function(){legacy(u)?done():fail();});else legacy(u)?done():fail();}
  function legacy(t){try{var x=$('share-url');x.focus();x.select();x.setSelectionRange(0,t.length);return document.execCommand('copy');}catch(e){return false;}}
  function nativeShare(){try{navigator.share({title:'猜猜我',text:'来玩「猜猜我」：看看你有多懂我！',url:$('share-url').value}).catch(copy);}catch(e){copy();}}
  function result(){
    var p=session.payload,ar=0,br=0,detail=$('result-detail');detail.innerHTML='';
    var aQuestions=questionsFromIds(p.q),bQuestions=questionsFromIds(p.bq);p.bg.forEach(function(x,i){var ok=x===p.a[i];if(ok)ar++;appendDetail(detail,aQuestions[i],x,p.a[i],ok,'你');});
    p.aGuesses.forEach(function(x,i){var ok=x===p.ba[i];if(ok)br++;appendDetail(detail,bQuestions[i],x,p.ba[i],ok,'TA');});
    $('score-a').textContent=ar+'/5';$('score-b').textContent=br+'/5';$('score-a-label').textContent='TA 猜中你的答案';$('score-b-label').textContent='你猜中 TA 的答案';detail.classList.add('hidden');$('btn-detail-toggle').textContent='逐题对照 ▾';show('result');
  }
  function appendDetail(container,q,given,actual,ok,who){var other=who==='你'?'TA':'你';var p=document.createElement('p');p.className='detail-item';p.innerHTML='<b>'+escapeHtml(q.question)+'</b><br><span class="'+(ok?'mark-right':'mark-wrong')+'">'+(ok?'✓ 猜对了：'+LETTERS[actual]+'（'+escapeHtml(q.options[actual])+'）':'✗ 猜错：'+who+'实际选 '+LETTERS[actual]+'（'+escapeHtml(q.options[actual])+'），'+other+'选了 '+LETTERS[given]+'（'+escapeHtml(q.options[given])+'）')+'</span>';container.appendChild(p);}
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function reset(){if(location.hash)history.replaceState(null,'',location.pathname+location.search);session={stage:0,payload:null};show('home');}
  function start(){var qs=cloneQs(sampleQuestions());renderSelfQuiz(qs,'A');session.stage=0;session.payload={pv:VERSION,st:1,role:'A_SELF',q:qs.map(function(q){return q.id;}),a:[]};show('answer');}
  function submit(){
    var a=collect();if(!a){$('answer-error').textContent='还有题目没选。';return;}
    var p=session.payload;
    if(p.st===1&&p.role==='A_SELF'){p.a=a;setShare('toB',encode({pv:VERSION,bv:window.QUESTION_BANK_VERSION,st:1,q:p.q,a:a}));return;}
    if(p.st===1&&p.role==='B_GUESS'){p.bg=a;var bqs=cloneQs(sampleQuestions(p.q));p.bq=bqs.map(function(q){return q.id;});p.role='B_SELF';p.st=2;renderSelfQuiz(bqs,'B');return;}
    if(p.st===2&&p.role==='B_SELF'){p.ba=a;setShare('toA',encode({pv:VERSION,bv:window.QUESTION_BANK_VERSION,st:2,q:p.q,a:p.a,bq:p.bq,ba:a,bg:p.bg}));return;}
    if(p.st===2&&p.role==='A_GUESS'){p.aGuesses=a;result();return;}
    error();
  }
  function route(){
    var f=location.hash.replace(/^#/,'');if(!f){show('home');return;}
    try{var o=JSON.parse(decode(f));if(!validate(o)){error();return;}session.payload=o;
      if(o.st===1){p=o;session.payload.role='B_GUESS';renderGuess(questionsFromIds(o.q));show('answer');}
      else{session.payload.role='A_GUESS';renderGuess(questionsFromIds(o.bq));show('answer');}
    }catch(e){error();}
  }
  var p;
  $('btn-start').addEventListener('click',start);
  $('btn-submit-answers').addEventListener('click',submit);
  $('btn-native-share').addEventListener('click',nativeShare);
  $('btn-copy').addEventListener('click',copy);
  $('btn-restart-from-share').addEventListener('click',reset);
  $('btn-home-from-error').addEventListener('click',reset);
  $('btn-home-from-result').addEventListener('click',reset);
  $('btn-detail-toggle').addEventListener('click',function(){var d=$('result-detail'),open=d.classList.contains('hidden');d.classList.toggle('hidden');this.textContent=open?'逐题对照 ▴':'逐题对照 ▾';});
  addEventListener('hashchange',function(){try{route();}catch(e){error();}});
  route();
  window.__guessMeTest={encode:encode,decode:decode,validate:validate,route:route,session:function(){return session;}};
})();