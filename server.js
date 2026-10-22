const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DB_FILE = path.join(ROOT, 'data.json');
const sessions = new Map();

const destinations = [
  { id:'constantine', name:'Constantine', image:'/assets/constantine.jpg',
    description:'Known as the City of Bridges, Constantine rises dramatically above the Rhumel gorges and combines Roman heritage, Ottoman architecture, lively streets and unforgettable panoramic views.' },
  { id:'ghardaia', name:'Ghardaïa', image:'/assets/ghardaia.jpg',
    description:'At the heart of the M’Zab Valley, Ghardaïa is famous for its distinctive architecture, desert landscapes, traditional markets and a centuries-old urban culture adapted to the Sahara.' },
  { id:'algiers', name:'Alger', image:'/assets/algiers.jpg',
    description:'Alger, the capital, blends Mediterranean seafront views with the Casbah, museums, modern districts and national landmarks such as the Martyrs’ Memorial.' },
  { id:'oran', name:'Oran', image:'/assets/oran.jpg',
    description:'Oran is Algeria’s vibrant western coastal city, known for its sea views, music, lively boulevards, Santa Cruz heights and a strong Mediterranean identity.' },
  { id:'guelma', name:'Guelma', image:'/assets/guelma.jpg',
    description:'Guelma is known for Roman heritage, green landscapes and thermal attractions, including the striking limestone formations and hot springs around Hammam Debagh.' }
];

const initialData = {
  users: [],
  challenges: [
    {id:'c1', destination:'constantine', category:'transport', title:'Finding the right bridge route', story:'I was unsure which bus stop was closest to the old city and the bridge viewpoints.', solution:'Ask the hotel desk for the nearest stop, keep an offline map and allow extra time during rush hour.', author:'Demo Visitor', createdAt:new Date().toISOString()},
    {id:'c2', destination:'ghardaia', category:'culture', title:'Understanding local customs', story:'Some market etiquette and local dress expectations were unfamiliar to me.', solution:'Observe local practice, ask politely before taking photos and use a local guide for cultural context.', author:'Demo Visitor', createdAt:new Date().toISOString()},
    {id:'c3', destination:'oran', category:'language', title:'Language at small shops', story:'I sometimes struggled to explain what I needed in smaller stores.', solution:'Keep a few useful Arabic/French phrases saved on your phone and show written names or photos when useful.', author:'Demo Visitor', createdAt:new Date().toISOString()}
  ],
  recommendations: [
    {id:'r1', destination:'algiers', type:'hotel', title:'Central stay near the seafront', description:'Choose accommodation with easy access to central transport and the Casbah area.', contact:'Ask the property for airport-transfer options.', createdAt:new Date().toISOString()},
    {id:'r2', destination:'constantine', type:'guide', title:'Local heritage guide', description:'A licensed local guide can help connect the city’s bridges, old quarters and history in one walking route.', contact:'Book through a local tourism office or registered guide.', createdAt:new Date().toISOString()},
    {id:'r3', destination:'oran', type:'transport', title:'City transport plan', description:'For Santa Cruz and coastal viewpoints, plan a mix of taxi and walking rather than relying on one route.', contact:'Confirm fare or meter expectations before departure.', createdAt:new Date().toISOString()}
  ]
};

function loadDB(){
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }

function hashPassword(password, salt=crypto.randomBytes(16).toString('hex')){
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verifyPassword(password, stored){
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  const hash = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hex, 'hex');
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}
function ensureAdmin(){
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password) throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to create the admin account');

  const db = loadDB();
  if (!db.users.some(u=>u.email===email)) {
    db.users.push({id:crypto.randomUUID(), fullName:'3T Administrator', email, password:hashPassword(password), role:'admin', provider:'local'});
    saveDB(db);
  }
}
ensureAdmin();

