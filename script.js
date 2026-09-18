const STORAGE_KEY="attendance_keeper_v1";
const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const $=id=>document.getElementById(id);
let state=loadState();
let currentDay=DAYS[(new Date().getDay()+6)%7];

function defaultState(){return{subjects:[],classes:[],logs:{},theme:"dark"}}
function loadState(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||defaultState()}catch{return defaultState()}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function subjectById(id){return state.subjects.find(s=>s.id===id)}
function stats(s){const arr=state.logs[s.id]||[];const p=arr.filter(v=>v==="P").length,a=arr.filter(v=>v==="A").length,t=p+a;return{p,a,t,pct:t?p/t*100:0}}
function fmtTime(t){if(!t)return"";let[h,m]=t.split(":").map(Number),ap=h>=12?"PM":"AM";h=h%12||12;return`${h}:${String(m).padStart(2,"0")} ${ap}`}
function targetClass(s){const x=stats(s),t=Number(s.target)||75;return x.t===0?"warn":x.pct>=t?"good":"bad"}
function semesterPlan(s){
  const x=stats(s),target=Number(s.target)||75,leftRaw=Number(s.semesterClassesLeft);
  if(!Number.isFinite(leftRaw)||leftRaw<0)return null;
  const left=Math.floor(leftRaw),finalTotal=x.t+left;
  const maxMisses=Math.max(0,Math.floor(finalTotal-x.p-(target/100)*finalTotal));
  let needed=0;
  while(needed<10000&&x.t+needed>0&&((x.p+needed)/(x.t+needed))*100<target)needed++;
  return{left,maxMisses,needed};
}
function showToast(msg){$("toast").textContent=msg;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),1700)}

function go(name){
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  $(`page-${name}`).classList.add("active");
  document.querySelectorAll(".nav").forEach(n=>n.classList.toggle("active",n.dataset.go===name));
  if(name==="dashboard")renderDashboard();
  if(name==="subjects")renderSubjects();
  if(name==="timetable")renderTimetable();
  if(name==="attendance")renderAttendance();
}
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));

function totals(){
  return state.subjects.reduce((a,s)=>{const x=stats(s);a.p+=x.p;a.a+=x.a;return a},{p:0,a:0})
}
function renderDashboard(){
  const t=totals(),total=t.p+t.a,pct=total?t.p/total*100:0;
  $("overallPct").textContent=pct.toFixed(1)+"%";
  $("overallRing").style.background=`conic-gradient(var(--accent) ${pct*3.6}deg,#293247 ${pct*3.6}deg)`;
  $("overallRing").querySelector("span").textContent=Math.round(pct)+"%";
  $("overallMessage").textContent=total?(pct>=75?"Overall attendance is at or above 75%.":"Overall attendance is below 75%."):"Add a subject to begin.";
  $("presentTotal").textContent=t.p;$("absentTotal").textContent=t.a;$("classTotal").textContent=total;
  const today=DAYS[(new Date().getDay()+6)%7];
  const classes=state.classes.filter(c=>c.day===today).sort((a,b)=>a.start.localeCompare(b.start));
  $("todayClasses").innerHTML=classes.length?classes.map(classCard).join(""):`<div class="empty">No classes scheduled for ${today}.</div>`;
  $("dashboardSubjects").innerHTML=state.subjects.length?state.subjects.map(subjectCard).join(""):`<div class="empty">No subjects yet. Add your first subject.</div>`;
  bindMarks();
}
function subjectCard(s){
  const x=stats(s),target=Number(s.target)||75,plan=semesterPlan(s);
  const advice=x.t?(x.pct>=target?`Safe margin: you can miss ${Math.max(0,Math.floor((x.p-target*x.t/100)/(target/100)))} more class${Math.max(0,Math.floor((x.p-target*x.t/100)/(target/100)))===1?"":"es"}.`:`Attend about ${Math.max(1,Math.ceil((target*x.t/100-x.p)/(1-target/100)))} consecutive classes to reach ${target}%.`):"No attendance marked yet.";
  const semesterInfo=plan?`<div class="semester-info"><b>Semester classes left:</b> ${plan.left}<br>${plan.maxMisses===0?`No additional absences can be taken if you want to finish at ${target}%.`:`You can miss up to <b>${plan.maxMisses}</b> more class${plan.maxMisses===1?"":"es"} and still finish at ${target}%.`}<br>${plan.needed===0?`Already at or above ${target}%.`:`Attend the next <b>${plan.needed}</b> consecutive class${plan.needed===1?"":"es"} to reach ${target}%.`}</div>`:`<div class="semester-info"><b>Semester classes left:</b> Not set</div>`;
  return `<div class="card"><div class="subject-card"><div class="subject-dot"></div><div class="grow"><div class="title">${esc(s.name)}</div><div class="subline">${esc(s.code||"No code")} • ${esc(s.teacher||"No teacher")} ${s.room?`• ${esc(s.room)}`:""}</div></div><div class="pct ${targetClass(s)}">${x.pct.toFixed(0)}%</div></div><div class="progress"><span style="width:${Math.min(100,x.pct)}%"></span></div><div class="subline">${x.p} present · ${x.a} absent · Target ${target}%<br>${advice}</div>${semesterInfo}<div class="actions"><button class="present" data-mark="${s.id}:P">✓ Present</button><button class="absent" data-mark="${s.id}:A">✕ Absent</button></div></div>`;
}

