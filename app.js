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

/* ACNH Giveaway HQ — interactive schedule and calendar */
let scheduledPosts = [];
let scheduleGroupFilter = 'all';
let editingPostId = null;

const schedulePanel = document.createElement('section');
schedulePanel.className = 'panel';
schedulePanel.innerHTML = `
  <h2>📅 My Weekly Schedule</h2>
  <p class="muted">Your private posting checklist. Nothing here posts to Facebook.</p>
  <div class="row">
    <button id="importSchedule" class="primary">📥 Import Schedule</button>
    <button id="refreshSchedule">🔄 Refresh Schedule</button>
  </div>
  <div id="scheduledPostList"></div>`;
$('app').appendChild(schedulePanel);

const calendarFilter = document.createElement('label');
calendarFilter.textContent = 'Show calendar for';
calendarFilter.style.marginTop = '12px';
const calendarGroupSelect = document.createElement('select');
calendarGroupSelect.id = 'calendarGroupFilter';
calendarFilter.appendChild(calendarGroupSelect);
$('calendar').parentElement.insertBefore(calendarFilter, $('weekdays'));
calendarGroupSelect.onchange = () => { scheduleGroupFilter = calendarGroupSelect.value; render(); };

const editDialog = document.createElement('dialog');
editDialog.innerHTML = `<h2>Edit scheduled post</h2>
<form id="editScheduleForm">
<label>Title<input id="scheduleTitle" required maxlength="180"></label>
<label>Group<select id="scheduleGroup" required></select></label>
<label>Posting date and time<input id="scheduleDate" type="datetime-local" required></label>
<label>Type<select id="scheduleType"><option value="engagement">Engagement</option><option value="game">Game</option><option value="giveaway">Giveaway</option></select></label>
<label>Notes<textarea id="scheduleNotes" rows="3"></textarea></label>
<div class="row"><button class="primary" type="submit">Save changes</button><button type="button" id="cancelScheduleEdit">Cancel</button></div>
</form>`;
document.body.appendChild(editDialog);
$('cancelScheduleEdit').onclick = () => editDialog.close();

