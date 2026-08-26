// ── Sheets menu ──
function toggleSheetsMenu(){const l=document.getElementById('sheets-list'),i=document.getElementById('sheets-toggle-icon');l.classList.toggle('hidden');i.style.transform=l.classList.contains('hidden')?'rotate(-90deg)':'rotate(0deg)';}

// ── Firebase ──
const firebaseConfig={apiKey:"AIzaSyAZkCZYEN_X5Y_jomWrinhC_u6ui9vg0os",authDomain:"juridico-analytics.firebaseapp.com",projectId:"juridico-analytics",storageBucket:"juridico-analytics.firebasestorage.app",messagingSenderId:"513370989421",appId:"1:513370989421:web:050c30cc43eb7b0c65b064"};
firebase.initializeApp(firebaseConfig);
const auth=firebase.auth();

// ── State ──
let rawData=[],filteredData=[],currentWorkbook=null,charts={},activeTabId='overview',deadlineFilterActive='all',sidebarCollapsed=false;
let _authenticatedUser=null,_taglineInterval=null;
let _idleTimer=null,_idleWarnTimer=null,_idleActive=false;
const IDLE_TIMEOUT=30*60*1000,IDLE_WARN=25*60*1000; // 30 min logout | 25 min aviso
const TAGLINES=['Gestão Estratégica de Processos','Visão clara sobre cada processo.','Prazos sob controle, equipe alinhada.','Produtividade que você pode medir.','Decisões baseadas em dados reais.'];
let _taglineIndex=0;
const DB_KEY='juridico_data_v10',USER_KEY='juridico_user_v10',REMEMBER_KEY='juridico_remember_v1';

// ── Utils ──
function sanitize(s){if(s==null)return '';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function excelDateToJSDate(n){if(!isFinite(n)||n<=0)return null;const u=Math.floor(n-25569),d=new Date(u*86400*1000);if(isNaN(d.getTime()))return null;return new Date(d.getFullYear(),d.getMonth(),d.getDate());}
function parseCellDate(rd){
if(rd instanceof Date)return isNaN(rd.getTime())?null:new Date(rd.getFullYear(),rd.getMonth(),rd.getDate());
if(typeof rd==='number')return excelDateToJSDate(rd);
const t=String(rd).trim();
if(!t)return null;
if(/^[0-9]+([.,][0-9]+)?$/.test(t))return excelDateToJSDate(parseFloat(t.replace(',','.')));
const m=t.match(/^([0-9]{1,4})[-/.]([0-9]{1,2})[-/.]([0-9]{2,4})/);
if(m){let y,mo,d;const a=+m[1],b=+m[2],c=+m[3];
if(m[1].length===4){y=a;mo=b;d=c;}else{d=a;mo=b;y=c;if(y<100)y+=y<70?2000:1900;}
if(!(mo>=1&&mo<=12)||!(d>=1&&d<=31)||!(y>=1900&&y<=2200))return null;
const dt=new Date(y,mo-1,d);return isNaN(dt.getTime())?null:dt;}
const iso=new Date(t);
if(!isNaN(iso.getTime())&&iso.getFullYear()>=1900&&iso.getFullYear()<=2200)return new Date(iso.getFullYear(),iso.getMonth(),iso.getDate());
return null;}


// ── Pesos por tipo de compromisso ──────────────────────────────────────────
// Escala 1-5 definida pela gerencia sobre os 6.215 compromissos concluidos
// entre 01/01/2026 e 25/08/2026. Chaves normalizadas (minusculas, sem acento).
// Uma coluna de PESO na planilha importada tem prioridade sobre esta tabela.
const PESO_FAIXAS = [{rot:'P1 Mínimo',cor:'#e2e8f0'},{rot:'P2 Rotina',cor:'#94a3b8'},{rot:'P3 Intermediário',cor:'#38bdf8'},{rot:'P4 Elevado',cor:'#d97706'},{rot:'P5 Fôlego',cor:'#e11d48'}];
const PESO_PADRAO = 2; // tipo novo/desconhecido: rotina
const PESOS_POR_TAREFA = {
  "leitura da publicacao/iniciar fluxo de prazo":2,
  "contestacao":5,
  "retorno de audiencia":2,
  "recurso ordinario":5,
  "manifestacao diversa":2,
  "pagamento":2,
  "ciencia da distribuicao - contestacao":2,
  "contrarrazoes a recurso ordinario":4,
  "recurso de revista":5,
  "revisao interna":2,
  "agravo de instrumento":3,
  "diligencia":2,
  "embargos de declaracao":3,
  "impugnacao aos calculos":2,
  "impugnacao de documentos":2,
  "impugnacao ao laudo pericial":2,
  "parecer":2,
  "indicacao de quesitos e assistente tecnico":2,
  "agravo de peticao":3,
  "ciencia da redistribuicao de prazo":1,
  "apresentacao de calculos":2,
  "memorial de razoes finais":2,
  "contra-minuta a embargos":2,
  "ciencia da sentenca":1,
  "contraminuta a agravo de peticao":3,
  "compromisso":2,
  "contrarrazoes a recurso de revista":4,
  "acao de consignacao em pagamento":3,
  "audiencia de conciliacao telepresencial":2,
  "mandado de seguranca":4,
  "manifestacao ao prevjud / documentos medicos":2,
  "contraminuta a agravo de instrumento":2,
  "defesa administrativa- srt":3,
  "homologacao de acordo extrajudicial":2,
  "manifestacao mpt":4,
  "teste - novo contestacao":1,
  "audiencia inicial telepresencial":2,
  "contraminuta ao agravo interno":2,
  "defesa em auto de infracao":3,
  "embargos a execucao":3,
  "excecao de incompetencia":2,
  "manifestacao prova emprestada":2,
  "agravo interno":3,
  "excecao de pre-executividade":3,
  "indicacao de prova oral":2,
  "recurso em auto de infracao":3,
  "acompanhar citacao":1,
  "edital - sem prazo - solar":2,
  "encerramento solar":2,
  "relatorio":4
};
function normTarefa(t){return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();}
function pesoDaTarefa(t){const k=normTarefa(t);
if(Object.prototype.hasOwnProperty.call(PESOS_POR_TAREFA,k))return{peso:PESOS_POR_TAREFA[k],origem:'tabela'};
return{peso:PESO_PADRAO,origem:'padrao'};}
function splitNames(s){return(!s||s==='N/A')?[s]:s.split(/;| \/ | e | & /i).map(x=>x.trim()).filter(x=>x.length>1);}
function showError(m){document.getElementById('login-error-text').innerText=m;document.getElementById('login-error').classList.remove('hidden');}
function showUploadError(m){document.getElementById('upload-error-text').innerText=m;document.getElementById('upload-error').classList.remove('hidden');}
function statusBadge(status){const s=(status||'').toLowerCase();let cls='badge-gray',label=sanitize(status||'N/A');if(s.match(/conclu|julg|arquiv|encerr|finaliz|baixad/))cls='badge-green';else if(s.match(/ativo|andamento|aberto|pendente/))cls='badge-blue';else if(s.match(/suspen|aguard/))cls='badge-yellow';else if(s.match(/cancel|inativ/))cls='badge-red';return`<span class="status-badge ${cls}">${label}</span>`;}
const DONE_RE=/conclu|julg|arquiv|encerr|finaliz|baixad/i;
function deadlineBadge(d,status){
  if(status&&DONE_RE.test(String(status)))return`<span class="status-badge badge-ok"><i class="fa-solid fa-check mr-1 text-[10px]"></i>Concluído</span>`;
  if(!d)return`<span class="status-badge badge-no-date">Sem data</span>`;
  const h=new Date();h.setHours(0,0,0,0);const t=new Date(d);t.setHours(0,0,0,0);const diff=Math.round((t-h)/86400000);
  if(diff<0)return`<span class="status-badge badge-overdue"><i class="fa-solid fa-fire mr-1 text-[10px]"></i>Atrasado ${Math.abs(diff)}d</span>`;
  if(diff===0)return`<span class="status-badge badge-today"><i class="fa-solid fa-circle-exclamation mr-1 text-[10px]"></i>Hoje</span>`;
  if(diff<=7)return`<span class="status-badge badge-week"><i class="fa-solid fa-clock mr-1 text-[10px]"></i>${diff}d</span>`;
  return`<span class="status-badge badge-ok">${diff}d</span>`;
}
function debounce(fn,d){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),d);};}
function showToast(msg,type='success',dur=4000){const ic={success:'fa-circle-check',warning:'fa-triangle-exclamation',error:'fa-circle-xmark'};const c=document.getElementById('toast-container');const e=document.createElement('div');e.className=`toast toast-${type}`;e.innerHTML=`<i class="fa-solid ${ic[type]||ic.success} flex-shrink-0"></i><span>${msg}</span>`;c.appendChild(e);setTimeout(()=>{e.style.opacity='0';e.style.transform='translateY(6px)';e.style.transition='all .3s';setTimeout(()=>e.remove(),300);},dur);}
function showTableSkeleton(id,cols=5,rows=4){const sk=`<tr>${Array(cols).fill(0).map((_,i)=>`<td class="px-5 py-3"><div class="skeleton h-3 rounded ${i===0?'w-32':'w-16 mx-auto'}"></div></td>`).join('')}</tr>`;const el=document.getElementById(id);if(el)el.innerHTML=Array(rows).fill(sk).join('');}

// ── Theme ──
function toggleTheme(){const d=document.documentElement.classList.toggle('dark');localStorage.setItem('theme',d?'dark':'light');updateChartColors();}
function updateChartColors(){const d=document.documentElement.classList.contains('dark');Chart.defaults.color=d?'#94a3b8':'#64748b';Chart.defaults.borderColor=d?'#334155':'#e8e0d8';if(Object.keys(charts).length>0)renderTab(activeTabId);}