function classCard(c){
  const s=subjectById(c.subjectId);if(!s)return"";
  return `<div class="card class-card"><div class="time">${fmtTime(c.start)}<br>${fmtTime(c.end)}</div><div class="class-info"><div class="title">${esc(s.name)}</div><div class="subline">${esc(s.code||"")} ${s.room?`• ${esc(s.room)}`:""}</div></div><button data-mark="${s.id}:P" title="Mark present">✓</button></div>`;
}
function bindMarks(){
  document.querySelectorAll("[data-mark]").forEach(b=>b.onclick=()=>{
    const [sid,v]=b.dataset.mark.split(":");
    (state.logs[sid]??=[]).push(v);save();showToast(v==="P"?"Marked present":"Marked absent");
    renderDashboard();if($("page-attendance").classList.contains("active"))renderAttendance();
  });
}

function renderSubjects(){
  $("subjectsList").innerHTML=state.subjects.length?state.subjects.map(s=>{
    const x=stats(s);
    return `<div class="card">
      <div class="subject-card"><div class="subject-dot"></div><div class="grow"><div class="title">${esc(s.name)}</div><div class="subline">${esc(s.code||"No code")} • ${esc(s.teacher||"No teacher")} ${s.room?`• ${esc(s.room)}`:""}</div></div><div class="pct ${targetClass(s)}">${x.pct.toFixed(0)}%</div></div>
      <div class="actions"><button class="secondary" data-edit="${s.id}">Edit</button><button class="delete" data-remove="${s.id}">Delete</button></div>
    </div>`;
  }).join(""):`<div class="empty">No subjects yet.<br><br>Tap “+ Add subject” to create one.</div>`;
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openSubject(b.dataset.edit));
  document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{
    const sid=b.dataset.remove;if(!confirm("Delete this subject and its timetable/attendance records?"))return;
    state.subjects=state.subjects.filter(s=>s.id!==sid);state.classes=state.classes.filter(c=>c.subjectId!==sid);delete state.logs[sid];save();renderSubjects();showToast("Subject deleted");
  });
}

