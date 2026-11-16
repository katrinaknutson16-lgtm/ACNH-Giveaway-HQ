import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const $=id=>document.getElementById(id),cfg=window.ACNH_CONFIG||{};
let client,user,groups=[],giveaways=[],view=new Date(),selected=dayKey(new Date()),editId=null,channel=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function dayKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function localInput(d){return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function colorFor(id){return groups.find(g=>g.id===id)?.color||'#7787a2'}
function groupName(id){return groups.find(g=>g.id===id)?.name||'Unknown group'}
function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)}
function error(e){alert(e?.message||String(e))}

async function init() {
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) return;

  client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => setSession(session), 0);
  });

  // Display the sign-in screen immediately.
  $('setup').classList.add('hidden');
  $('auth').classList.remove('hidden');

  try {
    const { data, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      console.error('Supabase session error:', sessionError);
    }

    await setSession(data?.session ?? null);
  } catch (err) {
    console.error('Authentication initialization failed:', err);
    $('auth').classList.remove('hidden');
  }
}

async function setSession(session){const next=session?.user||null;if(user?.id===next?.id)return;user=next;$('auth').classList.toggle('hidden',!!user);$('app').classList.toggle('hidden',!user);if(channel){await client.removeChannel(channel);channel=null}if(!user)return;$('who').textContent='Signed in: '+user.email;await refresh();channel=client.channel('my-planner-'+user.id).on('postgres_changes',{event:'*',schema:'public',table:'groups',filter:'user_id=eq.'+user.id},refresh).on('postgres_changes',{event:'*',schema:'public',table:'giveaways',filter:'user_id=eq.'+user.id},refresh).subscribe()}
async function refresh(){if(!user)return;const [a,b]=await Promise.all([client.from('groups').select('*').eq('user_id',user.id).order('created_at'),client.from('giveaways').select('*').eq('user_id',user.id).order('closes_at')]);if(a.error||b.error){$('syncStatus').textContent='Sync error';return error(a.error||b.error)}groups=a.data;giveaways=b.data;$('syncStatus').textContent='☁️ Synced';render()}
async function authAction(kind){const email=$('email').value.trim(),password=$('password').value;$('authMsg').textContent='';let result;if(kind==='in')result=await client.auth.signInWithPassword({email,password});if(kind==='up')result=await client.auth.signUp({email,password});if(kind==='google')result=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(kind==='reset')result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(result.error)$('authMsg').textContent=result.error.message;else if(kind==='up')$('authMsg').textContent='Account created. Check your email if confirmation is enabled.';else if(kind==='reset')$('authMsg').textContent='Check your email for a password reset link.'}
$('signIn').onclick=()=>authAction('in');$('signUp').onclick=()=>authAction('up');$('google').onclick=()=>authAction('google');$('reset').onclick=()=>authAction('reset');$('logout').onclick=()=>client.auth.signOut();
$('addGroup').onclick=()=>$('groupDialog').showModal();$('groupForm').onsubmit=async e=>{e.preventDefault();const {error:err}=await client.from('groups').insert({user_id:user.id,name:$('groupName').value.trim(),color:$('groupColor').value});if(err)return error(err);$('groupDialog').close();$('groupForm').reset();await refresh()};
function render(){const now=Date.now();$('openCount').textContent=giveaways.filter(x=>x.status==='open').length;$('actionCount').textContent=giveaways.filter(x=>x.status==='draw'||x.status==='announce'||(x.status==='open'&&new Date(x.closes_at).getTime()<now)).length;$('doneCount').textContent=giveaways.filter(x=>x.status==='done').length;
$('groups').innerHTML=groups.length?groups.map(g=>`<span class="pill" style="background:${esc(g.color)}22;border:1px solid ${esc(g.color)};color:#34405b">${esc(g.name)}</span>`).join(''):'<span class="muted">No groups yet. Add your first group.</span>';
$('filter').innerHTML='<option value="all">All groups</option><option value="attention">Needs attention</option>'+groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
$('month').textContent=view.toLocaleDateString('en-US',{month:'long',year:'numeric'});$('weekdays').innerHTML=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(x=>`<div class="week">${x}</div>`).join('');let first=new Date(view.getFullYear(),view.getMonth(),1),start=new Date(first);start.setDate(start.getDate()-first.getDay());let html='';for(let i=0;i<42;i++){let d=new Date(start);d.setDate(start.getDate()+i);let k=dayKey(d),items=giveaways.filter(x=>dayKey(new Date(x.closes_at))===k);html+=`<div class="day ${k===selected?'active':''} ${d.getMonth()!==view.getMonth()?'other':''}" data-day="${k}"><b style="font-size:12px">${d.getDate()}</b>${items.slice(0,3).map(x=>`<div class="event" style="background:${colorFor(x.group_id)}33">${esc(x.title)}</div>`).join('')}${items.length>3?'<small>+'+(items.length-3)+'</small>':''}</div>`}$('calendar').innerHTML=html;
$('dayTitle').textContent=new Date(selected+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});const day=giveaways.filter(x=>dayKey(new Date(x.closes_at))===selected);$('dayList').innerHTML=day.length?day.map(item).join(''):'<p class="muted">No closing deadlines this day.</p>';
const f=$('filter').value;let arr=giveaways.filter(x=>f==='all'||(f==='attention'?x.status!=='done':x.group_id===f));$('giveawayList').innerHTML=arr.length?arr.map(item).join(''):'<p class="muted">Nothing here yet. Add a giveaway to begin.</p>'}
function item(x){const status={open:'Open',draw:'Choose winner',announce:'Announce winner',done:'Completed'}[x.status];return `<article><span class="pill" style="background:${colorFor(x.group_id)}33">${esc(groupName(x.group_id))}</span> <span class="muted">${new Date(x.closes_at).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</span><div><b>${esc(x.title)}</b></div><div class="muted">${status} · ${esc(x.prize)}${x.winner?' · Winner: '+esc(x.winner):''}</div><div class="row" style="margin-top:8px">${x.status!=='done'?`<button data-action="advance" data-id="${x.id}">${x.status==='open'?'Close entries':x.status==='draw'?'Winner chosen':'Mark announced'}</button>`:''}<button data-action="edit" data-id="${x.id}">Edit</button><button class="danger" data-action="delete" data-id="${x.id}">Delete</button></div></article>`}
function openGiveaway(x){if(!groups.length)return alert('Add a group first.');editId=x?.id||null;$('formTitle').textContent=x?'Edit giveaway':'New giveaway';$('title').value=x?.title||'';$('groupId').innerHTML=groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');$('groupId').value=x?.group_id||groups[0].id;$('postedAt').value=x?.posted_at?localInput(new Date(x.posted_at)):localInput(new Date());$('closesAt').value=x?.closes_at?localInput(new Date(x.closes_at)):localInput(new Date(Date.now()+86400000));$('prize').value=x?.prize||'';$('status').value=x?.status||'open';$('winner').value=x?.winner||'';$('giveawayDialog').showModal()}
$('addGiveaway').onclick=()=>openGiveaway();$('giveawayForm').onsubmit=async e=>{e.preventDefault();const row={user_id:user.id,group_id:$('groupId').value,title:$('title').value.trim(),posted_at:$('postedAt').value?new Date($('postedAt').value).toISOString():null,closes_at:new Date($('closesAt').value).toISOString(),prize:$('prize').value,status:$('status').value,winner:$('winner').value};if(!row.title||!Number.isFinite(Date.parse(row.closes_at)))return alert('Enter a title and closing date.');if(row.posted_at&&row.posted_at>row.closes_at)return alert('Closing must be after posting.');const q=editId?client.from('giveaways').update(row).eq('id',editId).eq('user_id',user.id):client.from('giveaways').insert(row);const {error:err}=await q;if(err)return error(err);$('giveawayDialog').close();await refresh()};
document.addEventListener('click',async e=>{const d=e.target.closest('[data-day]');if(d){selected=d.dataset.day;render();return}const btn=e.target.closest('[data-action]');if(!btn)return;const x=giveaways.find(g=>g.id===btn.dataset.id);if(!x)return;if(btn.dataset.action==='edit')return openGiveaway(x);if(btn.dataset.action==='delete'&&!confirm('Delete this giveaway?'))return;let q;if(btn.dataset.action==='delete')q=client.from('giveaways').delete().eq('id',x.id).eq('user_id',user.id);else q=client.from('giveaways').update({status:{open:'draw',draw:'announce',announce:'done'}[x.status]}).eq('id',x.id).eq('user_id',user.id);const {error:err}=await q;if(err)return error(err);await refresh()});
$('prev').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1);render()};$('next').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1);render()};$('filter').onchange=render;
$('backup').onclick=()=>download(JSON.stringify({groups,giveaways,exportedAt:new Date().toISOString()},null,2),'ACNH-HQ-backup.json','application/json');
$('starter').onclick=async()=>{if(groups.length&&!confirm('Add Star Crafters and Inner Circle to your existing groups?'))return;const names=[['ACNH Star Crafters','#4489d4'],['ACNH Inner Circle','#9362c5']];for(const [name,color] of names){if(groups.some(g=>g.name===name))continue;const {error:err}=await client.from('groups').insert({user_id:user.id,name,color});if(err)return error(err)}await refresh();alert('Your two starter groups are ready. Add upcoming giveaways using their actual closing dates.')};
function utc(d){return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}function icsEsc(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
$('exportIcs').onclick=()=>{let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//ACNH Giveaway HQ//EN'];for(const x of giveaways.filter(x=>x.status!=='done')){let d=new Date(x.closes_at);lines.push('BEGIN:VEVENT','UID:'+x.id+'@acnh-hq','DTSTAMP:'+utc(new Date()),'DTSTART:'+utc(d),'DTEND:'+utc(new Date(d.getTime()+600000)),'SUMMARY:'+icsEsc('Close '+groupName(x.group_id)+': '+x.title),'DESCRIPTION:'+icsEsc(x.prize),'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M','DESCRIPTION:Close giveaway','END:VALARM','END:VEVENT')}lines.push('END:VCALENDAR');download(lines.join('\r\n'),'ACNH-HQ-alerts.ics','text/calendar')};
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});init().catch(error);