// ── Sidebar ──
function toggleSidebar(){sidebarCollapsed=!sidebarCollapsed;document.getElementById('sidebar').classList.toggle('collapsed',sidebarCollapsed);const i=document.querySelector('#sidebar-toggle-btn i');i.className=sidebarCollapsed?'fa-solid fa-bars-staggered text-sm':'fa-solid fa-bars text-sm';localStorage.setItem('sidebarCollapsed',sidebarCollapsed?'1':'0');}

// ── Tagline rotation ──
function startTaglineRotation(){const el=document.getElementById('tagline-text');if(!el)return;clearInterval(_taglineInterval);_taglineInterval=setInterval(()=>{el.classList.add('fading');setTimeout(()=>{_taglineIndex=(_taglineIndex+1)%TAGLINES.length;el.innerText=TAGLINES[_taglineIndex];el.classList.remove('fading');},580);},3200);}

// ── Init ──
document.addEventListener('DOMContentLoaded',()=>{
    updateChartColors();setupFileZones();setupSearchListeners();
    if(localStorage.getItem('sidebarCollapsed')==='1'){sidebarCollapsed=true;document.getElementById('sidebar').classList.add('collapsed');document.querySelector('#sidebar-toggle-btn i').className='fa-solid fa-bars-staggered text-sm';}
    auth.onAuthStateChanged((user)=>{
        const sd=localStorage.getItem(DB_KEY),su=localStorage.getItem(USER_KEY);
        if(user&&sd){try{rawData=JSON.parse(sd);loginSuccess(su||user.email.split('@')[0]);}catch(e){localStorage.removeItem(DB_KEY);showLoginCard();}}
        else if(user&&!sd){_authenticatedUser=user;showLoginCard();setTimeout(()=>goToStep2(user),120);}
        else{showLoginCard();}
    });
});
function showLoginCard(){const sc=document.getElementById('session-card');if(sc)sc.classList.add('hidden');document.getElementById('login-card').classList.remove('hidden');startTaglineRotation();loadSavedCredentials();}
function restoreSession(){location.reload();}
function newAnalysis(){localStorage.removeItem(DB_KEY);location.reload();}

// ── Lembrar senha ──
function loadSavedCredentials(){try{const s=JSON.parse(localStorage.getItem(REMEMBER_KEY)||'null');if(s&&s.email){const ei=document.getElementById('userNameInput'),pi=document.getElementById('passwordInput'),cb=document.getElementById('rememberMe');if(ei)ei.value=s.email;if(pi&&s.pass){try{pi.value=atob(s.pass);}catch(e){}}if(cb)cb.checked=true;}}catch(e){}}
function saveCredentials(em,pw){try{localStorage.setItem(REMEMBER_KEY,JSON.stringify({email:em,pass:btoa(pw)}));}catch(e){}}
function clearSavedCredentials(){localStorage.removeItem(REMEMBER_KEY);}