function send(res, status, data, type='application/json; charset=utf-8'){
  res.writeHead(status, {'Content-Type':type, 'Cache-Control':'no-store'});
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function body(req){ return new Promise((resolve,reject)=>{ let s=''; req.on('data',d=>{s+=d; if(s.length>1e6) req.destroy();}); req.on('end',()=>{try{resolve(s?JSON.parse(s):{});}catch(e){reject(e)}}); req.on('error',reject); }); }
function getUser(req){
  const auth=req.headers.authorization||'';
  const token=auth.startsWith('Bearer ')?auth.slice(7):null;
  if(!token||!sessions.has(token)) return null;
  const userId=sessions.get(token);
  return loadDB().users.find(u=>u.id===userId)||null;
}
function safeUser(u){ return u?{id:u.id,fullName:u.fullName,email:u.email,role:u.role,provider:u.provider}:null; }
function notFound(res){ send(res,404,{error:'Not found'}); }
function requireAuth(req,res){ const u=getUser(req); if(!u){send(res,401,{error:'Authentication required'});return null;} return u; }
function requireAdmin(req,res){ const u=requireAuth(req,res); if(!u) return null; if(u.role!=='admin'){send(res,403,{error:'Admin access required'});return null;} return u; }

async function api(req,res,url){
  const method=req.method;
  if(method==='GET' && url.pathname==='/api/destinations') return send(res,200,destinations);
  if(method==='GET' && url.pathname==='/api/me') return send(res,200,{user:safeUser(getUser(req))});

  if(method==='POST' && url.pathname==='/api/auth/register'){
    const b=await body(req); const {fullName,email,password,confirmPassword}=b;
    if(!fullName||!email||!password||!confirmPassword) return send(res,400,{error:'All fields are required'});
    if(password!==confirmPassword) return send(res,400,{error:'Passwords do not match'});
    if(password.length<6) return send(res,400,{error:'Password must be at least 6 characters'});
    const db=loadDB(); const normalized=email.trim().toLowerCase();
    if(db.users.some(u=>u.email===normalized)) return send(res,409,{error:'Email already registered'});
    const user={id:crypto.randomUUID(),fullName:fullName.trim(),email:normalized,password:hashPassword(password),role:'visitor',provider:'local'};
    db.users.push(user); saveDB(db); const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id);
    return send(res,201,{token,user:safeUser(user)});
  }
  if(method==='POST' && url.pathname==='/api/auth/login'){
    const b=await body(req); const db=loadDB(); const email=(b.email||'').trim().toLowerCase();
    const user=db.users.find(u=>u.email===email && u.provider==='local');
    if(!user||!verifyPassword(b.password||'',user.password)) return send(res,401,{error:'Invalid email or password'});
    const token=crypto.randomBytes(32).toString('hex'); sessions.set(token,user.id); return send(res,200,{token,user:safeUser(user)});
  }
  if(method==='POST' && url.pathname==='/api/auth/social'){
    const b=await body(req); const provider=['google','facebook'].includes(b.provider)?b.provider:null;
    if(!provider) return send(res,400,{error:'Unsupported provider'});
    const db=loadDB(); const email=`demo-${provider}@3t.local`;
    let user=db.users.find(u=>u.email===email);
    if(!user){user={id:crypto.randomUUID(),fullName:`${provider[0].toUpperCase()+provider.slice(1)} Demo Visitor`,email,password:'',role:'visitor',provider};db.users.push(user);saveDB(db);}
    const token=crypto.randomBytes(32).toString('hex');sessions.set(token,user.id);return send(res,200,{token,user:safeUser(user),demo:true});
  }
  if(method==='POST' && url.pathname==='/api/auth/forgot'){
    const b=await body(req); return send(res,200,{message:`If ${b.email||'this email'} is registered, a reset link would be sent. (Demo mode)`});
  }
  if(method==='POST' && url.pathname==='/api/auth/logout'){
    const auth=req.headers.authorization||''; if(auth.startsWith('Bearer ')) sessions.delete(auth.slice(7)); return send(res,200,{ok:true});
  }
  if(method==='PUT' && url.pathname==='/api/profile'){
    const user=requireAuth(req,res); if(!user) return; const b=await body(req); const db=loadDB(); const target=db.users.find(u=>u.id===user.id);
    if(b.fullName && b.fullName.trim()) target.fullName=b.fullName.trim(); saveDB(db); return send(res,200,{user:safeUser(target)});
  }

  if(method==='GET' && url.pathname==='/api/challenges'){
    const db=loadDB(); let items=db.challenges; const d=url.searchParams.get('destination'); const c=url.searchParams.get('category');
    if(d) items=items.filter(x=>x.destination===d); if(c&&c!=='all') items=items.filter(x=>x.category===c); return send(res,200,items.slice().reverse());
  }
  if(method==='POST' && url.pathname==='/api/challenges'){
    const user=requireAuth(req,res); if(!user) return; const b=await body(req);
    if(!destinations.some(d=>d.id===b.destination)||!b.category||!b.title||!b.story||!b.solution) return send(res,400,{error:'Please complete all fields'});
    const db=loadDB(); const item={id:crypto.randomUUID(),destination:b.destination,category:b.category,title:b.title.trim(),story:b.story.trim(),solution:b.solution.trim(),author:user.fullName,createdAt:new Date().toISOString()}; db.challenges.push(item);saveDB(db);return send(res,201,item);
  }

  if(method==='GET' && url.pathname==='/api/recommendations'){
    const db=loadDB(); let items=db.recommendations; const d=url.searchParams.get('destination'); const t=url.searchParams.get('type');
    if(d) items=items.filter(x=>x.destination===d); if(t&&t!=='all') items=items.filter(x=>x.type===t); return send(res,200,items.slice().reverse());
  }
  if(method==='POST' && url.pathname==='/api/recommendations'){
    if(!requireAdmin(req,res)) return; const b=await body(req);
    if(!destinations.some(d=>d.id===b.destination)||!['hotel','guide','transport'].includes(b.type)||!b.title||!b.description) return send(res,400,{error:'Please complete required fields'});
    const db=loadDB(); const item={id:crypto.randomUUID(),destination:b.destination,type:b.type,title:b.title.trim(),description:b.description.trim(),contact:(b.contact||'').trim(),createdAt:new Date().toISOString()};db.recommendations.push(item);saveDB(db);return send(res,201,item);
  }
  if(method==='PUT' && url.pathname.startsWith('/api/recommendations/')){
    if(!requireAdmin(req,res)) return; const id=url.pathname.split('/').pop(); const b=await body(req); const db=loadDB(); const item=db.recommendations.find(x=>x.id===id); if(!item) return notFound(res);
    for(const k of ['destination','type','title','description','contact']) if(b[k]!==undefined) item[k]=String(b[k]).trim(); saveDB(db); return send(res,200,item);
  }
  if(method==='DELETE' && url.pathname.startsWith('/api/recommendations/')){
    if(!requireAdmin(req,res)) return; const id=url.pathname.split('/').pop(); const db=loadDB(); const before=db.recommendations.length; db.recommendations=db.recommendations.filter(x=>x.id!==id); if(db.recommendations.length===before) return notFound(res); saveDB(db); return send(res,200,{ok:true});
  }
  return notFound(res);
}

const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,`http://${req.headers.host}`);
    if(url.pathname.startsWith('/api/')) return await api(req,res,url);
    let filePath=path.join(PUBLIC, url.pathname==='/'?'index.html':url.pathname);
    if(!filePath.startsWith(PUBLIC)) return send(res,403,'Forbidden','text/plain');
    if(!fs.existsSync(filePath)||fs.statSync(filePath).isDirectory()) filePath=path.join(PUBLIC,'index.html');
    const ext=path.extname(filePath).toLowerCase(); send(res,200,fs.readFileSync(filePath),mime[ext]||'application/octet-stream');
  }catch(e){ console.error(e); send(res,500,{error:'Server error'}); }
});
server.listen(PORT,()=>console.log(`3T running on http://localhost:${PORT}`));