function groupAllowed(groupId) { return scheduleGroupFilter === 'all' || scheduleGroupFilter === groupId; }
function updateCalendarGroupFilter() {
  const selectedValue = scheduleGroupFilter;
  calendarGroupSelect.innerHTML = '<option value="all">💙💜 Both groups</option>' +
    groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('');
  if (selectedValue !== 'all' && !groups.some(g => g.id === selectedValue)) scheduleGroupFilter = 'all';
  calendarGroupSelect.value = scheduleGroupFilter;
}
function scheduledPostHtml(post) {
  return `<article>
    <span class="pill" style="background:${colorFor(post.group_id)}33">${esc(groupName(post.group_id))}</span>
    <div><b>${esc(post.title)}</b></div>
    <div class="muted">${new Date(post.scheduled_at).toLocaleString('en-US', {dateStyle:'medium',timeStyle:'short'})}</div>
    ${post.notes ? `<div class="muted">${esc(post.notes)}</div>` : ''}
    <div class="row" style="margin-top:8px">
      <button type="button" data-posted-id="${post.id}" class="${post.completed?'':'primary'}">${post.completed?'↩ Mark as Not Posted':'✓ Mark as Posted'}</button>
      <button type="button" data-schedule-edit="${post.id}">✏️ Edit</button>
      <button type="button" class="danger" data-schedule-delete="${post.id}">Delete</button>
      ${post.post_type === 'giveaway' ? `<button type="button" data-schedule-deadline="${post.id}">🎁 Add 24h closing deadline</button>` : ''}
      <span class="muted">${post.completed?'✅ Posted':'⏳ Not posted yet'}</span>
    </div>
  </article>`;
}
function renderScheduledPosts() {
  updateCalendarGroupFilter();
  const visible = scheduledPosts.filter(p => groupAllowed(p.group_id));
  $('scheduledPostList').innerHTML = visible.length ? visible.map(scheduledPostHtml).join('') :
    '<p class="muted">No scheduled posts for this selection.</p>';

  // The original calendar renderer recreates the day cells each time.
  document.querySelectorAll('#calendar [data-day]').forEach(day => {
    const date = day.dataset.day;
    const dayPosts = visible.filter(p => dayKey(new Date(p.scheduled_at)) === date);
    const existing = [...day.querySelectorAll('.event')].length;
    dayPosts.slice(0, Math.max(0, 4 - existing)).forEach(post => {
      const event = document.createElement('div');
      event.className = 'event';
      event.style.background = colorFor(post.group_id) + '33';
      event.title = `${post.title} — ${new Date(post.scheduled_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
      event.textContent = `${post.completed?'✓':'📌'} ${post.title}`;
      day.appendChild(event);
    });
    if (dayPosts.length > Math.max(0, 4 - existing)) {
      const more = document.createElement('small');
      more.textContent = ` +${dayPosts.length - Math.max(0, 4 - existing)} posts`;
      day.appendChild(more);
    }
  });

  const dayPosts = visible.filter(p => dayKey(new Date(p.scheduled_at)) === selected);
  const deadlines = giveaways.filter(g => groupAllowed(g.group_id) && dayKey(new Date(g.closes_at)) === selected);
  $('dayList').innerHTML = `<h3>📌 Scheduled posts</h3>` +
    (dayPosts.length ? dayPosts.map(scheduledPostHtml).join('') : '<p class="muted">No posts scheduled this day.</p>') +
    `<h3>🎁 Giveaway closing deadlines</h3>` +
    (deadlines.length ? deadlines.map(item).join('') : '<p class="muted">No giveaway closing deadlines this day.</p>');
}

async function loadScheduledPosts() {
  if (!user) return;
  const {data, error:err} = await client.from('scheduled_posts').select('*')
    .eq('user_id',user.id).order('scheduled_at');
  if (err) { console.error(err); $('scheduledPostList').textContent = err.message; return; }
  scheduledPosts = data || [];
  render();
}
const originalRefresh = refresh;
refresh = async function() { await originalRefresh(); await loadScheduledPosts(); };
const originalRender = render;
render = function() {
  // Keep the existing giveaway filter; this filter controls calendar events only.
  originalRender();
  // Hide deadlines for other groups in the calendar and replace its day details.
  if (scheduleGroupFilter !== 'all') {
    document.querySelectorAll('#calendar [data-day]').forEach(day => {
      day.querySelectorAll('.event').forEach(el => el.remove());
      giveaways.filter(g => groupAllowed(g.group_id) && dayKey(new Date(g.closes_at)) === day.dataset.day)
        .slice(0,3).forEach(g => {
          const el = document.createElement('div'); el.className = 'event';
          el.style.background = colorFor(g.group_id)+'33'; el.textContent = '🎁 '+g.title;
          day.appendChild(el);
        });
    });
  }
  renderScheduledPosts();
};
$('refreshSchedule').onclick = loadScheduledPosts;

$('importSchedule').onclick = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    try {
      const file = input.files?.[0]; if (!file) return;
      const records = JSON.parse(await file.text());
      if (!Array.isArray(records)) throw new Error('Schedule file must contain a list of posts.');
      if (!groups.length) throw new Error('Load your starter groups first.');
      const {data, error:err} = await client.from('scheduled_posts').select('import_key').eq('user_id',user.id);
      if (err) throw err;
      const keys = new Set((data||[]).map(x=>x.import_key).filter(Boolean));
      const rows=[];
      for (const post of records) {
        const group = groups.find(g=>g.name===post.group);
        if (!group) throw new Error('Unknown group: '+post.group);
        const date = new Date(post.scheduled_at);
        if (!post.title || !Number.isFinite(date.getTime())) throw new Error('Invalid title/date for '+post.title);
        const key=post.import_key||`${post.group}|${post.title}|${date.toISOString()}`;
        if (keys.has(key)) continue;
        keys.add(key);
        rows.push({user_id:user.id,group_id:group.id,title:post.title,scheduled_at:date.toISOString(),
          post_type:post.post_type||'engagement',notes:post.notes||'',import_key:key});
      }
      if (rows.length) {
        const {error:insertError}=await client.from('scheduled_posts').insert(rows);
        if (insertError) throw insertError;
      }
      await loadScheduledPosts();
      alert(`Imported ${rows.length} new scheduled posts!`);
    } catch(err) {console.error(err);alert('Import failed: '+err.message);}
  };
  input.click();
};

function openScheduleEdit(post) {
  editingPostId = post.id;
  $('scheduleTitle').value=post.title;
  $('scheduleGroup').innerHTML=groups.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join('');
  $('scheduleGroup').value=post.group_id;
  $('scheduleDate').value=localInput(new Date(post.scheduled_at));
  $('scheduleType').value=['engagement','game','giveaway'].includes(post.post_type)?post.post_type:'engagement';
  $('scheduleNotes').value=post.notes||'';
  editDialog.showModal();
}
$('editScheduleForm').onsubmit=async event => {
  event.preventDefault();
  const date=new Date($('scheduleDate').value);
  if (!Number.isFinite(date.getTime())) return alert('Enter a valid date and time.');
  const {error:err}=await client.from('scheduled_posts').update({
    title:$('scheduleTitle').value.trim(),group_id:$('scheduleGroup').value,
    scheduled_at:date.toISOString(),post_type:$('scheduleType').value,notes:$('scheduleNotes').value
  }).eq('id',editingPostId).eq('user_id',user.id);
  if (err) return error(err);
  editDialog.close(); await loadScheduledPosts();
};

document.addEventListener('click',async event=>{
  const button=event.target.closest('[data-posted-id],[data-schedule-edit],[data-schedule-delete],[data-schedule-deadline]');
  if (!button || !user || !client) return;
  const id=button.dataset.postedId||button.dataset.scheduleEdit||button.dataset.scheduleDelete||button.dataset.scheduleDeadline;
  const post=scheduledPosts.find(p=>p.id===id); if (!post) return;
  if (button.dataset.scheduleEdit) return openScheduleEdit(post);
  if (button.dataset.scheduleDelete) {
    if (!confirm('Delete this scheduled post from your private tracker?')) return;
    const {error:err}=await client.from('scheduled_posts').delete().eq('id',id).eq('user_id',user.id);
    if (err) return error(err);
    return loadScheduledPosts();
  }
  if (button.dataset.scheduleDeadline) {
    const postedAt=new Date(post.scheduled_at), closesAt=new Date(postedAt.getTime()+24*60*60*1000);
    const duplicate=giveaways.some(g=>g.group_id===post.group_id && g.title===post.title &&
      Math.abs(new Date(g.closes_at)-closesAt)<60000);
    if (duplicate) return alert('This closing deadline is already tracked.');
    if (!confirm(`Add a giveaway closing deadline for ${post.title}, 24 hours after its planned posting time? This is only a tracker entry.`)) return;
    const {error:err}=await client.from('giveaways').insert({user_id:user.id,group_id:post.group_id,
      title:post.title,posted_at:postedAt.toISOString(),closes_at:closesAt.toISOString(),status:'open',prize:post.notes||''});
    if (err) return error(err);
    return refresh();
  }
  button.disabled=true;
  const {error:err}=await client.from('scheduled_posts').update({completed:!post.completed})
    .eq('id',post.id).eq('user_id',user.id);
  if (err) {button.disabled=false;return error(err);}
  await loadScheduledPosts();
});

if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});init().catch(error);