// ── Auto-logout por inatividade (30 min) ──
function resetIdleTimer(){
    clearTimeout(_idleTimer);clearTimeout(_idleWarnTimer);
    _idleWarnTimer=setTimeout(()=>showToast('⚠️ Sessão expira em 5 minutos por inatividade.','warning',10000),IDLE_WARN);
    _idleTimer=setTimeout(()=>{showToast('🔒 Sessão encerrada por inatividade.','error',4000);setTimeout(logout,1500);},IDLE_TIMEOUT);
}
function startIdleTracking(){if(_idleActive)return;_idleActive=true;['mousemove','keydown','mousedown','click','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,resetIdleTimer,{passive:true}));resetIdleTimer();}
function stopIdleTracking(){clearTimeout(_idleTimer);clearTimeout(_idleWarnTimer);if(!_idleActive)return;_idleActive=false;['mousemove','keydown','mousedown','click','scroll','touchstart'].forEach(ev=>document.removeEventListener(ev,resetIdleTimer));}

// ── Wizard: Step 1 (Auth) ──
function authStep1(){
    const email=document.getElementById('userNameInput').value.trim(),pass=document.getElementById('passwordInput').value.trim(),btn=document.getElementById('btn-login');
    document.getElementById('login-error').classList.add('hidden');
    if(!email||!pass){showError('Preencha o e-mail e a senha.');return;}
    const orig=btn.innerHTML;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-2"></i>Verificando...';btn.disabled=true;
    auth.signInWithEmailAndPassword(email,pass).then(cred=>{_authenticatedUser=cred.user;btn.innerHTML=orig;btn.disabled=false;const cb=document.getElementById('rememberMe');if(cb&&cb.checked)saveCredentials(email,pass);else clearSavedCredentials();goToStep2(cred.user);}).catch(err=>{btn.innerHTML=orig;btn.disabled=false;let m='Acesso negado.';if(err.code==='auth/user-not-found'||err.code==='auth/invalid-credential')m='Usuário ou senha incorretos.';else if(err.code==='auth/invalid-email')m='E-mail inválido.';else if(err.code==='auth/too-many-requests')m='Muitas tentativas. Aguarde.';showError(m);});
}

// ── Wizard: Go to step 2 ──
function goToStep2(user){
    const email=user?.email||'';
    document.getElementById('step2-user-greeting').innerText=email;
    const d1=document.getElementById('step-dot-1');d1.className='step-dot step-dot-done';d1.innerHTML='<i class="fa-solid fa-check text-[10px]"></i>';
    document.getElementById('step-dot-2').className='step-dot step-dot-active';
    document.getElementById('step-title').innerText='Carregar Dados';
    document.getElementById('step-subtitle-label').innerText='Passo 2 de 2';
    const s1=document.getElementById('wizard-step-1'),s2=document.getElementById('wizard-step-2');
    s1.style.opacity='0';s1.style.transform='translateX(-20px)';
    setTimeout(()=>{s1.classList.add('hidden');s1.style.opacity=s1.style.transform='';s2.classList.remove('hidden');s2.classList.add('slide-in-right');setTimeout(()=>s2.classList.remove('slide-in-right'),400);},300);
}

// ── Wizard: Back to step 1 ──
function goToStep1(){
    _authenticatedUser=null;auth.signOut();
    const d1=document.getElementById('step-dot-1');d1.className='step-dot step-dot-active';d1.innerText='1';
    document.getElementById('step-dot-2').className='step-dot step-dot-inactive';
    document.getElementById('step-title').innerText='Identificação';document.getElementById('step-subtitle-label').innerText='Passo 1 de 2';
    const s1=document.getElementById('wizard-step-1'),s2=document.getElementById('wizard-step-2');
    s2.style.opacity='0';s2.style.transform='translateX(20px)';
    setTimeout(()=>{s2.classList.add('hidden');s2.style.opacity=s2.style.transform='';s1.classList.remove('hidden');s1.classList.add('slide-in-left');setTimeout(()=>s1.classList.remove('slide-in-left'),400);},300);
    rawData=[];const fs=document.getElementById('file-success'),dc=document.getElementById('drop-content');
    if(fs){fs.classList.add('hidden');fs.classList.remove('flex');}if(dc)dc.classList.remove('hidden');
    document.getElementById('fileInput').value='';document.getElementById('upload-error').classList.add('hidden');
}

// ── Wizard: Proceed after upload ──
function proceedAfterUpload(){
    document.getElementById('upload-error').classList.add('hidden');
    if(rawData.length===0){showUploadError('Carregue a planilha do escritório primeiro.');return;}
    const user=_authenticatedUser||auth.currentUser;
    if(!user){showUploadError('Sessão expirada. Faça login novamente.');setTimeout(goToStep1,800);return;}
    const btn=document.getElementById('btn-proceed'),orig=btn.innerHTML;
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-2"></i>Carregando...';btn.disabled=true;
    try{localStorage.setItem(DB_KEY,JSON.stringify(rawData));}catch(e){setTimeout(()=>showToast('⚠️ Cache local cheio.','warning'),1500);}
    const name=user.email.split('@')[0];localStorage.setItem(USER_KEY,name);
    loginSuccess(name);btn.innerHTML=orig;btn.disabled=false;
}

// ── Login success / logout ──
function loginSuccess(name){
    if(_taglineInterval){clearInterval(_taglineInterval);_taglineInterval=null;}
    const bar=document.getElementById('page-load-bar');bar.classList.remove('hidden');setTimeout(()=>bar.classList.add('hidden'),1400);
    document.getElementById('view-upload').classList.add('hidden');document.getElementById('view-dashboard').classList.remove('hidden');
    document.getElementById('user-initials').innerText=name.substring(0,2).toUpperCase();
    filteredData=[...rawData];document.getElementById('sidebar-total').innerText=rawData.length;updateDashboard();
    startIdleTracking();
}
function logout(){stopIdleTracking();auth.signOut().then(()=>{localStorage.removeItem(DB_KEY);localStorage.removeItem(USER_KEY);location.reload();});}

// ── Demo data ──
function loadDemoData(){
    const h=new Date(),a=new Date(h),s=new Date(h),o=new Date(h);a.setDate(h.getDate()+1);s.setDate(h.getDate()+8);o.setDate(h.getDate()-1);
    const fmt=d=>`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const wb=XLSX.utils.book_new();
    const wd=[["Nº Processo","Responsáveis","Clientes","Status","Tarefa","Fluxo","Data Limite"],["0001234-56.2023","Dr. João","Empresa A","Em Andamento","Consultar processo","Prazo",fmt(h)],["0009876-54.2022","Dr. João","Empresa B","Em Andamento","Elaborar Petição","Prazo",fmt(a)],["0004567-89.2024","Dr. Carlos","Empresa C","Ativo","Defesa","Subprazo",fmt(o)],["","Dra. Maria","Empresa B","Concluído","Diário Oficial","Atividade",""],["0001111-22.2021","Dr. Carlos","Empresa C","Ativo","Reunião","Atividade",fmt(s)]];
    const ws=XLSX.utils.aoa_to_sheet(wd);XLSX.utils.book_append_sheet(wb,ws,"Dados");currentWorkbook=wb;processSheetData(wb,"Dados");
    const z=document.getElementById('drop-zone');if(z){const fs=z.querySelector('#file-success'),dc=z.querySelector('#drop-content');if(fs&&dc){fs.classList.remove('hidden');fs.classList.add('flex');dc.classList.add('hidden');const fn=z.querySelector('#file-name-display');if(fn)fn.innerText='demonstracao.xlsx';}}
    document.getElementById('upload-error').classList.add('hidden');
}

// ── File upload ──
function setupFileZones(){const z=document.getElementById('drop-zone');if(!z)return;const inp=z.querySelector('input');z.addEventListener('click',e=>{if(!e.target.closest('button'))inp.click();});z.addEventListener('dragover',e=>e.preventDefault());z.addEventListener('drop',e=>{e.preventDefault();handleFile(e.dataTransfer.files[0],z);});inp.addEventListener('change',e=>handleFile(e.target.files[0],z));}
function handleFile(file,zone){if(!file)return;const ext=file.name.split('.').pop().toLowerCase(),reader=new FileReader();reader.onload=e=>{try{let p=0;if(ext==='xlsx'||ext==='xls'){const d=new Uint8Array(e.target.result),wb=XLSX.read(d,{type:'array'});currentWorkbook=wb;renderSheetSelector(wb.SheetNames);for(const s of wb.SheetNames){if((p=processSheetData(wb,s))>0){updateActiveSheetBtn(s);break;}}}else{p=processCSV(decodeTextBuffer(e.target.result));}if(p>0){const fs=zone.querySelector('#file-success'),dc=zone.querySelector('#drop-content');fs.classList.remove('hidden');fs.classList.add('flex');dc.classList.add('hidden');zone.querySelector('#file-name-display').innerText=file.name;document.getElementById('upload-error').classList.add('hidden');}else{showUploadError('Dados inválidos. Verifique as colunas.');}}catch(err){showUploadError('Erro: '+err.message);}};reader.readAsArrayBuffer(file);}
function resetFile(e){e.stopPropagation();document.getElementById('fileInput').value='';const fs=document.getElementById('file-success'),dc=document.getElementById('drop-content');fs.classList.add('hidden');fs.classList.remove('flex');dc.classList.remove('hidden');rawData=[];}
function processSheetData(wb,n){return parseRawArray(XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1}));}
function decodeTextBuffer(buf){
const bytes=new Uint8Array(buf);
if(bytes.length>=3&&bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF)return new TextDecoder('utf-8').decode(bytes.subarray(3));
try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(e){return new TextDecoder('windows-1252').decode(bytes);}}
function processCSV(text){const wb=XLSX.read(text,{type:'string',raw:true});return processSheetData(wb,wb.SheetNames[0]);}
function parseRawArray(rows){if(rows.length<2)return 0;let hi=-1,map={a:-1,c:-1,s:-1,t:-1,f:-1,d:-1,pr:-1,p:-1},dScore=0,cScore=0;for(let i=0;i<Math.min(rows.length,15);i++){rows[i].forEach((cell,idx)=>{if(typeof cell!=='string')return;const h=cell.trim().toLowerCase();if(h.match(/advogado|respons|nome|autor|owner/)){if(map.a===-1)map.a=idx;}else if(h.match(/cliente|empresa|parte|réu/)){const sc=/^clientes?$/.test(h)?2:1;if(sc>cScore){map.c=idx;cScore=sc;}}else if(h.match(/status|fase|situa/)){if(map.s===-1)map.s=idx;}else if(h.match(/tarefa|atividade|tipo/)){if(map.t===-1)map.t=idx;}else if(h.match(/fluxo|natureza|categoria/)){if(map.f===-1)map.f=idx;}else if(h.match(/data|vencimento|limite|prazo/)){const sc=/final|limite|vencimento|prazo/.test(h)?2:1;if(sc>dScore){map.d=idx;dScore=sc;}}else if(h.match(/peso|complex|score/)){if(map.p===-1)map.p=idx;}else if(h.match(/processo|autos|número|numero/)){if(map.pr===-1)map.pr=idx;}});if(map.a!==-1||map.c!==-1){hi=i;break;}}if(hi===-1)return 0;rawData=[];for(let i=hi+1;i<rows.length;i++){const r=rows[i];if(!r||r.length===0)continue;let fVal=map.f!==-1&&r[map.f]?String(r[map.f]).trim():'';if(!fVal){const tl=(r[map.t]||'').toString().toLowerCase();if(tl.includes('subprazo'))fVal='Subprazo';else if(tl.includes('prazo'))fVal='Prazo';else fVal='Atividade';}let p=null,pOrig='';if(map.p!==-1&&r[map.p]!=null&&r[map.p]!==''){const pm=String(r[map.p]).trim().match(/^\D*(\d+)\D*$/);if(pm){const pv=parseInt(pm[1],10);if(pv>=1&&pv<=5){p=pv;pOrig='planilha';}}}if(p===null){const pt=pesoDaTarefa(r[map.t]!==undefined?r[map.t]:'');p=pt.peso;pOrig=pt.origem;}let dl=null;if(map.d!==-1&&r[map.d]!=null&&r[map.d]!=='')dl=parseCellDate(r[map.d]);rawData.push({processo:map.pr!==-1?(r[map.pr]||'').toString().trim():'',advogado:(r[map.a]||'N/A').toString().trim(),cliente:(r[map.c]||'N/A').toString().trim(),status:(r[map.s]||'Ativo').toString().trim(),tarefa:(r[map.t]||'Geral').toString().trim(),peso:p,pesoOrigem:pOrig,fluxo:fVal,dataLimiteStr:(dl&&!isNaN(dl.getTime()))?dl.toISOString():null});}return rawData.length;}

// ── Dashboard ──
function setupSearchListeners(){const si=document.getElementById('globalSearch'),ss=document.getElementById('statusFilter');if(si)si.addEventListener('input',debounce(updateDashboard,250));if(ss)ss.addEventListener('change',updateDashboard);}
function updateDashboard(){const term=document.getElementById('globalSearch').value.toLowerCase(),sm=document.getElementById('statusFilter').value;filteredData=rawData.filter(r=>{const tm=Object.values(r).some(v=>String(v).toLowerCase().includes(term));const s=r.status.toLowerCase(),ic=!!s.match(/conclu|julg|arquiv|encerr|finaliz|baixad/);let stm=true;if(sm==='active')stm=!ic;if(sm==='closed')stm=ic;return tm&&stm;});document.getElementById('sidebar-total').innerText=filteredData.length;renderTab(activeTabId);if(activeTabId==='overview'||activeTabId==='deadlines')renderDeadlinesAlert();else document.getElementById('deadline-alerts').classList.add('hidden');}
function renderTab(id){const map={overview:renderOverview,deadlines:renderDeadlines,lawyers:renderLawyers,clients:renderClients,tasks:renderTasks,weight:renderWeight,flow:renderFlow};if(map[id])map[id]();}
function switchTab(id,el){document.querySelectorAll('.tab-content').forEach(t=>t.classList.add('hidden'));document.getElementById('tab-'+id).classList.remove('hidden');document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));el.classList.add('active');activeTabId=id;const titles={overview:'Visão Geral',deadlines:'Prazos',lawyers:'Análise por Advogado',clients:'Análise de Clientes',tasks:'Tarefas',weight:'Carga de Trabalho',flow:'Análise de Fluxo'};document.getElementById('header-title').innerText=titles[id]||'Dashboard';renderTab(id);if(id==='overview'||id==='deadlines')renderDeadlinesAlert();else document.getElementById('deadline-alerts').classList.add('hidden');}

// ── Deadline alert banner ──
function renderDeadlinesAlert(){const c=document.getElementById('deadline-alerts'),h=new Date();h.setHours(0,0,0,0);const ps=new Date(h);ps.setDate(h.getDate()+7);let at=0,vh=0,vs=0;filteredData.forEach(r=>{if(r.status.toLowerCase().match(/conclu|julg|arquiv|encerr|finaliz|baixad/)||!r.dataLimiteStr)return;const d=new Date(r.dataLimiteStr);d.setHours(0,0,0,0);if(d<h)at++;else if(d.getTime()===h.getTime())vh++;else if(d<=ps)vs++;});let html='';if(at>0)html+=`<div class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 p-3 rounded-xl flex items-center gap-3"><i class="fa-solid fa-circle-exclamation text-lg flex-shrink-0 animate-pulse"></i><span class="font-semibold text-sm">${at} prazo(s) atrasado(s) ou sem baixa.</span></div>`;if(vh>0||vs>0)html+=`<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 text-amber-700 dark:text-amber-500 p-3 rounded-xl flex items-center gap-3"><i class="fa-solid fa-calendar-day text-lg flex-shrink-0"></i><span class="text-sm"><strong>${vh} vencimento(s) hoje</strong> · ${vs} nos próximos 7 dias.</span></div>`;if(html){c.innerHTML=html;c.classList.remove('hidden');}else{c.innerHTML='';c.classList.add('hidden');}}

// ── Overview ──
function renderOverview(){
    if(filteredData.length===0){clearOverview();return;}
    let pTotal=0,pCrit=0;const law={},cli=new Set();let w=0,sm={};const h=new Date();h.setHours(0,0,0,0);
    filteredData.forEach(r=>{w+=r.peso;splitNames(r.cliente).forEach(c=>cli.add(c));splitNames(r.advogado).forEach(a=>{law[a]=(law[a]||0)+1;});sm[r.status]=(sm[r.status]||0)+1;if(r.dataLimiteStr){pTotal++;const d=new Date(r.dataLimiteStr);d.setHours(0,0,0,0);if(d<=h&&!r.status.toLowerCase().match(/conclu|julg|arquiv|encerr|finaliz|baixad/))pCrit++;}});
    const lawCount=Object.keys(law).length;
    const pctOK=pTotal>0?Math.round(((pTotal-pCrit)/pTotal)*100):100;
    document.getElementById('kpi-total').innerText=filteredData.length;
    document.getElementById('kpi-lawyers-count').innerText=lawCount;
    document.getElementById('kpi-clients-count').innerText=cli.size;
    document.getElementById('kpi-avg-weight').innerText=(w/filteredData.length).toFixed(2);
    document.getElementById('kpi-pct-prazos').innerText=pctOK+'%';
    const kpiCard=document.getElementById('kpi-card-deadline'),kpiIcon=document.getElementById('kpi-icon-deadline');
    if(pCrit>0){if(kpiCard)kpiCard.style.borderColor='rgba(239,68,68,0.5)';if(kpiIcon)kpiIcon.className='w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/10 text-red-400 mb-3 transition-colors';}
    else{if(kpiCard)kpiCard.style.borderColor='';if(kpiIcon)kpiIcon.className='w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400 mb-3 transition-colors';}
    const tc=document.getElementById('kpi-prazos-criticos');if(pCrit>0){tc.className='text-xs text-red-400 font-medium mt-4';tc.innerHTML=`<i class="fa-solid fa-triangle-exclamation mr-1"></i>${pCrit} atrasados`;}else{tc.className='text-xs text-emerald-400 font-medium mt-4';tc.innerHTML=`<i class="fa-solid fa-check mr-1"></i>Tudo em dia`;}
    if(charts.overviewBar)charts.overviewBar.destroy();
    const tl=Object.entries(law).sort((a,b)=>b[1]-a[1]).slice(0,7);
    charts.overviewBar=new Chart(document.getElementById('chartOverviewEvolucao').getContext('2d'),{type:'bar',data:{labels:tl.map(l=>sanitize(l[0])),datasets:[{label:'Processos',data:tl.map(l=>l[1]),backgroundColor:'#cbd5e1',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#94a3b8'}},y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#94a3b8'}}}}});
    renderInsights(law,pCrit,pTotal,filteredData);
    renderHealthScore(filteredData);
}
function clearOverview(){['kpi-total','kpi-lawyers-count','kpi-clients-count'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerText='0';});document.getElementById('kpi-avg-weight').innerText='0.00';const pp=document.getElementById('kpi-pct-prazos');if(pp)pp.innerText='—';document.getElementById('deadline-alerts').classList.add('hidden');if(charts.overviewBar)charts.overviewBar.destroy();const sa=document.getElementById('score-arc-fill'),sv=document.getElementById('health-score-value'),sl=document.getElementById('health-score-label'),sb=document.getElementById('health-score-breakdown');if(sa)sa.setAttribute('stroke-dashoffset','251.3');if(sv)sv.innerText='—';if(sl){sl.innerText='Sem dados';sl.style.background='rgba(203,213,225,.1)';sl.style.color='rgba(203,213,225,.5)';}if(sb)sb.innerHTML='';const ins=document.getElementById('insights-section');if(ins)ins.innerHTML='';}

// ── Insights ──
function renderInsights(law,pCrit,pTotal,data){
    const ins=document.getElementById('insights-section');if(!ins)return;
    if(!data||!data.length){ins.innerHTML='';return;}
    const h=new Date();h.setHours(0,0,0,0);

    // ── Insight 1: Maior Carga ──
    const lawEntries=Object.entries(law).sort((a,b)=>b[1]-a[1]);
    const top=lawEntries[0];
    const topTotal=top?top[1]:0;
    const topOverdue=top?data.filter(r=>splitNames(r.advogado).includes(top[0])&&r.dataLimiteStr&&new Date(r.dataLimiteStr)<h&&!DONE_RE.test(String(r.status||''))).length:0;
    const topOverduePct=topTotal>0?Math.round((topOverdue/topTotal)*100):0;
    const teamAvg=lawEntries.length>1?Math.round(data.length/lawEntries.length):0;

    // ── Insight 2: Prazo mais urgente ──
    const upcoming=data.filter(r=>r.dataLimiteStr&&!DONE_RE.test(String(r.status||''))).sort((a,b)=>new Date(a.dataLimiteStr)-new Date(b.dataLimiteStr));
    const next=upcoming[0];
    let nextDiff=null,nextLabel='Sem prazos ativos',nextColor='text-slate-400',nextIconBg='bg-slate-500/10 text-slate-400';
    if(next){const nd=new Date(next.dataLimiteStr);nd.setHours(0,0,0,0);nextDiff=Math.round((nd-h)/86400000);if(nextDiff<0){nextLabel=`Atrasado ${Math.abs(nextDiff)}d`;nextColor='text-red-400';nextIconBg='bg-red-500/10 text-red-400';}else if(nextDiff===0){nextLabel='Vence hoje';nextColor='text-red-400';nextIconBg='bg-red-500/10 text-red-400';}else if(nextDiff<=7){nextLabel=`Em ${nextDiff} dia(s)`;nextColor='text-amber-400';nextIconBg='bg-amber-500/10 text-amber-400';}else{nextLabel=`Em ${nextDiff} dias`;nextColor='text-emerald-400';nextIconBg='bg-emerald-500/10 text-emerald-400';}}

    // ── Insight 3: Prazos P3 (métricas corretas, apenas P3) ──
    const p3All=data.filter(r=>r.peso>=4);
    const critP3=p3All.length;
    const critP3Overdue=p3All.filter(r=>r.dataLimiteStr&&new Date(r.dataLimiteStr)<h&&!DONE_RE.test(String(r.status||''))).length;
    const critP3Ok=critP3-critP3Overdue;
    const critP3OkPct=critP3>0?Math.round((critP3Ok/critP3)*100):100;
    const critPct=data.length?Math.round((critP3/data.length)*100):0;

    ins.innerHTML=`
    <div class="bg-gradient-to-br from-petrol-800 to-petrol-900 border border-slate-700/50 rounded-xl p-5 shadow-lg fade-in">
      <div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center text-xs"><i class="fa-solid fa-crown"></i></div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maior Carga</p></div>
      ${top
        ?`<p class="font-bold text-white text-lg leading-tight truncate" title="${sanitize(top[0])}">${sanitize(top[0])}</p>
           <p class="text-xs text-slate-400 mt-1">${topTotal} processo(s)${topOverdue>0?` · <span class="text-red-400 font-bold">${topOverdue} atrasado(s) (${topOverduePct}%)</span>`:' · <span class="text-emerald-400">Em dia ✓</span>'}</p>
           ${teamAvg>0?`<div class="mt-3 pt-3 border-t border-slate-700/50"><p class="text-[10px] text-slate-500">Média da equipe: <span class="font-semibold text-slate-300">${teamAvg} proc/adv</span></p></div>`:''}`
        :'<p class="text-slate-400 text-sm">Sem dados</p>'}
    </div>
    <div class="bg-gradient-to-br from-petrol-800 to-petrol-900 border border-slate-700/50 rounded-xl p-5 shadow-lg fade-in">
      <div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg ${nextIconBg} flex items-center justify-center text-xs"><i class="fa-solid fa-clock"></i></div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazo Mais Urgente</p></div>
      ${next
        ?`<p class="font-bold text-white text-base leading-tight truncate" title="${sanitize(next.cliente||'')}">${sanitize(next.cliente||'—')}</p>
           <p class="text-xs text-slate-400 mt-0.5 truncate">${sanitize(next.tarefa||'—')}</p>
           <p class="text-[11px] mt-1 truncate" style="color:rgba(203,213,225,.38)"><i class="fa-solid fa-user-tie mr-1 text-[9px]"></i>${sanitize(next.advogado||'—')}</p>
           <p class="text-xs mt-2 font-bold ${nextColor}">${nextLabel}</p>`
        :'<p class="text-emerald-400 text-sm font-bold">Tudo em dia ✓</p>'}
    </div>
    <div class="bg-gradient-to-br from-petrol-800 to-petrol-900 border border-slate-700/50 rounded-xl p-5 shadow-lg fade-in">
      <div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center text-xs"><i class="fa-solid fa-bolt"></i></div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Prazos P3</p></div>
      <p class="font-bold text-white text-3xl leading-tight">${critP3}</p>
      <p class="text-xs text-slate-400 mt-1">${critPct}% da carteira total</p>
      ${critP3>0
        ?`<div class="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
             <p class="text-[11px] flex items-center justify-between"><span class="text-slate-500">Vencidos</span><span class="font-bold ${critP3Overdue>0?'text-red-400':'text-emerald-400'}">${critP3Overdue}</span></p>
             <p class="text-[11px] flex items-center justify-between"><span class="text-slate-500">No prazo</span><span class="font-bold text-emerald-400">${critP3Ok}</span></p>
             <p class="text-[11px] flex items-center justify-between"><span class="text-slate-500">Taxa OK</span><span class="font-bold ${critP3OkPct>=70?'text-emerald-400':critP3OkPct>=40?'text-amber-400':'text-red-400'}">${critP3OkPct}%</span></p>
           </div>`
        :''}
    </div>`;
}

// ── Health Score ──
function calcStdDev(v){if(!v.length)return 0;const m=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((a,b)=>a+Math.pow(b-m,2),0)/v.length);}
function renderHealthScore(data){
    const sv=document.getElementById('health-score-value'),sl=document.getElementById('health-score-label'),sa=document.getElementById('score-arc-fill'),sb=document.getElementById('health-score-breakdown');
    if(!sv||!sl||!sa||!sb)return;
    if(!data||!data.length){sv.innerText='—';sl.innerText='Sem dados';sb.innerHTML='<p class="text-xs text-slate-400 italic">Carregue uma planilha para ver o diagnóstico.</p>';return;}
    const h=new Date();h.setHours(0,0,0,0);
    const ativos=data.filter(r=>!r.status.toLowerCase().match(/conclu|julg|arquiv|encerr|finaliz|baixad/));
    const total=data.length,atrasados=ativos.filter(r=>r.dataLimiteStr&&new Date(r.dataLimiteStr)<h),criticos=data.filter(r=>r.peso>=4),avgPeso=data.reduce((s,r)=>s+r.peso,0)/total;
    const ls={};data.forEach(r=>splitNames(r.advogado).forEach(a=>{ls[a]=(ls[a]||0)+1;}));const lc=Object.values(ls),dev=calcStdDev(lc),mx=Math.max(...lc,1);
    let score=100;
    const penA=Math.round((atrasados.length/(ativos.length||1))*40),penC=Math.round((criticos.length/total)*20),penP=Math.round(Math.max(0,(avgPeso-3)*8)),penD=Math.min(15,Math.round((dev/mx)*40));
    score-=penA+penC+penP+penD;score=Math.max(0,Math.min(100,Math.round(score)));
    const circ=251.3,offset=circ*(1-score/100);
    let arc='#22c55e',lt='Excelente',bg='rgba(74,222,128,.18)',lc2='#4ade80';
    if(score<40){arc='#ef4444';lt='Crítico';bg='rgba(239,68,68,.18)';lc2='#f87171';}
    else if(score<60){arc='#f97316';lt='Preocupante';bg='rgba(249,115,22,.18)';lc2='#fb923c';}
    else if(score<75){arc='#f59e0b';lt='Atenção';bg='rgba(245,158,11,.18)';lc2='#fbbf24';}
    else if(score<88){arc='#38bdf8';lt='Bom';bg='rgba(56,189,248,.18)';lc2='#38bdf8';}
    sa.setAttribute('stroke',arc);sa.setAttribute('stroke-dashoffset',offset);sv.innerText=score;sl.style.background=bg;sl.style.color=lc2;sl.innerText=lt;
    const items=[{label:'Prazos em atraso',pen:penA,icon:'fa-fire',color:'text-red-400',detail:`${atrasados.length} de ${ativos.length} ativos`},{label:'Processos com Prazo (P3)',pen:penC,icon:'fa-bolt',color:'text-orange-400',detail:`${criticos.length} de ${total}`},{label:'Peso médio elevado',pen:penP,icon:'fa-weight-hanging',color:'text-sky-400',detail:`Média: ${avgPeso.toFixed(2)}`},{label:'Desequilíbrio carga',pen:penD,icon:'fa-scale-unbalanced',color:'text-amber-400',detail:`Desvio: ${dev.toFixed(1)}`}];
    sb.innerHTML=`<p class="text-[10px] font-bold uppercase tracking-wider mb-2" style="color:rgba(203,213,225,.4)">Diagnóstico</p>${items.map(it=>{const bp=Math.min(100,(it.pen/40)*100);return`<div class="flex items-start gap-2.5"><div class="${it.color} w-4 flex-shrink-0 text-center mt-0.5"><i class="fa-solid ${it.icon} text-xs"></i></div><div class="flex-1 min-w-0"><div class="flex justify-between"><span class="text-xs text-slate-300 font-medium truncate">${it.label}</span><span class="text-[10px] font-bold ml-1 flex-shrink-0 ${it.pen>0?'text-red-400':'text-green-400'}">-${it.pen}pts</span></div><div class="h-1.5 mt-1 rounded-full overflow-hidden" style="background:rgba(203,213,225,0.1)"><div class="h-full rounded-full ${it.pen===0?'bg-green-500':'bg-red-500'} transition-all duration-700" style="width:${bp}%"></div></div><span class="text-[10px] mt-0.5 block" style="color:rgba(203,213,225,.4)">${it.detail}</span></div></div>`;}).join('')}`;
}

// ── Prazos ──
function setDeadlineFilter(f){deadlineFilterActive=f;document.querySelectorAll('.dl-filter-btn').forEach(b=>{b.classList.remove('bg-slate-200','dark:bg-slate-700','text-slate-600','dark:text-slate-300');b.classList.add('bg-slate-100','dark:bg-slate-700/50','text-slate-500','dark:text-slate-400');});const a=document.getElementById('dl-filter-'+f);if(a){a.classList.add('bg-slate-200','dark:bg-slate-700','text-slate-600','dark:text-slate-300');a.classList.remove('bg-slate-100','dark:bg-slate-700/50','text-slate-500','dark:text-slate-400');}renderDeadlines();}
function renderDeadlines(){
    const tb=document.getElementById('table-deadlines-detail'),em=document.getElementById('deadlines-empty');
    showTableSkeleton('table-deadlines-detail',7,5);
    const h=new Date();h.setHours(0,0,0,0);
    const ps=new Date(h);ps.setDate(h.getDate()+7);
    function cl(r){
        if(!r.dataLimiteStr)return 'no-date';
        const d=new Date(r.dataLimiteStr);d.setHours(0,0,0,0);
        if(d<h)return 'overdue';
        if(d.getTime()===h.getTime())return 'today';
        if(d<=ps)return 'week';
        return 'ok';
    }
    const uo={overdue:0,today:1,week:2,ok:3,'no-date':4};
    let rows=filteredData.filter(r=>r.dataLimiteStr||deadlineFilterActive==='all').map(r=>({...r,_u:cl(r)})).sort((a,b)=>(uo[a._u]||99)-(uo[b._u]||99));
    if(deadlineFilterActive!=='all')rows=rows.filter(r=>r._u===deadlineFilterActive);
    
    let ko=0,kt=0,kw=0,kk=0;
    filteredData.forEach(r=>{
        if (!r.dataLimiteStr) return; // Agora conta perfeitamente o que aparece na tabela!
        const u=cl(r);
        if(u==='overdue')ko++;
        else if(u==='today')kt++;
        else if(u==='week')kw++;
        else if(u==='ok')kk++;
    });
    
    document.getElementById('dl-kpi-overdue').innerText=ko;
    document.getElementById('dl-kpi-today').innerText=kt;
    document.getElementById('dl-kpi-week').innerText=kw;
    document.getElementById('dl-kpi-ok').innerText=kk;
    
    if(!rows.length){tb.innerHTML='';em.classList.remove('hidden');return;}
    em.classList.add('hidden');
    tb.innerHTML=rows.map(r=>{const df=r.dataLimiteStr?new Date(r.dataLimiteStr).toLocaleDateString('pt-BR'):'—';return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-5 py-3">${deadlineBadge(r.dataLimiteStr?new Date(r.dataLimiteStr):null,r.status)}</td><td class="px-5 py-3 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">${sanitize(df)}</td><td class="px-5 py-3 text-xs text-slate-500 dark:text-slate-400 max-w-[120px] truncate">${sanitize(r.processo||'—')}</td><td class="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">${sanitize(r.advogado)}</td><td class="px-5 py-3">${sanitize(r.cliente)}</td><td class="px-5 py-3">${sanitize(r.tarefa)}</td><td class="px-5 py-3">${statusBadge(r.status)}</td></tr>`;}).join('');
}