function renderTimetable(){
  $("dayTabs").innerHTML=DAYS.map(d=>`<button class="day-tab ${d===currentDay?"active":""}" data-day="${d}">${d.slice(0,3)}</button>`).join("");
  document.querySelectorAll("[data-day]").forEach(b=>b.onclick=()=>{currentDay=b.dataset.day;renderTimetable()});
  const list=state.classes.filter(c=>c.day===currentDay).sort((a,b)=>a.start.localeCompare(b.start));
  $("timetableList").innerHTML=list.length?list.map(c=>{
    const s=subjectById(c.subjectId);
    return `<div class="card class-card"><div class="time">${fmtTime(c.start)}<br>${fmtTime(c.end)}</div><div class="class-info"><div class="title">${esc(s?.name||"Deleted subject")}</div><div class="subline">${esc(s?.code||"")} ${s?.room?`• ${esc(s.room)}`:""} • ${c.repeat==="weekly"?"Every week":"One-time"}</div></div><button class="delete" data-class-remove="${c.id}">×</button></div>`;
  }).join(""):`<div class="empty">No classes on ${currentDay}. Tap “+ Add class”.</div>`;
  document.querySelectorAll("[data-class-remove]").forEach(b=>b.onclick=()=>{state.classes=state.classes.filter(c=>c.id!==b.dataset.classRemove);save();renderTimetable();showToast("Class removed")});
}
function renderAttendance(){
  $("attendanceList").innerHTML=state.subjects.length?state.subjects.map(subjectCard).join(""):`<div class="empty">Add subjects first.</div>`;
  bindMarks();
}

function openSubject(editId=null){
  $("subjectForm").reset();$("subjectId").value=editId||"";
  $("subjectModalTitle").textContent=editId?"Edit subject":"Add subject";
  if(editId){const s=subjectById(editId);$("subjectName").value=s.name;$("subjectCode").value=s.code||"";$("subjectTeacher").value=s.teacher||"";$("subjectRoom").value=s.room||"";$("subjectTarget").value=s.target||75;$("semesterClassesLeft").value=s.semesterClassesLeft??""}
  $("subjectModal").classList.remove("hidden");
}
$("addSubject").onclick=()=>openSubject();$("quickSubject").onclick=()=>openSubject();
$("subjectForm").onsubmit=e=>{
  e.preventDefault();const sid=$("subjectId").value||id();
  const leftValue=$("semesterClassesLeft").value;const data={id:sid,name:$("subjectName").value.trim(),code:$("subjectCode").value.trim(),teacher:$("subjectTeacher").value.trim(),room:$("subjectRoom").value.trim(),target:Number($("subjectTarget").value)||75,semesterClassesLeft:leftValue===""?null:Math.max(0,Math.floor(Number(leftValue)))};
  const idx=state.subjects.findIndex(s=>s.id===sid);idx>=0?state.subjects[idx]=data:state.subjects.push(data);
  save();closeModal("subjectModal");renderSubjects();renderDashboard();showToast(idx>=0?"Subject updated":"Subject added");
};

function openClass(){
  if(!state.subjects.length){showToast("Add a subject first");openSubject();return}
  $("classSubject").innerHTML=state.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("");
  $("classDay").innerHTML=DAYS.map(d=>`<option value="${d}" ${d===currentDay?"selected":""}>${d}</option>`).join("");
  $("classStart").value="09:00";$("classEnd").value="10:00";$("classRepeat").value="weekly";
  $("classModal").classList.remove("hidden");
}
$("addClass").onclick=openClass;
$("classForm").onsubmit=e=>{
  e.preventDefault();const start=$("classStart").value,end=$("classEnd").value;
  if(end<=start){showToast("End time must be after start time");return}
  state.classes.push({id:id(),subjectId:$("classSubject").value,day:$("classDay").value,start,end,repeat:$("classRepeat").value});
  currentDay=$("classDay").value;save();closeModal("classModal");renderTimetable();renderDashboard();showToast("Class added");
};

function closeModal(id){$(id).classList.add("hidden")}
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));

$("themeBtn").onclick=()=>{state.theme=state.theme==="light"?"dark":"light";applyTheme();save()};
function applyTheme(){document.body.classList.toggle("light",state.theme==="light")}
applyTheme();renderDashboard();

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