// ── Advogados ──
function renderLawyers(){if(charts.law)charts.law.destroy();const el=document.getElementById('table-lawyers-detail');showTableSkeleton('table-lawyers-detail',6,5);if(!filteredData.length){el.innerHTML='';return;}const st={};filteredData.forEach(r=>{splitNames(r.advogado).forEach(a=>{if(!st[a])st[a]={t:0,w:0,ok:0,p:0};st[a].t++;st[a].w+=r.peso;r.status.toLowerCase().match(/conclu|julg|arquiv|encerr/)?st[a].ok++:st[a].p++;});});const s=Object.entries(st).sort((a,b)=>b[1].t-a[1].t);const isDark=document.documentElement.classList.contains('dark');charts.law=new Chart(document.getElementById('chartLawyersMain').getContext('2d'),{type:'bar',data:{labels:s.map(x=>sanitize(x[0])),datasets:[{label:'Processos',data:s.map(x=>x[1].t),backgroundColor:'#0ea5e9',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});el.innerHTML=s.map(([k,v])=>{const avg=v.t?(v.w/v.t).toFixed(2):'0.00';return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-6 py-3 font-medium"><button onclick="openLawyerModal('${sanitize(k).replace(/'/g,"\\'")}' )" class="hover:underline font-semibold text-left flex items-center gap-2 group" style="color:var(--petrol-light)"><span class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0" style="background:linear-gradient(135deg,#f8fafc,#cbd5e1,#94a3b8);color:#04121a">${sanitize(k).substring(0,2).toUpperCase()}</span>${sanitize(k)}<i class="fa-solid fa-up-right-from-square text-[10px] opacity-0 group-hover:opacity-100"></i></button></td><td class="px-6 py-3 text-center"><span class="px-2 py-1 rounded text-xs font-bold" style="background:rgba(14,165,233,.1);color:#0ea5e9">${v.t}</span></td><td class="px-6 py-3 text-center text-slate-500">${v.w}</td><td class="px-6 py-3 text-center font-bold text-slate-700 dark:text-slate-200">${avg}</td><td class="px-6 py-3 text-center"><span class="status-badge badge-green">${v.ok}</span></td><td class="px-6 py-3 text-center"><span class="status-badge badge-red">${v.p}</span></td></tr>`;}).join('');}

// ── Clientes ──
function renderClients(){if(charts.cli)charts.cli.destroy();const el=document.getElementById('table-clients-detail');showTableSkeleton('table-clients-detail',4,5);if(!filteredData.length){el.innerHTML='';return;}const st={};filteredData.forEach(r=>{splitNames(r.cliente).forEach(c=>{if(!st[c])st[c]={count:0,totalWeight:0,statusMap:{}};st[c].count++;st[c].totalWeight+=r.peso;st[c].statusMap[r.status]=(st[c].statusMap[r.status]||0)+1;});});const s=Object.entries(st).sort((a,b)=>b[1].count-a[1].count).slice(0,20);charts.cli=new Chart(document.getElementById('chartClientsBar').getContext('2d'),{type:'bar',data:{labels:s.map(x=>sanitize(x[0].length>15?x[0].substring(0,15)+'…':x[0])),datasets:[{label:'Volume',data:s.map(x=>x[1].count),backgroundColor:'#94a3b8',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});el.innerHTML=s.map(([k,v])=>{const ts=Object.entries(v.statusMap).sort((a,b)=>b[1]-a[1])[0][0];return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">${sanitize(k)}</td><td class="px-6 py-3 text-center">${v.count}</td><td class="px-6 py-3 text-center text-slate-500">${v.totalWeight}</td><td class="px-6 py-3">${statusBadge(ts)}</td></tr>`;}).join('');}

// ── Tarefas ──
function renderTasks(){if(charts.task)charts.task.destroy();const el=document.getElementById('table-tasks-detail');showTableSkeleton('table-tasks-detail',4,5);if(!filteredData.length){el.innerHTML='';return;}const st={};filteredData.forEach(r=>{if(!st[r.tarefa])st[r.tarefa]={c:0,w:0,p:[0,0,0,0,0,0],a:{}};st[r.tarefa].c++;st[r.tarefa].w+=r.peso;const wk=(r.peso>=1&&r.peso<=5)?r.peso:PESO_PADRAO;st[r.tarefa].p[wk]++;splitNames(r.advogado).forEach(a=>st[r.tarefa].a[a]=(st[r.tarefa].a[a]||0)+1);});const s=Object.entries(st).sort((a,b)=>b[1].c-a[1].c).slice(0,15);const isDark=document.documentElement.classList.contains('dark');charts.task=new Chart(document.getElementById('chartTasks').getContext('2d'),{type:'bar',data:{labels:s.map(x=>sanitize(x[0])),datasets:PESO_FAIXAS.map((f,i)=>({label:f.rot,data:s.map(x=>x[1].p[i+1]),backgroundColor:(i===0&&isDark)?'#334155':f.cor}))},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}},plugins:{legend:{position:'top'}}}});const full=Object.entries(st).sort((a,b)=>b[1].c-a[1].c);el.innerHTML=full.map(([k,v])=>{const avgW=(v.w/v.c).toFixed(2),ta=Object.entries(v.a).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>sanitize(x[0])).join(', ');return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">${sanitize(k)}</td><td class="px-6 py-3 text-center font-bold text-slate-800 dark:text-white">${v.c}</td><td class="px-6 py-3 text-center font-bold text-sky-600 dark:text-sky-400">${avgW}</td><td class="px-6 py-3 text-xs text-slate-500">${ta}</td></tr>`;}).join('');}

// ── Peso ──
function renderWeight(){if(charts.w)charts.w.destroy();const el=document.getElementById('table-weight-detail');showTableSkeleton('table-weight-detail',6,5);if(!filteredData.length){el.innerHTML='';return;}const st={};filteredData.forEach(r=>{splitNames(r.advogado).forEach(a=>{if(!st[a])st[a]={p:[0,0,0,0,0,0],t:0,w:0};st[a].t++;st[a].w+=r.peso;const wk=(r.peso>=1&&r.peso<=5)?r.peso:PESO_PADRAO;st[a].p[wk]++;});});const s=Object.entries(st).sort((a,b)=>b[1].t-a[1].t);const isDark=document.documentElement.classList.contains('dark');charts.w=new Chart(document.getElementById('chartWeightStacked').getContext('2d'),{type:'bar',data:{labels:s.map(x=>sanitize(x[0])),datasets:PESO_FAIXAS.map((f,i)=>({label:f.rot,data:s.map(x=>x[1].p[i+1]),backgroundColor:(i===0&&isDark)?'#334155':f.cor}))},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true},y:{stacked:true}}}});el.innerHTML=s.map(([k,v])=>{const avg=(v.w/v.t).toFixed(2);return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">${sanitize(k)}</td>${PESO_FAIXAS.map((f,i)=>`<td class="px-6 py-3 text-center font-medium" style="color:${i===0?'#94a3b8':f.cor}">${v.p[i+1]}</td>`).join('')}<td class="px-6 py-3 text-center font-bold text-slate-700 dark:text-slate-200">${avg}</td></tr>`;}).join('');}

// ── Fluxo ──
function renderFlow(){const el=document.getElementById('table-flow-detail');if(!el)return;el.innerHTML='';if(!filteredData.length)return;const st={};filteredData.forEach(r=>{splitNames(r.advogado).forEach(a=>{if(!st[a])st[a]={ativ:0,subp:0,praz:0,total:0};st[a].total++;const fl=(r.fluxo||'').toLowerCase();if(fl.includes('subprazo'))st[a].subp++;else if(fl.includes('prazo'))st[a].praz++;else st[a].ativ++;});});const s=Object.entries(st).sort((a,b)=>b[1].total-a[1].total);el.innerHTML=s.map(([k,v])=>{const sa=sanitize(k);const btnAtiv=v.ativ>0?`<button onclick="openFluxoDetailModal(this.dataset.adv,'ativ')" data-adv="${sa}" title="Ver ${v.ativ} atividade(s)" class="font-bold px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors cursor-pointer text-slate-500 dark:text-slate-400">${v.ativ}</button>`:`<span class="text-slate-300 dark:text-slate-600">0</span>`;const btnSubp=v.subp>0?`<button onclick="openFluxoDetailModal(this.dataset.adv,'subp')" data-adv="${sa}" title="Ver ${v.subp} subprazo(s)" class="font-bold px-2 py-0.5 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors cursor-pointer text-amber-600 dark:text-amber-400">${v.subp}</button>`:`<span class="text-slate-300 dark:text-slate-600">0</span>`;const btnPraz=v.praz>0?`<button onclick="openFluxoDetailModal(this.dataset.adv,'praz')" data-adv="${sa}" title="Ver ${v.praz} prazo(s)" class="font-bold px-2 py-0.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors cursor-pointer text-rose-600 dark:text-rose-400">${v.praz}</button>`:`<span class="text-slate-300 dark:text-slate-600">0</span>`;return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-6 py-3 font-medium"><button onclick="openPrazoModal(this.dataset.name)" data-name="${sa}" class="hover:underline text-left" style="color:var(--petrol-light)">${sa}</button></td><td class="px-6 py-3 text-center font-medium">${btnAtiv}</td><td class="px-6 py-3 text-center font-medium">${btnSubp}</td><td class="px-6 py-3 text-center font-medium">${btnPraz}</td><td class="px-6 py-3 text-center font-bold text-slate-800 dark:text-white">${v.total}</td></tr>`;}).join('');}

// ── Modal Prazos ──
function openPrazoModal(adv){document.getElementById('modal-lawyer-name').innerText=adv;const pt={};filteredData.forEach(r=>{if((r.fluxo||'').toLowerCase().includes('prazo')&&splitNames(r.advogado).includes(adv)){const t=r.tarefa||'Indefinida';pt[t]=(pt[t]||0)+1;}});const s=Object.entries(pt).sort((a,b)=>b[1]-a[1]);document.getElementById('modal-prazos-body').innerHTML=s.length?s.map(([t,q])=>`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"><td class="px-6 py-3 font-medium text-slate-700 dark:text-slate-300">${sanitize(t)}</td><td class="px-6 py-3 text-center font-bold" style="color:var(--petrol-light)">${q}</td></tr>`).join(''):`<tr><td colspan="2" class="px-6 py-8 text-center text-slate-400">Nenhum prazo registrado.</td></tr>`;document.getElementById('modal-prazos').classList.remove('hidden');}
function closePrazoModal(){document.getElementById('modal-prazos').classList.add('hidden');}

// ── Modal Fluxo Detail ──
let _fluxoDetailAdv=null;
function openFluxoDetailModal(adv,tipo){
  _fluxoDetailAdv=adv;
  const tipoLabel={'ativ':'Atividades','subp':'Subprazos','praz':'Prazos'}[tipo]||tipo;
  const colorMap={'ativ':'#64748b','subp':'#d97706','praz':'#e11d48'};
  const iconMap={'ativ':'fa-tasks','subp':'fa-hourglass-half','praz':'fa-gavel'};
  const color=colorMap[tipo]||'#64748b';
  // ── Filter ──
  const filtered=filteredData.filter(r=>{
    if(!splitNames(r.advogado).includes(adv))return false;
    const fl=(r.fluxo||'').toLowerCase();
    if(tipo==='subp')return fl.includes('subprazo');
    if(tipo==='praz')return!fl.includes('subprazo')&&fl.includes('prazo');
    return!fl.includes('subprazo')&&!fl.includes('prazo');
  });
  // ── Header ──
  document.getElementById('modal-fluxo-detail-adv').innerText=adv;
  const tipoEl=document.getElementById('modal-fluxo-detail-tipo');
  tipoEl.innerText=tipoLabel;tipoEl.style.color=color;
  document.getElementById('modal-fluxo-detail-count').innerText=filtered.length;
  const iconWrap=document.getElementById('modal-fluxo-detail-icon-wrap');
  iconWrap.style.background=color;
  iconWrap.querySelector('i').className=`fa-solid ${iconMap[tipo]||'fa-layer-group'} text-sm text-white`;
  // ── Left panel: Empresas ──
  const cm={};filtered.forEach(r=>{const c=r.cliente||'—';cm[c]=(cm[c]||0)+1;});
  const companies=Object.entries(cm).sort((a,b)=>b[1]-a[1]);
  const maxC=companies[0]?.[1]||1;
  document.getElementById('modal-fluxo-empresas').innerHTML=companies.length
    ?companies.map(([n,c])=>`<div><div class="flex items-center justify-between mb-1"><span class="text-xs font-medium text-slate-600 dark:text-slate-300 truncate flex-1 mr-2" title="${sanitize(n)}">${sanitize(n)}</span><span class="text-xs font-black flex-shrink-0" style="color:${color}">${c}</span></div><div class="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"><div class="h-full rounded-full transition-all" style="background:${color};opacity:0.65;width:${Math.round((c/maxC)*100)}%"></div></div></div>`).join('')
    :`<p class="text-xs text-slate-400">—</p>`;
  // ── Left panel: Status ──
  const sm={};filtered.forEach(r=>{const s=r.status||'Indefinido';sm[s]=(sm[s]||0)+1;});
  const statuses=Object.entries(sm).sort((a,b)=>b[1]-a[1]);
  const maxS=statuses[0]?.[1]||1;
  document.getElementById('modal-fluxo-status').innerHTML=statuses.length
    ?statuses.map(([s,c])=>`<div class="flex items-center gap-2"><span class="text-[11px] text-slate-500 dark:text-slate-400 truncate flex-1" title="${sanitize(s)}">${sanitize(s)}</span><div class="w-14 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0"><div class="h-full rounded-full bg-slate-400 dark:bg-slate-500" style="width:${Math.round((c/maxS)*100)}%"></div></div><span class="text-[11px] font-bold text-slate-500 dark:text-slate-400 w-4 text-right flex-shrink-0">${c}</span></div>`).join('')
    :`<p class="text-xs text-slate-400">—</p>`;
  // ── Right panel: Process cards ──
  document.getElementById('modal-fluxo-detail-body').innerHTML=filtered.length
    ?filtered.map(r=>`<div class="flex items-start justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm transition-all bg-white dark:bg-slate-800/40 cursor-default"><div class="flex-1 min-w-0"><p class="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title="${sanitize(r.cliente||'')}">${sanitize(r.cliente||'—')}</p><p class="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title="${sanitize(r.tarefa||'')}">${sanitize(r.tarefa||'—')}</p><p class="text-[10px] font-mono text-slate-300 dark:text-slate-600 truncate mt-1">${sanitize(r.processo||'Sem nº')}</p></div><div class="flex-shrink-0 mt-0.5">${statusBadge(r.status)}</div></div>`).join('')
    :`<div class="py-16 text-center text-slate-400"><i class="fa-solid fa-inbox text-3xl mb-3 block opacity-30"></i><p class="text-sm">Nenhum registro encontrado.</p></div>`;
  document.getElementById('modal-fluxo-detail').classList.remove('hidden');
}
function closeFluxoDetailModal(){document.getElementById('modal-fluxo-detail').classList.add('hidden');_fluxoDetailAdv=null;}
function openFluxoRaioX(){const adv=_fluxoDetailAdv;if(adv){closeFluxoDetailModal();openLawyerModal(adv);}}

// ── Export ──
function exportToExcel(){if(!filteredData.length){showToast('Não há dados para exportar.','error');return;}const rows=filteredData.map(r=>({"Nº do Processo":r.processo||'N/A',"Advogado(s)":r.advogado,"Cliente":r.cliente,"Tarefa":r.tarefa,"Fluxo":r.fluxo,"Data Limite":r.dataLimiteStr?new Date(r.dataLimiteStr).toLocaleDateString('pt-BR'):'',"Status":r.status,"Peso":r.peso,"Origem do Peso":r.pesoOrigem==="planilha"?"coluna da planilha":(r.pesoOrigem==="tabela"?"tabela por tarefa":"padrão (tipo não classificado)")}));const ws=XLSX.utils.json_to_sheet(rows),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Tarefas");const h=new Date();XLSX.writeFile(wb,`Relatorio_Juridico_${String(h.getDate()).padStart(2,'0')}-${String(h.getMonth()+1).padStart(2,'0')}.xlsx`);}

// ── Sheet selector ──
function renderSheetSelector(names){const c=document.getElementById('sheets-container'),l=document.getElementById('sheets-list');if(names.length<=1){c.classList.add('hidden');return;}c.classList.remove('hidden');l.innerHTML='';names.forEach((n,i)=>{const b=document.createElement('button');b.className=`sheet-btn w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors border border-transparent ${i===0?'active':''}`;b.textContent=n;b.prepend(Object.assign(document.createElement('i'),{className:'fa-regular fa-file-lines mr-2'}));b.onclick=()=>switchSheetBtn(n,b);l.appendChild(b);});}
function switchSheetBtn(n,b){if(!currentWorkbook)return;document.querySelectorAll('.sheet-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');processSheetData(currentWorkbook,n);updateDashboard();}
function updateActiveSheetBtn(n){document.querySelectorAll('.sheet-btn').forEach(b=>{b.classList.remove('active');if(b.textContent.trim().includes(n))b.classList.add('active');});}

// ── Modal Raio-X Advogado ──
let activeLawyerTab='processos',lawyerDistChart=null;
function openLawyerModal(adv){
    const procs=filteredData.filter(r=>splitNames(r.advogado).includes(adv));if(!procs.length)return;
    const h=new Date();h.setHours(0,0,0,0);
    const tp=procs.length;
    const nAtiv=procs.filter(r=>{const fl=(r.fluxo||'').toLowerCase();return!fl.includes('subprazo')&&!fl.includes('prazo');}).length;
    const nSubp=procs.filter(r=>(r.fluxo||'').toLowerCase().includes('subprazo')).length;
    const nPraz=procs.filter(r=>{const fl=(r.fluxo||'').toLowerCase();return!fl.includes('subprazo')&&fl.includes('prazo');}).length;
    document.getElementById('modal-lawyer-detail-name').innerText=adv;document.getElementById('modal-lawyer-avatar').innerText=adv.substring(0,2).toUpperCase();
    document.getElementById('ld-kpi-total').innerText=tp;document.getElementById('ld-kpi-ativ').innerText=nAtiv;document.getElementById('ld-kpi-subp').innerText=nSubp;document.getElementById('ld-kpi-praz').innerText=nPraz;
    const uo={overdue:0,today:1,week:2,ok:3,'no-date':4},ps=new Date(h);ps.setDate(h.getDate()+7);
    function cu(r){if(DONE_RE.test(String(r.status||'')))return 'ok';if(!r.dataLimiteStr)return 'no-date';const d=new Date(r.dataLimiteStr);d.setHours(0,0,0,0);if(d<h)return 'overdue';if(d.getTime()===h.getTime())return 'today';if(d<=ps)return 'week';return 'ok';}
    const sorted=[...procs].sort((a,b)=>(uo[cu(a)]||99)-(uo[cu(b)]||99));
    document.getElementById('ld-table-processos').innerHTML=sorted.map(r=>`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-sm"><td class="px-5 py-2.5 text-xs text-slate-400 font-mono max-w-[110px] truncate">${sanitize(r.processo||'—')}</td><td class="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-300 max-w-[130px] truncate">${sanitize(r.cliente)}</td><td class="px-5 py-2.5 text-slate-500 dark:text-slate-400 max-w-[120px] truncate">${sanitize(r.tarefa)}</td><td class="px-5 py-2.5 whitespace-nowrap">${deadlineBadge(r.dataLimiteStr?new Date(r.dataLimiteStr):null,r.status)}</td><td class="px-5 py-2.5">${statusBadge(r.status)}</td></tr>`).join('');
    const urg=sorted.filter(r=>['overdue','today','week'].includes(cu(r)));const ue=document.getElementById('ld-table-urgentes'),eem=document.getElementById('ld-urgentes-empty');
    if(!urg.length){ue.innerHTML='';eem.classList.remove('hidden');}else{eem.classList.add('hidden');ue.innerHTML=urg.map(r=>{const df=r.dataLimiteStr?new Date(r.dataLimiteStr).toLocaleDateString('pt-BR'):'—';return`<tr class="border-b border-slate-200 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 text-sm"><td class="px-5 py-2.5">${deadlineBadge(r.dataLimiteStr?new Date(r.dataLimiteStr):null,r.status)}</td><td class="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">${sanitize(df)}</td><td class="px-5 py-2.5 text-xs text-slate-400 font-mono max-w-[110px] truncate">${sanitize(r.processo||'—')}</td><td class="px-5 py-2.5 font-medium text-slate-600 dark:text-slate-300">${sanitize(r.cliente)}</td><td class="px-5 py-2.5 text-slate-500 dark:text-slate-400">${sanitize(r.tarefa)}</td></tr>`;}).join('');}
    if(lawyerDistChart){lawyerDistChart.destroy();lawyerDistChart=null;}
    const pc=[0,0,0,0,0];procs.forEach(r=>{const i=Math.min(Math.max((r.peso||PESO_PADRAO),1),5)-1;pc[i]++;});
    const chartColors=PESO_FAIXAS.map(f=>f.cor);
    const dc=document.getElementById('chartLawyerDist');if(dc)lawyerDistChart=new Chart(dc.getContext('2d'),{type:'doughnut',data:{labels:PESO_FAIXAS.map(f=>f.rot),datasets:[{data:pc,backgroundColor:chartColors,borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},cutout:'68%'}});
    const ll=PESO_FAIXAS.map(f=>f.rot);
    document.getElementById('ld-dist-legend').innerHTML=pc.map((c,i)=>`<div class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-700/40 rounded-lg"><div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full flex-shrink-0" style="background:${chartColors[i]}"></span><span class="text-sm text-slate-600 dark:text-slate-300 font-medium">${ll[i]}</span></div><span class="text-sm font-black text-slate-800 dark:text-white">${c}</span></div>`).join('');
    const cm={};procs.forEach(r=>{cm[r.cliente]=(cm[r.cliente]||0)+1;});const tc=Object.entries(cm).sort((a,b)=>b[1]-a[1]),mx=tc[0]?.[1]||1;
    document.getElementById('ld-top-clients').innerHTML=tc.map(([n,c])=>`<div class="flex items-center gap-3"><span class="text-xs font-medium text-slate-600 dark:text-slate-300 min-w-0 flex-1 truncate">${sanitize(n)}</span><div class="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0"><div class="h-full rounded-full" style="background:linear-gradient(90deg,var(--petrol-light),var(--petrol-deep));width:${(c/mx)*100}%"></div></div><span class="text-xs font-bold text-slate-700 dark:text-slate-200 flex-shrink-0 w-5 text-right">${c}</span></div>`).join('');
    switchLawyerTab('processos');document.getElementById('modal-lawyer-detail').classList.remove('hidden');
}
function closeLawyerModal(){document.getElementById('modal-lawyer-detail').classList.add('hidden');if(lawyerDistChart){lawyerDistChart.destroy();lawyerDistChart=null;}}
function switchLawyerTab(tab){activeLawyerTab=tab;document.querySelectorAll('.lawyer-tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.lawyer-tab-content').forEach(c=>c.classList.add('hidden'));const b=document.getElementById('ltab-'+tab),c=document.getElementById('ltab-content-'+tab);if(b)b.classList.add('active');if(c)c.classList.remove('hidden');}

document.addEventListener('click',e=>{if(e.target.id==='modal-lawyer-detail')closeLawyerModal();if(e.target.id==='modal-prazos')closePrazoModal();if(e.target.id==='modal-fluxo-detail')closeFluxoDetailModal();if(e.target.id==='modal-email-config')closeEmailConfig();if(e.target.id==='modal-send-email')closeSendEmailModal();});
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!document.getElementById('modal-fluxo-detail').classList.contains('hidden'))closeFluxoDetailModal();else if(!document.getElementById('modal-lawyer-detail').classList.contains('hidden'))closeLawyerModal();else if(!document.getElementById('modal-prazos').classList.contains('hidden'))closePrazoModal();else if(!document.getElementById('modal-send-email').classList.contains('hidden'))closeSendEmailModal();else if(!document.getElementById('modal-email-config').classList.contains('hidden'))closeEmailConfig();});

// ── EmailJS ──
const EMAIL_CONFIG_KEY='juridico_emailjs_config';let _currentEmailPayload=null;
function getEmailConfig(){try{return JSON.parse(localStorage.getItem(EMAIL_CONFIG_KEY)||'null');}catch{return null;}}
function isEmailConfigured(){const c=getEmailConfig();return c&&c.publicKey&&c.serviceId&&c.templateId;}
function openEmailConfig(){const c=getEmailConfig();if(c){document.getElementById('cfg-public-key').value=c.publicKey||'';document.getElementById('cfg-service-id').value=c.serviceId||'';document.getElementById('cfg-template-id').value=c.templateId||'';document.getElementById('cfg-sender-name').value=c.senderName||'';}document.getElementById('cfg-status').classList.add('hidden');document.getElementById('modal-email-config').classList.remove('hidden');}
function closeEmailConfig(){document.getElementById('modal-email-config').classList.add('hidden');}
function saveEmailConfig(){const cfg={publicKey:document.getElementById('cfg-public-key').value.trim(),serviceId:document.getElementById('cfg-service-id').value.trim(),templateId:document.getElementById('cfg-template-id').value.trim(),senderName:document.getElementById('cfg-sender-name').value.trim()||'Jurídico Analytics'};if(!cfg.publicKey||!cfg.serviceId||!cfg.templateId){showCfgStatus('Preencha todos os campos.','error');return;}localStorage.setItem(EMAIL_CONFIG_KEY,JSON.stringify(cfg));emailjs.init(cfg.publicKey);showCfgStatus('✅ Configuração salva!','success');setTimeout(closeEmailConfig,1500);}
async function testEmailConfig(){const cfg={publicKey:document.getElementById('cfg-public-key').value.trim(),serviceId:document.getElementById('cfg-service-id').value.trim(),templateId:document.getElementById('cfg-template-id').value.trim(),senderName:document.getElementById('cfg-sender-name').value.trim()||'Jurídico Analytics'};if(!cfg.publicKey||!cfg.serviceId||!cfg.templateId){showCfgStatus('Preencha todos os campos.','error');return;}const ue=auth.currentUser?.email;if(!ue){showCfgStatus('Faça login para testar.','error');return;}showCfgStatus('⏳ Enviando...','info');try{emailjs.init(cfg.publicKey);await emailjs.send(cfg.serviceId,cfg.templateId,{to_name:'Administrador',to_email:ue,subject:'✅ Teste — Jurídico Analytics',process_list:'• [Teste] Cliente Exemplo — Petição (P3)',total:'1',sent_by:cfg.senderName,sent_date:new Date().toLocaleDateString('pt-BR')});showCfgStatus(`✅ E-mail enviado para ${ue}!`,'success');}catch(err){showCfgStatus(`❌ ${err.text||err.message}`,'error');}}
function showCfgStatus(msg,type){const el=document.getElementById('cfg-status'),styles={success:'bg-green-50 dark:bg-green-900/20 border-green-200 text-green-700 dark:text-green-400',error:'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-600 dark:text-red-400',info:'bg-amber-50 dark:bg-amber-900/20 border-amber-200 text-amber-700 dark:text-amber-400'};el.className=`text-xs text-center rounded-lg p-2 border ${styles[type]||styles.info}`;el.innerText=msg;el.classList.remove('hidden');}
function buildProcessList(rows){if(!rows||!rows.length)return '(nenhum processo)';return rows.map(r=>{const df=r.dataLimiteStr?new Date(r.dataLimiteStr).toLocaleDateString('pt-BR'):'Sem data';const h=new Date();h.setHours(0,0,0,0);const us=()=>{if(!r.dataLimiteStr)return 'Sem data';const d=new Date(r.dataLimiteStr);d.setHours(0,0,0,0);const diff=Math.round((d-h)/86400000);if(diff<0)return`⚠️ ATRASADO ${Math.abs(diff)}d`;if(diff===0)return'🔴 VENCE HOJE';if(diff<=7)return`🟡 Em ${diff} dia(s)`;return`🟢 Em ${diff} dias`;};const pr=r.processo?`[${r.processo}] `:'';return`• ${us()} | ${df} | ${pr}${r.cliente} — ${r.tarefa} (P${r.peso})`;}).join('\n');}
function openSendEmailModal(src){let rows=[],sub='',defSubj='',defName='';const h=new Date();h.setHours(0,0,0,0);const ps=new Date(h);ps.setDate(h.getDate()+7);if(src==='lawyer'){const ln=document.getElementById('modal-lawyer-detail-name').innerText;rows=filteredData.filter(r=>splitNames(r.advogado).includes(ln)&&r.dataLimiteStr&&new Date(r.dataLimiteStr)<=ps&&!DONE_RE.test(String(r.status||''))).sort((a,b)=>new Date(a.dataLimiteStr)-new Date(b.dataLimiteStr));sub=`Prazos urgentes de ${ln}`;defName=ln;defSubj=`⚠️ Seus prazos urgentes — ${new Date().toLocaleDateString('pt-BR')}`;}else{const fl={all:'Todos os prazos',overdue:'Prazos atrasados',today:'Vencem hoje',week:'Próximos 7 dias'};rows=filteredData.filter(r=>{if(!r.dataLimiteStr&&deadlineFilterActive!=='all')return false;if(deadlineFilterActive==='all')return!!r.dataLimiteStr;const isDone=DONE_RE.test(String(r.status||''));const d=new Date(r.dataLimiteStr);d.setHours(0,0,0,0);const diff=Math.round((d-h)/86400000);if(deadlineFilterActive==='overdue')return diff<0&&!isDone;if(deadlineFilterActive==='today')return diff===0&&!isDone;if(deadlineFilterActive==='week')return diff>0&&diff<=7&&!isDone;return true;}).sort((a,b)=>new Date(a.dataLimiteStr)-new Date(b.dataLimiteStr));sub=fl[deadlineFilterActive]||'Visão de prazos';defSubj=`📋 ${fl[deadlineFilterActive]||'Prazos'} — ${new Date().toLocaleDateString('pt-BR')}`;}
_currentEmailPayload={rows,src,sub};document.getElementById('send-modal-subtitle').innerText=sub;document.getElementById('send-to-name').value=defName;document.getElementById('send-to-email').value='';document.getElementById('send-subject').value=defSubj;document.getElementById('send-process-count').innerText=`${rows.length} processo(s)`;document.getElementById('send-preview').innerText=buildProcessList(rows);document.getElementById('send-status').classList.add('hidden');const nc=document.getElementById('send-no-config'),sb=document.getElementById('btn-send-email');if(isEmailConfigured()){nc.classList.add('hidden');sb.disabled=false;sb.classList.remove('opacity-50','cursor-not-allowed');emailjs.init(getEmailConfig().publicKey);}else{nc.classList.remove('hidden');sb.disabled=true;sb.classList.add('opacity-50','cursor-not-allowed');}document.getElementById('modal-send-email').classList.remove('hidden');}
function closeSendEmailModal(){document.getElementById('modal-send-email').classList.add('hidden');_currentEmailPayload=null;}
async function executeSendEmail(){if(!_currentEmailPayload)return;const cfg=getEmailConfig(),te=document.getElementById('send-to-email').value.trim(),tn=document.getElementById('send-to-name').value.trim()||'Advogado(a)',subj=document.getElementById('send-subject').value.trim(),btn=document.getElementById('btn-send-email');if(!te){showSendStatus('Digite o e-mail do destinatário.','error');return;}if(!te.includes('@')){showSendStatus('E-mail inválido.','error');return;}if(!_currentEmailPayload.rows.length){showSendStatus('Não há processos para enviar.','error');return;}const orig=btn.innerHTML;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin mr-2"></i>Enviando...';btn.disabled=true;showSendStatus('⏳ Enviando...','info');try{await emailjs.send(cfg.serviceId,cfg.templateId,{to_name:tn,to_email:te,subject:subj||_currentEmailPayload.sub,process_list:buildProcessList(_currentEmailPayload.rows),total:String(_currentEmailPayload.rows.length),sent_by:cfg.senderName||'Jurídico Analytics',sent_date:new Date().toLocaleDateString('pt-BR')});showSendStatus(`✅ E-mail enviado para ${te}!`,'success');showToast(`✅ E-mail enviado para ${tn}`,'success');btn.innerHTML='<i class="fa-solid fa-check mr-2"></i>Enviado!';setTimeout(closeSendEmailModal,2500);}catch(err){const em=err.text||err.message||'Erro desconhecido.';showSendStatus(`❌ ${em}`,'error');showToast('❌ Falha no envio.','error');btn.innerHTML=orig;btn.disabled=false;}}
(function(){const c=getEmailConfig();if(c&&c.publicKey)try{emailjs.init(c.publicKey);}catch(e){}})();