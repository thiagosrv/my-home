'use strict';
// ================================================================
// ECOBRICK PLANNER — app.js
// ================================================================

// ── 1. CONSTANTS ─────────────────────────────────────────────────
const BRICK = {
  '30x15x7': { L:30, W:15, H:7,  M:1   },
  '25x12x6': { L:25, W:12.5, H:6, M:0.8 }
};

const ELEM_SIZE = {
  door_standard:{w:80,h:15},door_double:{w:140,h:15},door_glass:{w:90,h:15},
  door_slide:{w:80,h:10},door_fold:{w:60,h:10},
  window:{w:120,h:15},window_corner:{w:120,h:120},window_bay:{w:150,h:60},
  gate:{w:200,h:10},gate_slide:{w:200,h:10},
  cabinet_upper:{w:60,h:35},cabinet_lower:{w:60,h:60},
  cabinet_corner45:{w:90,h:90},cabinet_corner90:{w:60,h:60},cabinet_island:{w:120,h:90},
  fridge:{w:60,h:70},fridge_two_door:{w:90,h:70},
  stove:{w:60,h:60},stove_6:{w:90,h:60},oven:{w:60,h:60},
  microwave:{w:55,h:40},dishwasher:{w:60,h:60},
  washing_machine:{w:60,h:60},dryer:{w:60,h:60},
  sink_kitchen:{w:60,h:55},sink_kitchen_double:{w:100,h:55},
  bbq:{w:120,h:60},bbq_ext:{w:150,h:80},trash_bin:{w:40,h:40},
  toilet:{w:40,h:70},bidet:{w:35,h:60},
  shower:{w:90,h:90},shower_cabin:{w:90,h:90},bathtub:{w:80,h:170},
  jacuzzi:{w:150,h:150},jacuzzi_ext:{w:180,h:180},
  sink_bath:{w:50,h:45},sink_bath_double:{w:100,h:45},
  cabinet_bath:{w:80,h:50},towel_rack:{w:60,h:15},
  bed_single:{w:88,h:188},bed_double:{w:138,h:188},
  bed_queen:{w:153,h:203},bed_king:{w:183,h:203},
  bed_bunk:{w:90,h:190},crib:{w:70,h:130},
  wardrobe:{w:160,h:60},wardrobe_walk:{w:200,h:150},
  dresser:{w:90,h:45},nightstand:{w:50,h:50},vanity:{w:100,h:45},
  sofa:{w:150,h:85},sofa_3:{w:220,h:85},sofa_corner:{w:240,h:240},
  armchair:{w:80,h:80},chaise:{w:150,h:80},
  table_coffee:{w:120,h:60},table_side:{w:50,h:50},
  table_dining:{w:80,h:80},table_dining_6:{w:80,h:160},
  table_dining_8:{w:100,h:200},table_round:{w:100,h:100},
  chair:{w:45,h:45},chair_bar:{w:40,h:40},chair_outdoor:{w:50,h:50},
  bench:{w:120,h:40},
  tv:{w:120,h:8},tv_stand:{w:160,h:45},
  bookshelf:{w:80,h:30},bar_cabinet:{w:80,h:45},
  desk:{w:140,h:60},desk_l:{w:200,h:160},table_meeting:{w:180,h:90},
  desk_chair:{w:55,h:55},filing_cabinet:{w:45,h:60},
  tree:{w:150,h:150},tree_palm:{w:100,h:100},bush:{w:80,h:80},
  plant_small:{w:40,h:40},lawn:{w:200,h:200},garden_bed:{w:150,h:80},
  pool:{w:300,h:600},pool_round:{w:350,h:350},
  pergola:{w:300,h:300},deck:{w:300,h:200},
  table_outdoor:{w:80,h:80},
  car:{w:175,h:420},car_suv:{w:185,h:460},moto:{w:80,h:200},
  stairs:{w:100,h:200},stairs_spiral:{w:120,h:120},
  ramp:{w:100,h:200},fence:{w:200,h:10},water_tank:{w:100,h:100},
  north_arrow:{w:60,h:60},text_label:{w:100,h:30}
};

const WALL_SNAP_TYPES = new Set([
  'door_standard','door_double','door_glass','door_slide','door_fold',
  'window','window_bay','gate','gate_slide'
]);

const ROOM_COLORS = [
  'rgba(255,210,160,0.14)','rgba(160,210,255,0.14)','rgba(190,255,190,0.14)',
  'rgba(255,190,210,0.14)','rgba(210,190,255,0.14)','rgba(255,255,170,0.14)',
  'rgba(170,255,230,0.14)','rgba(255,220,180,0.14)'
];
let _rci=0; function nextRC(){ return ROOM_COLORS[_rci++%ROOM_COLORS.length]; }

// ── 2. STATE ─────────────────────────────────────────────────────
let S = {
  meta:    { name:'Minha Casa' },
  terrain: { wCm:1500, hCm:1200, gridCm:15 },
  settings:{ brickType:'30x15x7', snapGrid:true, snap90:true },
  walls:   [],
  elements:[],
  rooms:   [],
  annots:  []
};

const newId = ()=> '_'+Math.random().toString(36).slice(2,9);

// ── 3. VIEW ──────────────────────────────────────────────────────
let V = { x:60, y:60, scale:1.0 };
let dpr = 1;
const canvas = document.getElementById('main-canvas');
const ctx    = canvas.getContext('2d');

function toScreen(wx,wy){ return { x:wx*V.scale+V.x, y:wy*V.scale+V.y }; }
function toWorld(sx,sy) { return { x:(sx-V.x)/V.scale, y:(sy-V.y)/V.scale }; }

// ── 4. HISTORY ───────────────────────────────────────────────────
const H = { stack:[], cur:-1 };
function doCmd(cmd){
  H.stack.splice(H.cur+1);
  cmd.do();
  H.stack.push(cmd); H.cur=H.stack.length-1;
  computeCorners(); detectRooms(); requestRender(); autoSave();
}
function undo(){
  if(H.cur<0) return;
  H.stack[H.cur].undo(); H.cur--;
  computeCorners(); detectRooms(); requestRender();
}
function redo(){
  if(H.cur>=H.stack.length-1) return;
  H.cur++; H.stack[H.cur].do();
  computeCorners(); detectRooms(); requestRender();
}

const cmdAddWall=(w)=>{ const c={...w}; return { do(){S.walls.push(c)}, undo(){S.walls=S.walls.filter(x=>x.id!==c.id)} }; };
const cmdDelWall=(id)=>{ let s; return { do(){s=S.walls.find(x=>x.id===id);S.walls=S.walls.filter(x=>x.id!==id)}, undo(){if(s)S.walls.push(s)} }; };
const cmdAddElem=(el)=>{ const c=JSON.parse(JSON.stringify(el)); return { do(){S.elements.push(c)}, undo(){S.elements=S.elements.filter(x=>x.id!==c.id)} }; };
const cmdDelElem=(id)=>{ let s; return { do(){s=S.elements.find(x=>x.id===id);S.elements=S.elements.filter(x=>x.id!==id)}, undo(){if(s)S.elements.push(s)} }; };
const cmdMoveElem=(id,dx,dy)=>({ do(){const e=S.elements.find(x=>x.id===id);if(e){e.x+=dx;e.y+=dy}}, undo(){const e=S.elements.find(x=>x.id===id);if(e){e.x-=dx;e.y-=dy}} });
const cmdMoveWalls=(ids,dx,dy)=>({ do(){ids.forEach(id=>{const w=S.walls.find(x=>x.id===id);if(w){w.x1+=dx;w.y1+=dy;w.x2+=dx;w.y2+=dy;}});}, undo(){ids.forEach(id=>{const w=S.walls.find(x=>x.id===id);if(w){w.x1-=dx;w.y1-=dy;w.x2-=dx;w.y2-=dy;}});} });
const cmdAddRoom=(walls)=>{ const ids=walls.map(w=>w.id); const copies=walls.map(w=>({...w}));
  return { do(){copies.forEach(w=>S.walls.push(w))}, undo(){S.walls=S.walls.filter(w=>!ids.includes(w.id))} }; };

// ── 5. SNAP & COORDS ─────────────────────────────────────────────
function snapGrid(v){ return Math.round(v/S.terrain.gridCm)*S.terrain.gridCm; }
function snapPt(x,y){
  if(!S.settings.snapGrid) return {x,y};
  return {x:snapGrid(x), y:snapGrid(y)};
}
function snapEndpoints(wx,wy,excludeId){
  const thr=14/V.scale;
  for(const w of S.walls){
    if(w.id===excludeId) continue;
    if(Math.hypot(w.x1-wx,w.y1-wy)<thr) return {x:w.x1,y:w.y1,snapped:true};
    if(Math.hypot(w.x2-wx,w.y2-wy)<thr) return {x:w.x2,y:w.y2,snapped:true};
  }
  return null;
}

// 90° angle snapping
function snap90(x1,y1,x2,y2,shiftHeld){
  if(shiftHeld) return {x:x2,y:y2,snapped:false};
  if(!S.settings.snap90) return {x:x2,y:y2,snapped:false};
  const dx=x2-x1, dy=y2-y1;
  const rawAngle=Math.atan2(dy,dx);
  const len=Math.hypot(dx,dy);
  const deg=((rawAngle*180/Math.PI)%360+360)%360;
  // Prefer 0/90/180/270 over diagonals — threshold 15°
  const cardinals=[0,90,180,270,360];
  let best=null, bestDiff=15;
  for(const c of cardinals){
    const diff=Math.min(Math.abs(deg-c), 360-Math.abs(deg-c));
    if(diff<bestDiff){ bestDiff=diff; best=c; }
  }
  if(best!==null){
    const snapRad=best*Math.PI/180;
    return { x:x1+Math.cos(snapRad)*len, y:y1+Math.sin(snapRad)*len, snapped:true, angle:best };
  }
  return {x:x2,y:y2,snapped:false};
}

function ptOnSegment(px,py,x1,y1,x2,y2){
  const dx=x2-x1,dy=y2-y1,len2=dx*dx+dy*dy;
  if(len2===0) return{t:0,d:Math.hypot(px-x1,py-y1),cx:x1,cy:y1};
  let t=((px-x1)*dx+(py-y1)*dy)/len2;
  t=Math.max(0,Math.min(1,t));
  return{t, cx:x1+t*dx, cy:y1+t*dy, d:Math.hypot(px-(x1+t*dx),py-(y1+t*dy))};
}

// ── 6. CORNER TRIM COMPUTATION ───────────────────────────────────
const EPS=4;
function computeCorners(){
  S.walls.forEach(w=>{ w.startTrim=0; w.endTrim=0; });
  // L-junctions (endpoint meets endpoint)
  for(let i=0;i<S.walls.length;i++){
    for(let j=i+1;j<S.walls.length;j++){
      resolveL(S.walls[i],S.walls[j]);
    }
  }
  // T-junctions (endpoint meets middle of another wall)
  for(const a of S.walls){
    for(const b of S.walls){
      if(a.id===b.id) continue;
      resolveTJunction(a,'start',b);
      resolveTJunction(a,'end',b);
    }
  }
}

function resolveL(a,b){
  const pairs=[
    {aPt:'start',bPt:'start',ax:a.x1,ay:a.y1,bx:b.x1,by:b.y1},
    {aPt:'start',bPt:'end',  ax:a.x1,ay:a.y1,bx:b.x2,by:b.y2},
    {aPt:'end',  bPt:'start',ax:a.x2,ay:a.y2,bx:b.x1,by:b.y1},
    {aPt:'end',  bPt:'end',  ax:a.x2,ay:a.y2,bx:b.x2,by:b.y2}
  ];
  for(const p of pairs){
    if(Math.hypot(p.ax-p.bx,p.ay-p.by)>EPS*2) continue;
    const aA=Math.atan2(a.y2-a.y1,a.x2-a.x1);
    const bA=Math.atan2(b.y2-b.y1,b.x2-b.x1);
    // Check if actually perpendicular (corner), not parallel (same direction)
    const diff=Math.abs(((aA-bA)*180/Math.PI+360)%360);
    if(diff<30||diff>150&&diff<210||diff>330) continue; // nearly parallel, skip
    // More horizontal wall claims the corner
    const aH=Math.abs(Math.sin(aA));
    const [trimmed,trimmedPt]= aH<=Math.abs(Math.sin(bA)) ? [b,p.bPt] : [a,p.aPt];
    const owner = trimmed===a ? b : a;
    const halfT=(owner.thicknessCm||15)/2;
    if(trimmedPt==='start') trimmed.startTrim=Math.max(trimmed.startTrim,halfT);
    else                     trimmed.endTrim  =Math.max(trimmed.endTrim,  halfT);
  }
}

function resolveTJunction(a,which,b){
  const px=which==='start'?a.x1:a.x2;
  const py=which==='start'?a.y1:a.y2;
  const r=ptOnSegment(px,py,b.x1,b.y1,b.x2,b.y2);
  if(r.t<0.02||r.t>0.98) return; // is an endpoint, not middle
  if(r.d>(b.thicknessCm||15)/2+EPS) return;
  const trim=(b.thicknessCm||15)/2;
  if(which==='start') a.startTrim=Math.max(a.startTrim,trim);
  else                a.endTrim  =Math.max(a.endTrim,  trim);
}

// ── 7. ROOM DETECTION ────────────────────────────────────────────
function detectRooms(){
  if(S.walls.length<3){ S.rooms=[]; return; }
  const pts=[]; const adj=[];
  const getP=(x,y)=>{
    for(let i=0;i<pts.length;i++) if(Math.hypot(pts[i].x-x,pts[i].y-y)<EPS) return i;
    pts.push({x,y}); return pts.length-1;
  };
  S.walls.forEach(w=>{
    const a=getP(w.x1,w.y1), b=getP(w.x2,w.y2);
    while(adj.length<=Math.max(a,b)) adj.push([]);
    if(a!==b){ adj[a].push({n:b,wid:w.id}); adj[b].push({n:a,wid:w.id}); }
  });
  const used=new Set(); const newR=[];
  for(let s=0;s<pts.length;s++){
    for(const e0 of adj[s]){
      const ek=`${s}-${e0.n}`; if(used.has(ek)) continue;
      const face=[s]; let prev=s,cur=e0.n,iter=0;
      while(cur!==s&&iter<100){
        iter++; face.push(cur); used.add(`${prev}-${cur}`);
        const inA=Math.atan2(pts[cur].y-pts[prev].y,pts[cur].x-pts[prev].x);
        const edges=adj[cur].filter(e=>e.n!==prev);
        if(!edges.length) break;
        let best=null,bestA=Infinity;
        for(const e of edges){
          const outA=Math.atan2(pts[e.n].y-pts[cur].y,pts[e.n].x-pts[cur].x);
          let da=(outA-inA+Math.PI*3)%(Math.PI*2)-Math.PI;
          if(da<bestA){bestA=da;best=e;}
        }
        if(!best) break;
        prev=cur; cur=best.n;
      }
      used.add(`${prev}-${s}`);
      if(cur===s&&face.length>=3){
        const verts=face.map(i=>pts[i]);
        const area=shoelaceS(verts);
        if(area>5000){
          const ex=S.rooms.find(r=>roomSame(r,verts));
          newR.push({id:ex?ex.id:newId(),vertices:verts,areaSqM:+(area/10000).toFixed(2),
            centroid:centroid(verts),label:ex?ex.label:'Cômodo',color:ex?ex.color:nextRC()});
        }
      }
    }
  }
  S.rooms=newR;
}
function shoelaceS(p){let a=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;a+=p[i].x*p[j].y-p[j].x*p[i].y;}return a/2;}
function centroid(p){let x=0,y=0;p.forEach(v=>{x+=v.x;y+=v.y;});return{x:x/p.length,y:y/p.length};}
function roomSame(r,v){ const c1=r.centroid,c2=centroid(v); return Math.hypot(c1.x-c2.x,c1.y-c2.y)<25; }

// ── 8. RENDER ────────────────────────────────────────────────────
let _rPending=false;
function requestRender(){ if(!_rPending){_rPending=true;requestAnimationFrame(render);} }

const layers={grid:true,foundation:true,walls:true,furniture:true,annotations:true};

function render(){
  _rPending=false;
  const W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0d1520'; ctx.fillRect(0,0,W,H);

  ctx.save();
  ctx.translate(V.x,V.y); ctx.scale(V.scale,V.scale);

  drawTerrain();
  if(layers.grid)       drawGrid();
  if(layers.foundation) drawFoundation();
  if(layers.walls)      drawWalls();
  if(layers.furniture)  drawElements();
  if(layers.annotations)drawAnnotations();
  drawInteraction();

  ctx.restore();
  drawScreenUI();
  updateInfo();
}

function drawTerrain(){
  const {wCm,hCm}=S.terrain;
  ctx.fillStyle='#141f14'; ctx.fillRect(0,0,wCm,hCm);
  ctx.strokeStyle='rgba(200,92,45,0.5)'; ctx.lineWidth=3/V.scale;
  ctx.strokeRect(0,0,wCm,hCm);
}

function drawGrid(){
  const {wCm,hCm,gridCm}=S.terrain;
  const major=gridCm*5;
  ctx.lineWidth=0.5/V.scale;
  for(let x=0;x<=wCm;x+=gridCm){
    ctx.strokeStyle=x%major===0?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.04)';
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,hCm);ctx.stroke();
  }
  for(let y=0;y<=hCm;y+=gridCm){
    ctx.strokeStyle=y%major===0?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.04)';
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(wCm,y);ctx.stroke();
  }
  ctx.fillStyle='rgba(255,255,255,0.2)';
  ctx.font=`${9/V.scale}px sans-serif`; ctx.textAlign='center';
  for(let x=0;x<=wCm;x+=major) ctx.fillText((x/100)+'m',x,-5/V.scale);
  ctx.textAlign='right';
  for(let y=0;y<=hCm;y+=major) ctx.fillText((y/100)+'m',-4/V.scale,y+3/V.scale);
}

function drawFoundation(){
  S.rooms.forEach(r=>{
    if(!r.vertices||r.vertices.length<3) return;
    ctx.beginPath();
    r.vertices.forEach((v,i)=>i===0?ctx.moveTo(v.x,v.y):ctx.lineTo(v.x,v.y));
    ctx.closePath();
    ctx.fillStyle=r.color||'rgba(255,220,180,0.12)'; ctx.fill();
    const c=r.centroid, fs=11/V.scale;
    ctx.textAlign='center';
    ctx.font=`600 ${fs}px sans-serif`; ctx.fillStyle='rgba(220,225,235,0.65)';
    ctx.fillText(r.label,c.x,c.y-fs*0.55);
    ctx.font=`${fs*0.82}px sans-serif`; ctx.fillStyle='rgba(180,200,180,0.6)';
    ctx.fillText(r.areaSqM+' m²',c.x,c.y+fs*0.72);
  });
}

// ── WALL & BRICK RENDERING ──────────────────────────────────────
function drawWalls(){
  S.walls.forEach(w=>renderWall(w,1));
}

function renderWall(w,alpha){
  const dx=w.x2-w.x1, dy=w.y2-w.y1;
  const len=Math.hypot(dx,dy); if(len<1) return;
  const angle=Math.atan2(dy,dx);
  const T=w.thicknessCm||15;
  const bt=w.brickType||S.settings.brickType;
  const body=w.colorBody||'#C85C2D';
  const mort=w.colorMortar||'#3D8B7A';
  const st=w.startTrim||0, et=w.endTrim||0;

  // Wall openings (doors/windows on this wall)
  const openings=S.elements.filter(e=>e.wallId===w.id).map(e=>{
    const wCm=e.wCm||80;
    const pos=e.wallT!==undefined ? e.wallT*len : len/2;
    return { start:pos-wCm/2, end:pos+wCm/2, type:e.type };
  });

  ctx.save();
  if(alpha<1) ctx.globalAlpha=alpha;
  ctx.translate(w.x1,w.y1);
  ctx.rotate(angle);

  brickWall(ctx, len, T, bt, body, mort, st, et, openings);
  ctx.restore();
}

function brickWall(c2, len, T, bt, body, mort, startPad, endPad, openings){
  const b=BRICK[bt]||BRICK['30x15x7'];
  const L=b.L, M=b.M;
  const unit=L+M;
  const rows=Math.max(1,Math.round(T/b.W));
  const rowH=T/rows;

  // Full mortar background
  c2.fillStyle=mort; c2.fillRect(0,0,len,T);

  const brickStart=startPad>0?startPad+M/2:M/2;
  const brickEnd  =endPad>0?len-endPad-M/2:len-M/2;

  for(let row=0;row<rows;row++){
    const ry=row*rowH;
    const bH=rowH-M;
    const offset=(row%2===0)?0:-(unit/2);

    for(let xStart=offset;xStart<len;xStart+=unit){
      const bxD=xStart<0?M/2:xStart+M/2;
      const bxE=Math.min(xStart+L,len-M/2);
      if(bxE-bxD<2) continue;
      if(bxE<brickStart||bxD>brickEnd) continue; // outside trimmed zone
      const bxDS=Math.max(bxD,brickStart);
      const bxES=Math.min(bxE,brickEnd);
      if(bxES-bxDS<1) continue;

      // Skip if inside opening
      const mid=(bxDS+bxES)/2;
      if(openings.some(o=>mid>=o.start&&mid<=o.end)) continue;

      c2.fillStyle=body;
      c2.fillRect(bxDS,ry+M/2,bxES-bxDS,bH);

      // Holes
      const rh=Math.min(bH*0.28,3.5);
      const fracs=(bxES-bxDS)>L*0.5?[0.33,0.67]:[0.5];
      c2.fillStyle='rgba(0,0,0,0.3)';
      fracs.forEach(f=>{
        c2.beginPath(); c2.arc(bxDS+(bxES-bxDS)*f, ry+M/2+bH/2, rh, 0, Math.PI*2);
        c2.fill();
      });
    }
  }

  // Draw openings
  openings.forEach(o=>drawOpening(c2,o.start,o.end,T,o.type));
}

function drawOpening(c2,start,end,T,type){
  const w=end-start;
  c2.clearRect(start,0,w,T);
  c2.fillStyle='#141f14'; c2.fillRect(start,0,w,T);
  if(!type) return;
  if(type.startsWith('door')) drawDoorSym(c2,start,0,w,T,type);
  else if(type.startsWith('window')) drawWinSym(c2,start,0,w,T);
  else if(type.startsWith('gate')) drawGateSym(c2,start,0,w,T);
}

function drawDoorSym(c2,x,y,w,T,type){
  c2.strokeStyle='rgba(190,150,90,0.9)'; c2.fillStyle='rgba(190,150,90,0.12)';
  c2.lineWidth=1.2/V.scale;
  if(type==='door_double'){
    const h=w/2;
    [x, x+w].forEach((px,i)=>{
      c2.beginPath(); c2.moveTo(px,y+T/2);
      c2.lineTo(px,y+T/2-h);
      c2.arc(px,y+T/2,h,-Math.PI/2,i===0?0:Math.PI,i===1); c2.stroke();
    });
  } else if(type==='door_slide'){
    c2.strokeStyle='rgba(100,180,220,0.8)';
    c2.strokeRect(x+1,y+1,w-2,T-2);
  } else {
    c2.beginPath(); c2.moveTo(x,y+T);
    c2.lineTo(x,y+T-w); c2.arc(x,y+T,w,-Math.PI/2,0); c2.stroke();
    if(type==='door_glass'){
      c2.strokeStyle='rgba(120,200,255,0.4)'; c2.setLineDash([3/V.scale,3/V.scale]);
      c2.strokeRect(x+2,y+2,w-4,T-4); c2.setLineDash([]);
    }
  }
}

function drawWinSym(c2,x,y,w,T){
  c2.strokeStyle='rgba(120,200,255,0.8)'; c2.lineWidth=1/V.scale;
  c2.strokeRect(x,y,w,T);
  const t3=T/3;
  [t3,t3*2].forEach(d=>{
    c2.beginPath();c2.moveTo(x,y+d);c2.lineTo(x+w,y+d);c2.stroke();
  });
}

function drawGateSym(c2,x,y,w,T){
  c2.strokeStyle='rgba(160,160,160,0.8)'; c2.lineWidth=1.5/V.scale;
  c2.strokeRect(x,y,w,T);
  c2.beginPath();c2.moveTo(x,y);c2.lineTo(x+w,y+T);c2.stroke();
  c2.beginPath();c2.moveTo(x+w,y);c2.lineTo(x,y+T);c2.stroke();
}

// ── ELEMENT RENDERING ────────────────────────────────────────────
function drawElements(){
  const sorted=[...S.elements].sort((a,b)=>(a.z||0)-(b.z||0));
  sorted.forEach(el=>{
    if(WALL_SNAP_TYPES.has(el.type)) return;
    ctx.save();
    ctx.translate(el.x,el.y);
    if(el.rot) ctx.rotate(el.rot*Math.PI/180);
    drawElem(ctx,el);
    ctx.restore();
  });
}

// Helpers
function rrect(c,x,y,w,h,r,fill,stroke){
  c.beginPath(); c.moveTo(x+r,y);
  c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);
  c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.stroke();}
}
const ln=(c,x1,y1,x2,y2)=>{c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
const circ=(c,cx,cy,r,fill,stroke)=>{c.beginPath();c.arc(cx,cy,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}};

function drawElem(c,el){
  const w=el.wCm, h=el.hCm, hw=w/2, hh=h/2;
  c.lineWidth=1/V.scale;
  const t=el.type;

  const boxF=(f,s)=>{ c.lineWidth=1/V.scale; if(f){c.fillStyle=f;c.fillRect(-hw,-hh,w,h);} if(s){c.strokeStyle=s;c.strokeRect(-hw,-hh,w,h);} };

  // KITCHEN ──────────────────────────────────────────────────────
  if(t==='cabinet_upper'||t==='cabinet_lower'){
    boxF('#4a3520','#7a5530');
    c.strokeStyle='#7a5530';c.lineWidth=0.8/V.scale;
    ln(c,0,-hh,0,hh);
    circ(c,-hw+w*0.25,0,2,'#b8903a',null); circ(c,-hw+w*0.75,0,2,'#b8903a',null);
    if(t==='cabinet_upper'){c.strokeStyle='rgba(255,255,255,0.15)';c.lineWidth=0.5/V.scale;c.strokeRect(-hw,-hh,w,h);}
  } else if(t==='cabinet_corner45'){
    c.fillStyle='#4a3520';c.strokeStyle='#7a5530';c.lineWidth=1/V.scale;
    c.beginPath();c.moveTo(-hw,hh);c.lineTo(hw,hh);c.lineTo(hw,-hh+w);c.lineTo(-hw+w,-hh);c.lineTo(-hw,-hh);c.closePath();c.fill();c.stroke();
  } else if(t==='cabinet_island'){
    boxF('#4a3520','#c0a060');
    c.strokeStyle='#7a5530';c.lineWidth=0.5/V.scale;
    [1/3,2/3].forEach(f=>ln(c,-hw+f*w,-hh,-hw+f*w,hh));
  } else if(t==='fridge'||t==='fridge_two_door'){
    boxF('#2e3c4c','#5070a0');
    c.strokeStyle='#5070a0';c.lineWidth=0.8/V.scale;
    if(t==='fridge_two_door') ln(c,0,-hh,0,hh);
    else ln(c,-hw,-hh+h*0.35,hw,-hh+h*0.35);
    c.strokeStyle='#7090c0';
    if(t==='fridge_two_door'){ln(c,-hw+4,-hh+6,-hw+4,-hh+18);ln(c,-hw+4+w/2,-hh+6,-hw+4+w/2,-hh+18);}
    else ln(c,-hw+4,-hh+6,-hw+4,-hh+20);
  } else if(t==='stove'||t==='stove_6'){
    boxF('#252525','#484848');
    const cols=t==='stove'?2:3;
    const gx=w/(cols+1),gy=h/3;
    for(let r=1;r<=2;r++) for(let cc=1;cc<=cols;cc++){
      circ(c,-hw+gx*cc,-hh+gy*r,gx*0.3,'#3a3a3a','#888');
      circ(c,-hw+gx*cc,-hh+gy*r,gx*0.1,'#1a1a1a',null);
    }
  } else if(t==='oven'||t==='microwave'){
    boxF('#252525','#484848');
    rrect(c,-hw+4,-hh+4,w-20,h-8,2,'#111','#555');
    circ(c,-hw+w-8,0,4,'#333','#555');
  } else if(t==='dishwasher'||t==='washing_machine'||t==='dryer'){
    boxF('#283848','#406080');
    circ(c,0,t==='dishwasher'?hh-12:0,Math.min(hw,hh)*0.6,'#182838','#507090');
  } else if(t==='sink_kitchen'||t==='sink_kitchen_double'){
    boxF('#3c4c58','#607888');
    if(t==='sink_kitchen') rrect(c,-hw+4,-hh+4,w-8,h-8,4,'#222c34','#507080');
    else{ rrect(c,-hw+3,-hh+4,w/2-5,h-8,4,'#222c34','#507080'); rrect(c,3,-hh+4,w/2-5,h-8,4,'#222c34','#507080'); }
  } else if(t==='bbq'||t==='bbq_ext'){
    boxF('#2e1e0e','#7a3a10');
    c.strokeStyle='#5a2a08';c.lineWidth=0.8/V.scale;
    for(let i=1;i<6;i++) ln(c,-hw+i*(w/6),-hh,-hw+i*(w/6),hh);
    c.fillStyle='rgba(255,80,0,0.2)';c.fillRect(-hw+3,-hh+3,w-6,h-6);

  // BATHROOM ─────────────────────────────────────────────────────
  } else if(t==='toilet'){
    c.fillStyle='#c8d0d8';c.strokeStyle='#7888a0';c.lineWidth=1/V.scale;
    c.fillRect(-hw,-hh,w,h*0.3);c.strokeRect(-hw,-hh,w,h*0.3);
    c.beginPath();c.moveTo(-hw,-hh+h*0.3);c.lineTo(-hw,hh);c.arc(0,hh,hw,Math.PI,0);c.lineTo(hw,-hh+h*0.3);c.closePath();c.fill();c.stroke();
    c.beginPath();c.ellipse(0,hh-h*0.18,hw*0.6,h*0.18,0,0,Math.PI*2);c.fillStyle='#a8b8c8';c.fill();c.stroke();
  } else if(t==='bidet'){
    c.fillStyle='#c8d0d8';c.strokeStyle='#7888a0';c.lineWidth=1/V.scale;
    c.beginPath();c.ellipse(0,0,hw,hh,0,0,Math.PI*2);c.fill();c.stroke();
    c.beginPath();c.ellipse(0,0,hw*0.6,hh*0.55,0,0,Math.PI*2);c.fillStyle='#a8b8c8';c.fill();c.stroke();
  } else if(t==='shower'||t==='shower_cabin'){
    boxF('#2c4050','#507090');
    c.strokeStyle='rgba(100,180,220,0.25)';c.lineWidth=0.6/V.scale;
    for(let i=-10;i<=20;i++){const d=i*(w/10);ln(c,-hw+d,-hh,-hw+d+h,hh);}
    circ(c,hw-w*0.2,-hh+h*0.2,4,'rgba(100,200,255,0.4)','#507090');
  } else if(t==='bathtub'){
    rrect(c,-hw,-hh,w,h,6,'#c8d4e0','#7888a0');
    rrect(c,-hw+5,-hh+5,w-10,h-10,4,'#a8c0d0',null);
    circ(c,0,hh-12,5,'#7080a0','#506070');
  } else if(t==='jacuzzi'||t==='jacuzzi_ext'){
    rrect(c,-hw,-hh,w,h,hw*0.3,'#1a2848','#3060a0');
    [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].forEach(([fx,fy])=>
      circ(c,-hw+fx*w,-hh+fy*h,3,'rgba(100,200,255,0.4)',null));
  } else if(t==='sink_bath'||t==='sink_bath_double'){
    c.fillStyle='#c0ccd4';c.strokeStyle='#7888a0';c.lineWidth=1/V.scale;
    if(t==='sink_bath'){
      c.beginPath();c.arc(0,hh,hw,Math.PI,0);c.lineTo(hw,-hh);c.lineTo(-hw,-hh);c.closePath();c.fill();c.stroke();
      circ(c,0,hh*0.3,2.5,'#607080',null);
    } else {
      rrect(c,-hw,-hh,w/2-2,h,4,'#c0ccd4','#7888a0');rrect(c,2,-hh,w/2-2,h,4,'#c0ccd4','#7888a0');
    }
  } else if(t==='cabinet_bath'){
    boxF('#485060','#708090');
    ln(c,0,-hh,0,hh);
    circ(c,-hw+w*0.25,0,1.5,'#90a0b0',null);circ(c,-hw+w*0.75,0,1.5,'#90a0b0',null);
  } else if(t==='towel_rack'){
    c.strokeStyle='#908070';c.lineWidth=2/V.scale;c.strokeRect(-hw,-hh,w,h);
    c.lineWidth=0.7/V.scale;for(let i=1;i<4;i++) ln(c,-hw+i*(w/4),-hh,-hw+i*(w/4),hh);

  // BEDROOM ──────────────────────────────────────────────────────
  } else if(t.startsWith('bed_')||t==='crib'){
    rrect(c,-hw,-hh,w,h,5,'#e0d4c0','#a09070');
    rrect(c,-hw+5,-hh+5,w-10,h*0.22-3,3,'#f0e8d8','#c0b090');
    c.strokeStyle='#c0b090';c.lineWidth=0.5/V.scale;
    const sy=-hh+h*0.25;
    for(let i=1;i<=3;i++) ln(c,-hw+10,sy+i*(h*0.7)/4,hw-10,sy+i*(h*0.7)/4);
    if(t==='bed_bunk'){c.setLineDash([4/V.scale,3/V.scale]);rrect(c,-hw+2,-hh+2,w-4,h-4,4,null,'rgba(255,255,255,0.25)');c.setLineDash([]);}
  } else if(t==='wardrobe'||t==='wardrobe_walk'){
    boxF('#3a2c1c','#6a4c2c');
    const doors=Math.max(2,Math.floor(w/45));
    c.strokeStyle='#6a4c2c';c.lineWidth=0.8/V.scale;
    for(let i=1;i<doors;i++) ln(c,-hw+i*(w/doors),-hh,-hw+i*(w/doors),hh);
    for(let i=0;i<doors;i++) circ(c,-hw+(i+.5)*(w/doors),0,2,'#b08840',null);
  } else if(t==='dresser'){
    boxF('#4a3828','#806040');
    c.strokeStyle='#806040';c.lineWidth=0.8/V.scale;
    for(let i=1;i<3;i++) ln(c,-hw,-hh+i*(h/3),hw,-hh+i*(h/3));
    for(let i=0;i<3;i++) circ(c,0,-hh+(i+.5)*(h/3),2,'#c09050',null);
  } else if(t==='nightstand'){
    boxF('#4a3828','#806040');circ(c,0,0,2,'#c09050',null);
  } else if(t==='vanity'){
    boxF('#4a3828','#806040');
    rrect(c,-hw+4,-hh+4,w-8,h*0.55,2,'rgba(100,200,255,0.15)','#5080a0');

  // LIVING ───────────────────────────────────────────────────────
  } else if(t==='sofa'||t==='sofa_3'||t==='armchair'||t==='chaise'){
    const bkH=h*0.28,armW=w*0.12;
    rrect(c,-hw,-hh,w,bkH,4,'#546070','#7888a0');
    rrect(c,-hw,-hh+bkH,armW,h-bkH,3,'#445060','#7888a0');
    rrect(c,hw-armW,-hh+bkH,armW,h-bkH,3,'#445060','#7888a0');
    rrect(c,-hw+armW,-hh+bkH,w-armW*2,h-bkH,4,'#546070','#7888a0');
    const seats=t==='sofa_3'?3:t==='sofa'?2:1;
    c.strokeStyle='#7888a0';c.lineWidth=0.5/V.scale;
    for(let i=1;i<seats;i++) ln(c,-hw+armW+i*(w-armW*2)/seats,-hh+bkH,-hw+armW+i*(w-armW*2)/seats,hh);
  } else if(t==='sofa_corner'){
    const bk=Math.min(w,h)*0.28;
    c.fillStyle='#546070';c.strokeStyle='#7888a0';c.lineWidth=1/V.scale;
    c.fillRect(-hw,-hh,w,bk);c.strokeRect(-hw,-hh,w,bk);
    c.fillRect(-hw,-hh,bk,h);c.strokeRect(-hw,-hh,bk,h);
    rrect(c,-hw+bk,-hh+bk,w-bk,h-bk,4,'#445060','#7888a0');
  } else if(t==='table_coffee'||t==='table_side'){
    rrect(c,-hw,-hh,w,h,4,'#4a3828','#806040');
    rrect(c,-hw+4,-hh+4,w-8,h-8,3,null,'rgba(255,255,255,0.08)');
  } else if(t.startsWith('table_dining')||t==='table_round'){
    if(t==='table_round') circ(c,0,0,hw,'#4a3828','#806040');
    else rrect(c,-hw,-hh,w,h,4,'#4a3828','#806040');
    drawChairsAround(c,w,h,t==='table_dining'?4:t==='table_dining_6'?6:t==='table_dining_8'?8:4,t==='table_round');
  } else if(t==='table_outdoor'){
    circ(c,0,0,hw,'#4a6030','#608040');
    drawChairsAround(c,w,h,4,true);
  } else if(t==='chair'||t==='chair_bar'||t==='chair_outdoor'){
    rrect(c,-hw,-hh+h*0.28,w,h-h*0.28,3,'#546070','#7888a0');
    rrect(c,-hw,-hh,w,h*0.3,3,'#445060','#7888a0');
  } else if(t==='bench'){
    boxF('#5a6068','#80909a');ln(c,0,-hh,0,hh);
  } else if(t==='tv'){
    rrect(c,-hw,-hh,w,h,2,'#0a0c10','#333');
    rrect(c,-hw+2,-hh+1,w-4,h-4,1,'#182028',null);
  } else if(t==='tv_stand'){
    boxF('#282820','#504840');
    c.strokeStyle='#504840';c.lineWidth=0.8/V.scale;
    [1/3,2/3].forEach(f=>ln(c,-hw+f*w,-hh,-hw+f*w,hh));
  } else if(t==='bookshelf'){
    boxF('#4a3828','#806040');
    c.strokeStyle='#806040';c.lineWidth=0.5/V.scale;
    for(let i=1;i<Math.floor(h/14);i++) ln(c,-hw,-hh+i*(h/Math.floor(h/14)),hw,-hh+i*(h/Math.floor(h/14)));
  } else if(t==='bar_cabinet'){
    boxF('#302010','#604020');
    ln(c,0,-hh,0,hh);
    circ(c,-hw+w*0.25,0,2,'#c0a040',null);circ(c,-hw+w*0.75,0,2,'#c0a040',null);

  // OFFICE ───────────────────────────────────────────────────────
  } else if(t==='desk'||t==='table_meeting'){
    boxF('#3a3020','#605040');
    if(t==='desk') rrect(c,-hw+4,-hh+4,w-8,h*0.45,2,null,'rgba(100,180,255,0.2)');
  } else if(t==='desk_l'){
    c.fillStyle='#3a3020';c.strokeStyle='#605040';c.lineWidth=1/V.scale;
    c.fillRect(-hw,-hh,w,h*0.38);c.strokeRect(-hw,-hh,w,h*0.38);
    c.fillRect(-hw,-hh,w*0.38,h);c.strokeRect(-hw,-hh,w*0.38,h);
  } else if(t==='desk_chair'){
    circ(c,0,0,hw,'#384858','#5878a0');circ(c,0,0,hw*0.55,'#283848',null);
    c.strokeStyle='#5878a0';c.lineWidth=0.8/V.scale;ln(c,0,hh*0.55,0,hh+5);
  } else if(t==='filing_cabinet'){
    boxF('#303848','#506080');
    for(let i=1;i<3;i++) ln(c,-hw,-hh+i*(h/3),hw,-hh+i*(h/3));
    circ(c,hw-7,0,2,'#708090',null);

  // OUTDOOR ──────────────────────────────────────────────────────
  } else if(t==='tree'||t==='tree_palm'){
    circ(c,hw*.18,hh*.18,hw*.85,'rgba(0,0,0,0.15)',null);
    const clrs=t==='tree_palm'?['#1a5a1a','#2a7a28','#3a9a38']:['#1c5020','#2c7030','#3c9040','#4cac50'];
    clrs.forEach((col,i)=>circ(c,0,0,hw*(1-i*.18),col,null));
    circ(c,0,0,hw*.1,'#6a3810',null);
    if(t==='tree_palm'){c.strokeStyle='#8a5820';c.lineWidth=0.8/V.scale;for(let i=0;i<6;i++){const a=i*Math.PI/3;ln(c,0,0,Math.cos(a)*hw*.7,Math.sin(a)*hw*.7);}}
  } else if(t==='bush'){
    circ(c,0,0,hw,'#1e5018','#2e7028');
    circ(c,-hw*.3,-hh*.3,hw*.5,'#1e6020',null);
    circ(c,hw*.25,-hh*.2,hw*.42,'#185820',null);
  } else if(t==='plant_small'){
    circ(c,0,0,hw,'#1a5820','#2a7030');
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;circ(c,Math.cos(a)*hw*.6,Math.sin(a)*hw*.6,hw*.28,'#2a7830',null);}
  } else if(t==='lawn'){
    rrect(c,-hw,-hh,w,h,5,'rgba(30,90,30,0.28)','rgba(50,130,50,0.45)');
    c.strokeStyle='rgba(50,130,50,0.12)';c.lineWidth=0.5/V.scale;
    for(let i=1;i<5;i++) ln(c,-hw,-hh+i*(h/5),hw,-hh+i*(h/5));
  } else if(t==='garden_bed'){
    rrect(c,-hw,-hh,w,h,4,'rgba(80,45,15,0.35)','rgba(110,65,20,0.55)');
    for(let i=0;i<6;i++){const fx=(i%3)/3+.15,fy=Math.floor(i/3)/2+.25;circ(c,-hw+fx*w,-hh+fy*h,5,'rgba(50,120,50,0.45)',null);}
  } else if(t==='pool'||t==='pool_round'){
    const fill='rgba(18,72,148,0.45)',stroke='#2858c0';
    t==='pool_round'?circ(c,0,0,hw,fill,stroke):rrect(c,-hw,-hh,w,h,hw*.12,fill,stroke);
    c.strokeStyle='rgba(100,180,255,0.25)';c.lineWidth=0.7/V.scale;c.setLineDash([6/V.scale,4/V.scale]);
    for(let i=1;i<4;i++) ln(c,-hw+10,-hh+i*(h/4)+5,hw-10,-hh+i*(h/4)+5);
    c.setLineDash([]);
  } else if(t==='pergola'){
    c.strokeStyle='#7a5828';c.lineWidth=2/V.scale;c.strokeRect(-hw,-hh,w,h);
    c.lineWidth=0.8/V.scale;
    for(let i=0;i<=Math.floor(w/40);i++) ln(c,-hw+i*(w/Math.floor(w/40)),-hh,-hw+i*(w/Math.floor(w/40)),hh);
    c.setLineDash([4/V.scale,4/V.scale]);c.lineWidth=0.5/V.scale;
    for(let i=0;i<=Math.floor(h/40);i++) ln(c,-hw,-hh+i*(h/Math.floor(h/40)),hw,-hh+i*(h/Math.floor(h/40)));
    c.setLineDash([]);
  } else if(t==='deck'){
    rrect(c,-hw,-hh,w,h,3,'rgba(100,65,20,0.28)','#7a5020');
    c.strokeStyle='rgba(140,85,30,0.4)';c.lineWidth=0.7/V.scale;
    for(let i=0;i<=Math.floor(h/10);i++) ln(c,-hw,-hh+i*(h/Math.floor(h/10)),hw,-hh+i*(h/Math.floor(h/10)));
  } else if(t==='car'||t==='car_suv'){
    rrect(c,-hw,-hh,w,h,hw*.1,'#2c3c4c','#4878a0');
    rrect(c,-hw+7,-hh+h*.2,w-14,h*.35,3,'rgba(100,180,220,0.25)','rgba(100,180,220,0.4)');
    [[-hw+10,-hh+10],[hw-10,-hh+10],[-hw+10,hh-10],[hw-10,hh-10]].forEach(([cx,cy])=>{
      circ(c,cx,cy,hw*.14,'#111','#333');});
  } else if(t==='moto'){
    rrect(c,-hw,-hh,w,h,hw*.2,'#202838','#3a5878');
    circ(c,0,-hh+h*.2,hw*.48,'#111','#333');circ(c,0,hh-h*.2,hw*.48,'#111','#333');
  } else if(t==='stairs'){
    c.strokeStyle='#888070';c.lineWidth=1/V.scale;c.strokeRect(-hw,-hh,w,h);
    const steps=Math.max(3,Math.floor(h/15));
    c.lineWidth=0.8/V.scale;for(let i=1;i<=steps;i++) ln(c,-hw,-hh+i*(h/steps),hw,-hh+i*(h/steps));
    c.strokeStyle='#c0a050';c.lineWidth=1.5/V.scale;ln(c,0,-hh+5,0,hh-8);
    ln(c,-5/V.scale,hh-16/V.scale,0,hh-8);ln(c,5/V.scale,hh-16/V.scale,0,hh-8);
  } else if(t==='stairs_spiral'){
    circ(c,0,0,hw,'#28241c','#706050');circ(c,0,0,hw*.28,'#14100c',null);
    c.strokeStyle='#706050';c.lineWidth=0.7/V.scale;
    for(let i=0;i<8;i++){const a=i*Math.PI/4;ln(c,Math.cos(a)*hw*.28,Math.sin(a)*hw*.28,Math.cos(a)*hw,Math.sin(a)*hw);}
  } else if(t==='ramp'){
    rrect(c,-hw,-hh,w,h,3,'rgba(90,80,60,0.3)','#807060');
    c.strokeStyle='rgba(150,130,90,0.35)';c.lineWidth=0.6/V.scale;
    for(let i=1;i<5;i++) ln(c,-hw,-hh+i*(h/5),hw,-hh+i*(h/5));
  } else if(t==='fence'){
    c.strokeStyle='#787878';c.lineWidth=2/V.scale;ln(c,-hw,0,hw,0);
    c.lineWidth=1.5/V.scale;const posts=Math.max(2,Math.floor(w/30));
    for(let i=0;i<=posts;i++) ln(c,-hw+i*(w/posts),-hh,-hw+i*(w/posts),hh);
  } else if(t==='water_tank'){
    circ(c,0,0,hw,'rgba(25,55,95,0.55)','#3858a0');circ(c,0,0,hw*.68,'rgba(18,72,140,0.35)',null);
    c.font=`${7/V.scale}px sans-serif`;c.fillStyle='#6880b0';c.textAlign='center';c.fillText('H₂O',0,3/V.scale);
  } else if(t==='north_arrow'){
    c.strokeStyle='#d8d0b0';c.lineWidth=2/V.scale;
    ln(c,0,-hh,0,hh);ln(c,-hw,0,hw,0);
    c.fillStyle='#d8d0b0';c.beginPath();c.moveTo(0,-hh);c.lineTo(-7/V.scale,-hh+16/V.scale);c.lineTo(7/V.scale,-hh+16/V.scale);c.closePath();c.fill();
    c.font=`bold ${11/V.scale}px sans-serif`;c.textAlign='center';c.fillText('N',0,-hh-7/V.scale);
  } else {
    boxF('rgba(80,80,80,0.35)','rgba(120,120,120,0.6)');
    c.font=`${Math.min(10,w*.12)/V.scale}px sans-serif`;c.fillStyle='rgba(255,255,255,0.5)';c.textAlign='center';
    c.fillText(t.replace(/_/g,' '),0,3/V.scale);
  }
}

function drawChairsAround(c,w,h,seats,isRound){
  const cs=16,cd=8,hw=w/2,hh=h/2;
  c.fillStyle='#546070';c.strokeStyle='#7888a0';c.lineWidth=0.6/V.scale;
  if(isRound){
    for(let i=0;i<seats;i++){
      const a=i*Math.PI*2/seats,r=hw+cd+cs/2;
      c.save();c.translate(Math.cos(a)*r,Math.sin(a)*r);c.rotate(a+Math.PI/2);
      c.fillRect(-cs/2,-cs*.4,cs,cs*.8);c.strokeRect(-cs/2,-cs*.4,cs,cs*.8);c.restore();
    }
  } else {
    const perS=Math.floor(seats/2),gap=w/(perS+1);
    for(let i=1;i<=perS;i++){
      [[-hh-cd-cs*.4,0],[hh+cd-cs*.4,Math.PI]].forEach(([oy,rot])=>{
        c.save();c.translate(-hw+i*gap,oy);c.rotate(rot);
        c.fillRect(-cs/2,-cs*.4,cs,cs*.8);c.strokeRect(-cs/2,-cs*.4,cs,cs*.8);c.restore();
      });
    }
  }
}

// ── ANNOTATIONS ─────────────────────────────────────────────────
function drawAnnotations(){
  S.annots.forEach(a=>{
    if(a.type==='dimension') drawDim(a);
  });
  S.elements.filter(e=>e.type==='text_label').forEach(el=>{
    ctx.save();ctx.translate(el.x,el.y);
    ctx.font=`${(el.fontSize||14)/V.scale}px sans-serif`;
    ctx.fillStyle=el.color||'#ffffff';ctx.textAlign='center';
    ctx.fillText(el.text||'Texto',0,0);ctx.restore();
  });
}

function drawDim(a){
  const dx=a.x2-a.x1,dy=a.y2-a.y1,len=Math.hypot(dx,dy);
  const ox=-dy/len*14,oy=dx/len*14;
  ctx.strokeStyle='rgba(200,185,90,0.75)';ctx.lineWidth=0.8/V.scale;
  ctx.setLineDash([4/V.scale,3/V.scale]);
  ctx.beginPath();ctx.moveTo(a.x1+ox,a.y1+oy);ctx.lineTo(a.x2+ox,a.y2+oy);ctx.stroke();
  ctx.setLineDash([]);
  const hl=7/V.scale,ang=Math.atan2(dy,dx);
  [0,1].forEach(end=>{
    const px=end?a.x2+ox:a.x1+ox,py=end?a.y2+oy:a.y1+oy,dir=end?-1:1;
    ctx.beginPath();
    ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(ang+Math.PI/6*dir)*hl,py+Math.sin(ang+Math.PI/6*dir)*hl);
    ctx.moveTo(px,py);ctx.lineTo(px+Math.cos(ang-Math.PI/6*dir)*hl,py+Math.sin(ang-Math.PI/6*dir)*hl);
    ctx.stroke();
  });
  ctx.font=`${10/V.scale}px sans-serif`;ctx.fillStyle='rgba(200,185,90,0.88)';ctx.textAlign='center';
  ctx.save();ctx.translate((a.x1+a.x2)/2+ox,(a.y1+a.y2)/2+oy-6/V.scale);ctx.rotate(ang);
  ctx.fillText(a.label||((len/100).toFixed(2)+' m'),0,0);ctx.restore();
}

// ── INTERACTION OVERLAY ──────────────────────────────────────────
function drawInteraction(){
  // Wall preview ghost
  if(activeTool==='wall'&&wallStart){
    let ex=curWorld.x,ey=curWorld.y;
    const snapR=snap90(wallStart.x,wallStart.y,ex,ey,shiftHeld);
    if(snapR.snapped){ex=snapR.x;ey=snapR.y;}
    const ghost={id:'__g__',x1:wallStart.x,y1:wallStart.y,x2:ex,y2:ey,
      thicknessCm:parseInt(document.getElementById('wall-thickness').value)||15,
      brickType:S.settings.brickType,
      colorBody:document.getElementById('wall-col-body').value,
      colorMortar:document.getElementById('wall-col-mortar').value,
      startTrim:0,endTrim:0};
    renderWall(ghost,0.5);
    // Length label
    const len=Math.hypot(ex-wallStart.x,ey-wallStart.y);
    const mx=(wallStart.x+ex)/2,my=(wallStart.y+ey)/2;
    ctx.font=`bold ${11/V.scale}px sans-serif`;ctx.fillStyle='#ffe050';ctx.textAlign='center';
    ctx.fillText((len/100).toFixed(2)+' m',mx,my-12/V.scale);
    // Snap guide
    if(snapR.snapped){
      ctx.strokeStyle='rgba(80,200,255,0.6)';ctx.lineWidth=0.6/V.scale;ctx.setLineDash([5/V.scale,4/V.scale]);
      ctx.beginPath();ctx.arc(ex,ey,8/V.scale,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
      ctx.font=`${9/V.scale}px sans-serif`;ctx.fillStyle='rgba(80,200,255,0.8)';
      ctx.fillText(snapR.angle+'°',ex+12/V.scale,ey-5/V.scale);
    }
    // Start point dot
    circ(ctx,wallStart.x,wallStart.y,3/V.scale,'#ffe050',null);
  }

  // Ghost for drag-from-panel (element placement)
  if(panelDragOver&&placeType&&curWorld){
    const sz=ELEM_SIZE[placeType]||{w:60,h:60};
    const gh={id:'__ghost__',type:placeType,x:curWorld.x,y:curWorld.y,wCm:sz.w,hCm:sz.h,rot:0};
    ctx.globalAlpha=0.55;
    ctx.save();ctx.translate(gh.x,gh.y);drawElem(ctx,gh);ctx.restore();
    ctx.globalAlpha=1;
  }

  // Room preset ghost
  if(panelDragOver&&roomDragSize&&curWorld){
    const {wCm,hCm}=roomDragSize;
    const hw=wCm/2,hh=hCm/2;
    ctx.save();
    ctx.strokeStyle='rgba(200,92,45,0.7)';ctx.lineWidth=1.5/V.scale;ctx.fillStyle='rgba(200,92,45,0.06)';
    ctx.setLineDash([6/V.scale,4/V.scale]);
    ctx.fillRect(curWorld.x-hw,curWorld.y-hh,wCm,hCm);
    ctx.strokeRect(curWorld.x-hw,curWorld.y-hh,wCm,hCm);
    ctx.setLineDash([]);
    // dimension labels
    ctx.font=`bold ${10/V.scale}px sans-serif`;ctx.fillStyle='rgba(200,92,45,0.9)';ctx.textAlign='center';
    ctx.fillText((wCm/100).toFixed(1)+' m',curWorld.x,curWorld.y-hh-6/V.scale);
    ctx.textAlign='right';
    ctx.fillText((hCm/100).toFixed(1)+' m',curWorld.x-hw-5/V.scale,curWorld.y);
    ctx.restore();
  }

  // Dimension line preview
  if(activeTool==='dimension'&&dimStart){
    ctx.strokeStyle='rgba(200,185,90,0.65)';ctx.lineWidth=0.8/V.scale;ctx.setLineDash([4/V.scale,3/V.scale]);
    ctx.beginPath();ctx.moveTo(dimStart.x,dimStart.y);ctx.lineTo(curWorld.x,curWorld.y);ctx.stroke();
    ctx.setLineDash([]);
  }

  // Room drag highlight
  if(draggingRoom){
    ctx.strokeStyle='rgba(44,120,230,0.6)';ctx.lineWidth=2/V.scale;
    ctx.setLineDash([6/V.scale,4/V.scale]);
    draggingRoom.walls.forEach(w=>{
      ctx.beginPath();ctx.moveTo(w.x1,w.y1);ctx.lineTo(w.x2,w.y2);ctx.stroke();
    });
    ctx.setLineDash([]);
  }

  // Hover room highlight (when select tool active and room under cursor)
  if(activeTool==='select'&&!dragging&&!draggingRoom&&!selected){
    const hr=hitRoom(curWorld.x,curWorld.y);
    if(hr&&hr.vertices){
      ctx.strokeStyle='rgba(44,120,230,0.35)';ctx.lineWidth=2/V.scale;
      ctx.beginPath();
      hr.vertices.forEach((v,i)=>i===0?ctx.moveTo(v.x,v.y):ctx.lineTo(v.x,v.y));
      ctx.closePath();ctx.stroke();
    }
  }

  // Selection handles
  if(selected){
    const el=S.elements.find(e=>e.id===selected);
    if(el&&!WALL_SNAP_TYPES.has(el.type)) drawSelHandles(el);
    const wa=S.walls.find(w=>w.id===selected);
    if(wa) drawWallSel(wa);
  }
}

function drawSelHandles(el){
  const hw=el.wCm/2,hh=el.hCm/2;
  ctx.save();ctx.translate(el.x,el.y);if(el.rot)ctx.rotate(el.rot*Math.PI/180);
  ctx.strokeStyle='rgba(100,200,255,0.75)';ctx.lineWidth=1/V.scale;
  ctx.setLineDash([4/V.scale,3/V.scale]);ctx.strokeRect(-hw,-hh,el.wCm,el.hCm);ctx.setLineDash([]);
  const hs=5/V.scale;
  [[-hw,-hh],[0,-hh],[hw,-hh],[hw,0],[hw,hh],[0,hh],[-hw,hh],[-hw,0]].forEach(([x,y])=>{
    ctx.fillStyle='rgba(18,22,30,0.85)';ctx.fillRect(x-hs,y-hs,hs*2,hs*2);
    ctx.strokeStyle='rgba(100,200,255,0.75)';ctx.strokeRect(x-hs,y-hs,hs*2,hs*2);
  });
  ctx.beginPath();ctx.arc(0,-hh-15/V.scale,4/V.scale,0,Math.PI*2);
  ctx.fillStyle='rgba(100,200,255,0.75)';ctx.fill();
  ctx.restore();
}

function drawWallSel(w){
  const T=w.thicknessCm||15;
  const ang=Math.atan2(w.y2-w.y1,w.x2-w.x1);
  const px=-Math.sin(ang)*T/2,py=Math.cos(ang)*T/2;
  ctx.strokeStyle='rgba(100,200,255,0.55)';ctx.lineWidth=1.2/V.scale;
  ctx.setLineDash([5/V.scale,3/V.scale]);
  ctx.beginPath();
  ctx.moveTo(w.x1+px,w.y1+py);ctx.lineTo(w.x2+px,w.y2+py);
  ctx.lineTo(w.x2-px,w.y2-py);ctx.lineTo(w.x1-px,w.y1-py);ctx.closePath();ctx.stroke();
  ctx.setLineDash([]);
}

function drawScreenUI(){
  const W=canvas.width,H=canvas.height,s=V.scale;
  const barM=100,scr=barM*s;
  const bx=W-scr-18,by=H-26;
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(bx-5,by-15,scr+10,20);
  ctx.strokeStyle='rgba(200,185,90,0.65)';ctx.lineWidth=1.5;
  ctx.strokeRect(bx,by-7,scr,5);
  ctx.fillStyle='rgba(200,185,90,0.75)';ctx.font='10px sans-serif';ctx.textAlign='center';
  ctx.fillText((barM/100)+'m',bx+scr/2,by+3);
}

function updateInfo(){
  const cx=(curWorld.x/100).toFixed(2),cy=(curWorld.y/100).toFixed(2);
  document.getElementById('cursor-pos').textContent=`${cx} × ${cy} m`;
  document.getElementById('zoom-level').textContent=`${Math.round(V.scale*100)}%`;
}

// ── 9. TOOLS ─────────────────────────────────────────────────────
let activeTool='select', wallStart=null, placeType=null;
let dimStart=null, selected=null, shiftHeld=false;
let dragging=null, draggingRoom=null, panning=false, panStart=null;
let curWorld={x:0,y:0};
// Panel drag state
let panelDragOver=false, roomDragSize=null;

function setTool(t){
  activeTool=t; wallStart=null; dimStart=null;
  draggingRoom=null; dragging=null;
  if(t!=='place') placeType=null;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));
  document.querySelectorAll('.elem-btn').forEach(b=>b.classList.remove('active-place'));
  const cw=document.getElementById('canvas-wrap');
  cw.className=''; cw.style.cursor='';
  cw.classList.add(t==='wall'?'csr-cross':t==='erase'?'csr-erase':t==='pan'?'csr-grab':'csr-default');
  if(t==='place') cw.classList.replace('csr-default','csr-copy');
}

function placeElem(type,wx,wy){
  const sz=ELEM_SIZE[type]||{w:60,h:60};
  let x=wx,y=wy,wallId=null,wallT=0.5,rot=0;
  if(WALL_SNAP_TYPES.has(type)){
    let bestD=30/V.scale,bestW=null,bestT=0.5;
    S.walls.forEach(w=>{const r=ptOnSegment(wx,wy,w.x1,w.y1,w.x2,w.y2);if(r.d<bestD){bestD=r.d;bestW=w;bestT=r.t;}});
    if(bestW){
      const dx=bestW.x2-bestW.x1,dy=bestW.y2-bestW.y1;
      x=bestW.x1+dx*bestT;y=bestW.y1+dy*bestT;
      wallId=bestW.id;wallT=bestT;rot=Math.atan2(dy,dx)*180/Math.PI;
    }
  }
  const sp=snapPt(x,y);
  doCmd(cmdAddElem({id:newId(),type,x:wallId?x:sp.x,y:wallId?y:sp.y,wCm:sz.w,hCm:sz.h,rot,wallId,wallT,z:0}));
}

function placeRoom(cx,cy,wCm,hCm){
  const T=parseInt(document.getElementById('wall-thickness').value)||15;
  const sp=snapPt(cx,cy);
  const x=sp.x,y=sp.y;
  const hw=wCm/2,hh=hCm/2;
  const bt=S.settings.brickType;
  const body=document.getElementById('wall-col-body').value;
  const mort=document.getElementById('wall-col-mortar').value;
  const walls=[
    {id:newId(),x1:x-hw,y1:y-hh,x2:x+hw,y2:y-hh,thicknessCm:T,brickType:bt,colorBody:body,colorMortar:mort},
    {id:newId(),x1:x+hw,y1:y-hh,x2:x+hw,y2:y+hh,thicknessCm:T,brickType:bt,colorBody:body,colorMortar:mort},
    {id:newId(),x1:x+hw,y1:y+hh,x2:x-hw,y2:y+hh,thicknessCm:T,brickType:bt,colorBody:body,colorMortar:mort},
    {id:newId(),x1:x-hw,y1:y+hh,x2:x-hw,y2:y-hh,thicknessCm:T,brickType:bt,colorBody:body,colorMortar:mort}
  ];
  walls.forEach(w=>{w.startTrim=0;w.endTrim=0;});
  doCmd(cmdAddRoom(walls));
}

// ── 10. EVENTS ───────────────────────────────────────────────────
function getWP(e){
  const r=canvas.getBoundingClientRect();
  return toWorld((e.clientX-r.left)*dpr,(e.clientY-r.top)*dpr);
}
function isOverCanvas(cx,cy){
  const r=canvas.getBoundingClientRect();
  return cx>=r.left&&cx<=r.right&&cy>=r.top&&cy<=r.bottom;
}

canvas.addEventListener('mousemove',e=>{
  curWorld=getWP(e);
  if(panning&&panStart){
    V.x+=e.clientX-panStart.x;V.y+=e.clientY-panStart.y;
    panStart={x:e.clientX,y:e.clientY};requestRender();return;
  }
  if(dragging){
    const el=S.elements.find(x=>x.id===dragging.id);
    if(el){
      const dx=curWorld.x-dragging.sx,dy=curWorld.y-dragging.sy;
      const sp=snapPt(dragging.ox+dx,dragging.oy+dy);
      el.x=sp.x;el.y=sp.y;requestRender();
    }
    return;
  }
  if(draggingRoom){
    const dx=curWorld.x-draggingRoom.sx, dy=curWorld.y-draggingRoom.sy;
    const sdx=snapGrid(dx), sdy=snapGrid(dy);
    draggingRoom.walls.forEach((w,i)=>{
      const o=draggingRoom.origPos[i];
      w.x1=o.x1+sdx;w.y1=o.y1+sdy;w.x2=o.x2+sdx;w.y2=o.y2+sdy;
    });
    computeCorners(); detectRooms(); requestRender();
    return;
  }
  // Update cursor for room hover
  if(activeTool==='select'&&!dragging&&!draggingRoom){
    const cw=document.getElementById('canvas-wrap');
    const hr=hitRoom(curWorld.x,curWorld.y);
    const hw=hitWall(curWorld.x,curWorld.y);
    const he=hitElem(curWorld.x,curWorld.y);
    if(he||hw) cw.style.cursor='pointer';
    else if(hr) cw.style.cursor='move';
    else cw.style.cursor='';
  }
  requestRender();
});

canvas.addEventListener('mousedown',e=>{
  if(e.button===1||spaceDown){panning=true;panStart={x:e.clientX,y:e.clientY};
    document.getElementById('canvas-wrap').classList.replace('csr-grab','csr-grabbing');return;}
  if(e.button===2) return;
  e.preventDefault();
  const wp=getWP(e); curWorld=wp;
  if(activeTool==='wall') onWallDown(wp,e.shiftKey);
  else if(activeTool==='select') onSelectDown(wp);
  else if(activeTool==='erase')  onEraseDown(wp);
  else if(activeTool==='dimension') onDimDown(wp);
});

canvas.addEventListener('mouseup',e=>{
  if(panning){panning=false;panStart=null;
    document.getElementById('canvas-wrap').classList.replace('csr-grabbing','csr-grab');}
  if(dragging){
    const el=S.elements.find(x=>x.id===dragging.id);
    if(el){
      const dx=el.x-dragging.ox,dy=el.y-dragging.oy;
      if(dx||dy){el.x=dragging.ox;el.y=dragging.oy;doCmd(cmdMoveElem(dragging.id,dx,dy));}
    }
    dragging=null;
  }
  if(draggingRoom){
    const orig=draggingRoom.origPos;
    const firstW=S.walls.find(w=>w.id===orig[0].id);
    const dx=firstW?(firstW.x1-orig[0].x1):0, dy=firstW?(firstW.y1-orig[0].y1):0;
    if(Math.abs(dx)>0.5||Math.abs(dy)>0.5){
      // reset to orig then apply via command
      orig.forEach(o=>{const w=S.walls.find(x=>x.id===o.id);if(w){w.x1=o.x1;w.y1=o.y1;w.x2=o.x2;w.y2=o.y2;}});
      doCmd(cmdMoveWalls(draggingRoom.wallIds, dx, dy));
    }
    draggingRoom=null;
    document.getElementById('canvas-wrap').classList.remove('csr-grabbing');
  }
});

canvas.addEventListener('wheel',e=>{
  e.preventDefault();
  const r=canvas.getBoundingClientRect();
  const sx=(e.clientX-r.left)*dpr,sy=(e.clientY-r.top)*dpr;
  const f=e.deltaY<0?1.12:1/1.12;
  V.x=sx-(sx-V.x)*f;V.y=sy-(sy-V.y)*f;
  V.scale=Math.max(0.08,Math.min(25,V.scale*f));
  requestRender();
},{passive:false});

canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const wp=getWP(e);
  const el=hitElem(wp.x,wp.y);
  if(el){selected=el.id;showCtx(e.clientX,e.clientY);}else hideCtx();
});

canvas.addEventListener('dblclick',e=>{
  const wp=getWP(e);
  const room=S.rooms.find(r=>Math.hypot(r.centroid.x-wp.x,r.centroid.y-wp.y)<20/V.scale);
  if(room){const n=prompt('Nome do cômodo:',room.label);if(n!==null){room.label=n;requestRender();}}
});

function onWallDown(wp,shift){
  const ep=snapEndpoints(wp.x,wp.y)||wp;
  const sp=snapPt(ep.x,ep.y);
  if(!wallStart){wallStart={x:sp.x,y:sp.y};}
  else{
    let ex=sp.x,ey=sp.y;
    const ep2=snapEndpoints(ex,ey)||{x:ex,y:ey};
    const sp2=snapPt(ep2.x,ep2.y);
    ex=sp2.x;ey=sp2.y;
    const snapR=snap90(wallStart.x,wallStart.y,ex,ey,shift);
    if(snapR.snapped){ex=snapR.x;ey=snapR.y;}
    if(Math.hypot(ex-wallStart.x,ey-wallStart.y)>3){
      doCmd(cmdAddWall({id:newId(),
        x1:wallStart.x,y1:wallStart.y,x2:ex,y2:ey,
        thicknessCm:parseInt(document.getElementById('wall-thickness').value)||15,
        brickType:S.settings.brickType,
        colorBody:document.getElementById('wall-col-body').value,
        colorMortar:document.getElementById('wall-col-mortar').value,
        startTrim:0,endTrim:0}));
    }
    wallStart={x:ex,y:ey}; // continue wall chain
  }
}

function onSelectDown(wp){
  const el=hitElem(wp.x,wp.y);
  if(el){selected=el.id;dragging={id:el.id,sx:wp.x,sy:wp.y,ox:el.x,oy:el.y};showProps(el);requestRender();return;}
  const wa=hitWall(wp.x,wp.y);
  if(wa){selected=wa.id;showWallProps(wa);requestRender();return;}
  const rm=hitRoom(wp.x,wp.y);
  if(rm){
    const rWalls=getWallsOfRoom(rm);
    const origPos=rWalls.map(w=>({id:w.id,x1:w.x1,y1:w.y1,x2:w.x2,y2:w.y2}));
    draggingRoom={room:rm,walls:rWalls,wallIds:rWalls.map(w=>w.id),sx:wp.x,sy:wp.y,origPos};
    selected=null; clearProps();
    document.getElementById('canvas-wrap').classList.add('csr-grabbing');
  } else { selected=null; clearProps(); }
  requestRender();
}

function onEraseDown(wp){
  const el=hitElem(wp.x,wp.y);
  if(el){doCmd(cmdDelElem(el.id));selected=null;return;}
  const wa=hitWall(wp.x,wp.y);
  if(wa){doCmd(cmdDelWall(wa.id));selected=null;}
}

function onDimDown(wp){
  if(!dimStart){dimStart={x:wp.x,y:wp.y};}
  else{
    const len=Math.hypot(wp.x-dimStart.x,wp.y-dimStart.y);
    S.annots.push({id:newId(),type:'dimension',x1:dimStart.x,y1:dimStart.y,x2:wp.x,y2:wp.y,label:(len/100).toFixed(2)+' m'});
    dimStart=null;requestRender();
  }
}

function hitElem(wx,wy){
  const arr=[...S.elements].reverse();
  for(const el of arr){
    if(WALL_SNAP_TYPES.has(el.type)) continue;
    const dx=wx-el.x,dy=wy-el.y;
    const rad=(el.rot||0)*Math.PI/180;
    const lx=dx*Math.cos(rad)+dy*Math.sin(rad);
    const ly=-dx*Math.sin(rad)+dy*Math.cos(rad);
    if(Math.abs(lx)<=el.wCm/2+3/V.scale&&Math.abs(ly)<=el.hCm/2+3/V.scale) return el;
  }
  return null;
}

function hitWall(wx,wy){
  for(const w of S.walls){
    const r=ptOnSegment(wx,wy,w.x1,w.y1,w.x2,w.y2);
    if(r.d<=(w.thicknessCm||15)/2+4/V.scale) return w;
  }
  return null;
}

function pointInPolygon(px,py,verts){
  let inside=false;
  for(let i=0,j=verts.length-1;i<verts.length;j=i++){
    const xi=verts[i].x,yi=verts[i].y,xj=verts[j].x,yj=verts[j].y;
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}

function hitRoom(wx,wy){
  for(const r of S.rooms){
    if(r.vertices&&r.vertices.length>=3&&pointInPolygon(wx,wy,r.vertices)) return r;
  }
  return null;
}

function getWallsOfRoom(room){
  const verts=room.vertices;
  return S.walls.filter(w=>{
    const p1=verts.some(v=>Math.hypot(v.x-w.x1,v.y-w.y1)<EPS*3);
    const p2=verts.some(v=>Math.hypot(v.x-w.x2,v.y-w.y2)<EPS*3);
    return p1&&p2;
  });
}

// ── PANEL DRAG ───────────────────────────────────────────────────
let spaceDown=false;

// Drag-from-panel: elem buttons
document.querySelectorAll('.elem-btn[data-type]').forEach(btn=>{
  btn.addEventListener('mousedown',e=>{
    e.preventDefault();
    const type=btn.dataset.type;
    placeType=type; roomDragSize=null;
    panelDragOver=false;
    const ghost=document.getElementById('drag-ghost');
    ghost.style.width='32px';ghost.style.height='32px';
    ghost.style.display='block';
    ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
    document.querySelectorAll('.elem-btn').forEach(b=>b.classList.remove('active-place'));
    btn.classList.add('active-place');
  });
});

// Drag-from-panel: room preset buttons
document.querySelectorAll('.room-btn').forEach(btn=>{
  btn.addEventListener('mousedown',e=>{
    e.preventDefault();
    let rw=parseFloat(btn.dataset.rw)||0;
    let rh=parseFloat(btn.dataset.rh)||0;
    if(rw===0||rh===0){
      rw=parseFloat(document.getElementById('room-preset-w').value)*100||300;
      rh=parseFloat(document.getElementById('room-preset-h').value)*100||300;
    }
    roomDragSize={wCm:rw,hCm:rh}; placeType=null;
    panelDragOver=false;
    const ghost=document.getElementById('drag-ghost');
    ghost.style.width='48px';ghost.style.height='48px';
    ghost.style.display='block';
    ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
  });
});

window.addEventListener('mousemove',e=>{
  if(!placeType&&!roomDragSize) return;
  const ghost=document.getElementById('drag-ghost');
  ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';
  panelDragOver=isOverCanvas(e.clientX,e.clientY);
  if(panelDragOver){
    const r=canvas.getBoundingClientRect();
    curWorld=toWorld((e.clientX-r.left)*dpr,(e.clientY-r.top)*dpr);
    requestRender();
  }
});

window.addEventListener('mouseup',e=>{
  const ghost=document.getElementById('drag-ghost');
  ghost.style.display='none';
  if(panelDragOver&&isOverCanvas(e.clientX,e.clientY)){
    const r=canvas.getBoundingClientRect();
    curWorld=toWorld((e.clientX-r.left)*dpr,(e.clientY-r.top)*dpr);
    if(placeType)       placeElem(placeType,curWorld.x,curWorld.y);
    else if(roomDragSize) placeRoom(curWorld.x,curWorld.y,roomDragSize.wCm,roomDragSize.hCm);
  }
  if(placeType||roomDragSize){
    placeType=null;roomDragSize=null;panelDragOver=false;
    document.querySelectorAll('.elem-btn').forEach(b=>b.classList.remove('active-place'));
    requestRender();
  }
});

// Keyboard
window.addEventListener('keydown',e=>{
  const tag=e.target.tagName;
  if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA') return;
  if(e.key===' '){spaceDown=true;if(!panning){panning=true;panStart={x:e.clientX||0,y:e.clientY||0};}e.preventDefault();return;}
  shiftHeld=e.shiftKey;
  if(e.ctrlKey&&e.key==='z'){undo();return;}
  if(e.ctrlKey&&(e.key==='y'||e.key==='Y')){redo();return;}
  if(e.ctrlKey&&e.key==='d'){
    if(selected){const el=S.elements.find(x=>x.id===selected);if(el){const c={...el,id:newId(),x:el.x+20,y:el.y+20};doCmd(cmdAddElem(c));selected=c.id;}}return;}
  if(e.key==='Delete'||e.key==='Backspace'){
    if(selected){
      if(S.elements.find(x=>x.id===selected)) doCmd(cmdDelElem(selected));
      else if(S.walls.find(w=>w.id===selected)) doCmd(cmdDelWall(selected));
      selected=null;clearProps();}return;}
  if(e.key==='Escape'){wallStart=null;dimStart=null;placeType=null;roomDragSize=null;setTool('select');requestRender();return;}
  if(!e.ctrlKey){
    if(e.key==='s'||e.key==='S') setTool('select');
    if(e.key==='w'||e.key==='W') setTool('wall');
    if(e.key==='e'||e.key==='E') setTool('erase');
    if(e.key==='d'||e.key==='D') setTool('dimension');
    if(e.key==='?') showHelp();
  }
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&selected){
    const el=S.elements.find(x=>x.id===selected);
    if(el){const step=e.shiftKey?S.terrain.gridCm:1;
      const dx=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;
      const dy=e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0;
      doCmd(cmdMoveElem(el.id,dx,dy));}
  }
});
window.addEventListener('keyup',e=>{
  if(e.key===' '){spaceDown=false;if(!dragging){panning=false;panStart=null;}}
  shiftHeld=e.shiftKey;
});

// ── 10b. TOUCH EVENTS ─────────────────────────────────────────────
let _touches=[]; // track active touches
let _pinchDist0=0, _pinchScale0=1, _pinchMidX=0, _pinchMidY=0;
let _tapTimer=null, _longPressTimer=null;

function getTouchWorld(t){
  const r=canvas.getBoundingClientRect();
  return toWorld((t.clientX-r.left)*dpr,(t.clientY-r.top)*dpr);
}
function touchDist(a,b){ return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY); }
function touchMid(a,b){ return {x:(a.clientX+b.clientX)/2, y:(a.clientY+b.clientY)/2}; }

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  _touches=[...e.touches];
  if(_touches.length===1){
    const t=_touches[0];
    const wp=getTouchWorld(t);
    curWorld=wp;
    // Long press → select/drag (300ms)
    _longPressTimer=setTimeout(()=>{
      if(activeTool==='select') onSelectDown(wp);
    },300);
    // Quick tap for tools
    _tapTimer=setTimeout(()=>{ _tapTimer=null; },400);
  } else if(_touches.length===2){
    clearTimeout(_longPressTimer);_longPressTimer=null;
    // Cancel any ongoing room drag
    if(draggingRoom){
      const o=draggingRoom.origPos;
      o.forEach(op=>{const w=S.walls.find(x=>x.id===op.id);if(w){w.x1=op.x1;w.y1=op.y1;w.x2=op.x2;w.y2=op.y2;}});
      draggingRoom=null;
    }
    panning=false;
    _pinchDist0=touchDist(_touches[0],_touches[1]);
    _pinchScale0=V.scale;
    const m=touchMid(_touches[0],_touches[1]);
    const r=canvas.getBoundingClientRect();
    _pinchMidX=(m.x-r.left)*dpr; _pinchMidY=(m.y-r.top)*dpr;
    panning=true; panStart={x:m.x,y:m.y};
  }
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  _touches=[...e.touches];
  if(_touches.length===1){
    clearTimeout(_longPressTimer);_longPressTimer=null;
    const t=_touches[0];
    curWorld=getTouchWorld(t);
    if(dragging){
      const el=S.elements.find(x=>x.id===dragging.id);
      if(el){const sp=snapPt(dragging.ox+(curWorld.x-dragging.sx),dragging.oy+(curWorld.y-dragging.sy));el.x=sp.x;el.y=sp.y;requestRender();}
      return;
    }
    if(draggingRoom){
      const dx=curWorld.x-draggingRoom.sx, dy=curWorld.y-draggingRoom.sy;
      const sdx=snapGrid(dx), sdy=snapGrid(dy);
      draggingRoom.walls.forEach((w,i)=>{const o=draggingRoom.origPos[i];w.x1=o.x1+sdx;w.y1=o.y1+sdy;w.x2=o.x2+sdx;w.y2=o.y2+sdy;});
      computeCorners(); detectRooms(); requestRender();
      return;
    }
    // Single finger pan
    if(panStart){V.x+=t.clientX-panStart.x;V.y+=t.clientY-panStart.y;panStart={x:t.clientX,y:t.clientY};requestRender();}
    else{panStart={x:t.clientX,y:t.clientY};}
  } else if(_touches.length===2){
    const d=touchDist(_touches[0],_touches[1]);
    const f=d/_pinchDist0;
    const newScale=Math.max(0.08,Math.min(25,_pinchScale0*f));
    V.x=_pinchMidX-(_pinchMidX-V.x)*(newScale/V.scale);
    V.y=_pinchMidY-(_pinchMidY-V.y)*(newScale/V.scale);
    V.scale=newScale;
    const m=touchMid(_touches[0],_touches[1]);
    V.x+=(m.x-panStart.x);V.y+=(m.y-panStart.y);
    panStart={x:m.x,y:m.y};
    requestRender();
  }
},{passive:false});

canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  clearTimeout(_longPressTimer);_longPressTimer=null;
  const prev=_touches;
  _touches=[...e.touches];
  if(e.touches.length===0){
    // Finger lifted
    if(dragging){
      const el=S.elements.find(x=>x.id===dragging.id);
      if(el){const dx=el.x-dragging.ox,dy=el.y-dragging.oy;if(dx||dy){el.x=dragging.ox;el.y=dragging.oy;doCmd(cmdMoveElem(dragging.id,dx,dy));}}
      dragging=null;
    }
    if(draggingRoom){
      const orig=draggingRoom.origPos;
      const firstW=S.walls.find(w=>w.id===orig[0].id);
      const dx=firstW?(firstW.x1-orig[0].x1):0, dy=firstW?(firstW.y1-orig[0].y1):0;
      if(Math.abs(dx)>0.5||Math.abs(dy)>0.5){
        orig.forEach(o=>{const w=S.walls.find(x=>x.id===o.id);if(w){w.x1=o.x1;w.y1=o.y1;w.x2=o.x2;w.y2=o.y2;}});
        doCmd(cmdMoveWalls(draggingRoom.wallIds, dx, dy));
      }
      draggingRoom=null;
    }
    panning=false; panStart=null;
    // Tap detection: if it was a quick tap without move
    if(_tapTimer!==null&&prev.length===1){
      const t=prev[0];
      const wp=getTouchWorld(t);
      if(activeTool==='wall') onWallDown(wp,false);
      else if(activeTool==='select') onSelectDown(wp);
      else if(activeTool==='erase') onEraseDown(wp);
      else if(activeTool==='dimension') onDimDown(wp);
    }
    _tapTimer=null;
  }
  if(e.touches.length<2){ panning=false; panStart=null; }
},{passive:false});

// ── 11. PANEL ACCORDION ───────────────────────────────────────────
document.querySelectorAll('section.cat .cat-hd').forEach(hd=>{
  hd.addEventListener('click',()=>{
    const sec=hd.closest('section.cat');
    const bd=sec.querySelector('.cat-bd');
    sec.classList.toggle('open');
    if(bd) bd.classList.toggle('hidden',!sec.classList.contains('open'));
  });
});
document.querySelectorAll('.sub .sub-hd').forEach(hd=>{
  hd.addEventListener('click',()=>{
    const s=hd.closest('.sub');
    const bd=s.querySelector('.sub-bd');
    s.classList.toggle('open');
    if(bd) bd.classList.toggle('hidden',!s.classList.contains('open'));
  });
});
document.querySelectorAll('.tool-btn[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
document.getElementById('btn-snap').addEventListener('click',()=>{
  S.settings.snapGrid=!S.settings.snapGrid;
  document.getElementById('btn-snap').classList.toggle('active',S.settings.snapGrid);
});
document.getElementById('snap-90').addEventListener('change',e=>{S.settings.snap90=e.target.checked;});
document.getElementById('brick-select').addEventListener('change',e=>{S.settings.brickType=e.target.value;requestRender();});
document.getElementById('scale-select').addEventListener('change',e=>fitTerrain(parseFloat(e.target.value)));
['grid','foundation','walls','furniture','annotations'].forEach(k=>{
  document.getElementById('layer-'+k).addEventListener('change',e=>{layers[k]=e.target.checked;requestRender();});
});
document.getElementById('btn-undo').addEventListener('click',undo);
document.getElementById('btn-redo').addEventListener('click',redo);
document.getElementById('btn-new').addEventListener('click',()=>{document.getElementById('modal-terrain').classList.remove('hidden');document.getElementById('modal-terrain').style.display='flex';});
document.getElementById('btn-save').addEventListener('click',saveJSON);
document.getElementById('file-input').addEventListener('change',loadJSON);
document.getElementById('btn-export-png').addEventListener('click',exportPNG);
document.getElementById('btn-export-pdf').addEventListener('click',exportPDF);
document.getElementById('btn-help').addEventListener('click',showHelp);
document.getElementById('btn-help-close').addEventListener('click',()=>document.getElementById('modal-help').classList.add('hidden'));

// ── 12. PROPERTIES ────────────────────────────────────────────────
function showProps(el){
  document.getElementById('props-body').innerHTML=`
    <div class="prop-badge">${el.type.replace(/_/g,' ')}</div>
    <div class="prop-sec">Posição</div>
    <div class="prop-r"><label>X (m)</label><input type="number" id="p-x" value="${(el.x/100).toFixed(2)}" step="0.01"></div>
    <div class="prop-r"><label>Y (m)</label><input type="number" id="p-y" value="${(el.y/100).toFixed(2)}" step="0.01"></div>
    <div class="prop-sec">Dimensões</div>
    <div class="prop-r"><label>Larg (cm)</label><input type="number" id="p-w" value="${el.wCm}" step="1" min="5"></div>
    <div class="prop-r"><label>Prof (cm)</label><input type="number" id="p-h" value="${el.hCm}" step="1" min="5"></div>
    <div class="prop-sec">Rotação</div>
    <div class="prop-r"><label>Ângulo °</label><input type="number" id="p-rot" value="${el.rot||0}" step="5"></div>
    <div class="prop-r"><label></label><input type="range" id="p-rot-r" min="0" max="360" value="${el.rot||0}"></div>
    <button class="btn-prop red" id="p-del" style="margin-top:12px">🗑 Apagar</button>`;
  const upd=()=>{el.x=parseFloat(document.getElementById('p-x').value)*100;el.y=parseFloat(document.getElementById('p-y').value)*100;el.wCm=parseFloat(document.getElementById('p-w').value);el.hCm=parseFloat(document.getElementById('p-h').value);el.rot=parseFloat(document.getElementById('p-rot').value);document.getElementById('p-rot-r').value=el.rot;requestRender();};
  ['p-x','p-y','p-w','p-h','p-rot'].forEach(id=>document.getElementById(id).addEventListener('change',upd));
  document.getElementById('p-rot-r').addEventListener('input',()=>{document.getElementById('p-rot').value=document.getElementById('p-rot-r').value;upd();});
  document.getElementById('p-del').addEventListener('click',()=>{doCmd(cmdDelElem(el.id));selected=null;clearProps();});
}

function showWallProps(w){
  const len=+(Math.hypot(w.x2-w.x1,w.y2-w.y1)/100).toFixed(2);
  document.getElementById('props-body').innerHTML=`
    <div class="prop-badge">Parede</div>
    <div class="prop-r"><label>Comprimento</label><span style="color:var(--text)">${len} m</span></div>
    <div class="prop-sec">Espessura</div>
    <div class="prop-r"><label>Esp (cm)</label><input type="number" id="pw-t" value="${w.thicknessCm||15}" step="2.5" min="5"></div>
    <div class="prop-sec">Cores</div>
    <div class="prop-r"><label>Tijolo</label><input type="color" id="pw-b" value="${w.colorBody||'#C85C2D'}"></div>
    <div class="prop-r"><label>Argamassa</label><input type="color" id="pw-m" value="${w.colorMortar||'#3D8B7A'}"></div>
    <button class="btn-prop red" id="pw-del" style="margin-top:12px">🗑 Apagar parede</button>`;
  document.getElementById('pw-t').addEventListener('change',e=>{w.thicknessCm=parseFloat(e.target.value);computeCorners();requestRender();});
  document.getElementById('pw-b').addEventListener('input',e=>{w.colorBody=e.target.value;requestRender();});
  document.getElementById('pw-m').addEventListener('input',e=>{w.colorMortar=e.target.value;requestRender();});
  document.getElementById('pw-del').addEventListener('click',()=>{doCmd(cmdDelWall(w.id));selected=null;clearProps();});
}

function clearProps(){ document.getElementById('props-body').innerHTML='<p class="hint">Selecione um elemento para editar.</p>'; }

// Context menu
function showCtx(x,y){const m=document.getElementById('ctx-menu');m.style.left=x+'px';m.style.top=y+'px';m.classList.remove('hidden');}
function hideCtx(){document.getElementById('ctx-menu').classList.add('hidden');}
document.getElementById('ctx-dup').addEventListener('click',()=>{if(selected){const el=S.elements.find(x=>x.id===selected);if(el){const c={...el,id:newId(),x:el.x+20,y:el.y+20};doCmd(cmdAddElem(c));selected=c.id;}}hideCtx();});
document.getElementById('ctx-front').addEventListener('click',()=>{if(selected){const el=S.elements.find(x=>x.id===selected);if(el)el.z=(el.z||0)+1;requestRender();}hideCtx();});
document.getElementById('ctx-back').addEventListener('click',()=>{if(selected){const el=S.elements.find(x=>x.id===selected);if(el)el.z=(el.z||0)-1;requestRender();}hideCtx();});
document.getElementById('ctx-del').addEventListener('click',()=>{if(selected){doCmd(cmdDelElem(selected));selected=null;clearProps();}hideCtx();});
window.addEventListener('click',e=>{if(!e.target.closest('#ctx-menu'))hideCtx();});
function showHelp(){document.getElementById('modal-help').classList.remove('hidden');}

// ── 13. TERRAIN MODAL ─────────────────────────────────────────────
document.getElementById('btn-create').addEventListener('click',()=>{
  const name=document.getElementById('m-name').value||'Minha Casa';
  const wM=parseFloat(document.getElementById('m-w').value)||15;
  const hM=parseFloat(document.getElementById('m-h').value)||12;
  const grid=parseInt(document.getElementById('m-grid').value)||15;
  const brick=document.getElementById('m-brick').value;
  S={meta:{name},terrain:{wCm:wM*100,hCm:hM*100,gridCm:grid},
    settings:{brickType:brick,snapGrid:true,snap90:true},
    walls:[],elements:[],rooms:[],annots:[]};
  H.stack=[];H.cur=-1;
  document.getElementById('project-name').value=name;
  document.getElementById('brick-select').value=brick;
  document.getElementById('modal-terrain').style.display='none';
  fitTerrain(); requestRender();
});

// ── 14. SAVE / EXPORT ─────────────────────────────────────────────
let _ast=null;
function autoSave(){
  clearTimeout(_ast);
  _ast=setTimeout(()=>{
    try{localStorage.setItem('ecobrick_v1',JSON.stringify({S,V}));
      const el=document.getElementById('save-status');el.textContent='✓';setTimeout(()=>el.textContent='',2000);}catch(e){}
  },3000);
}
function saveJSON(){
  const b=new Blob([JSON.stringify({S,V},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(S.meta.name||'projeto')+'.json';a.click();
}
function loadJSON(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{try{const d=JSON.parse(ev.target.result);if(d.S)S=d.S;if(d.V)V=d.V;document.getElementById('project-name').value=S.meta.name||'';computeCorners();detectRooms();requestRender();}catch(e){alert('Erro ao carregar.');}};
  r.readAsText(f);e.target.value='';
}
function exportPNG(){
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=(S.meta.name||'planta')+'.png';a.click();
}
function exportPDF(){
  if(!window.jspdf){alert('jsPDF não carregado.');return;}
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({orientation:'landscape',unit:'px',format:[canvas.width,canvas.height]});
  pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);
  pdf.save((S.meta.name||'planta')+'.pdf');
}

// ── 15. RESIZE & INIT ─────────────────────────────────────────────
function resizeCanvas(){
  const wrap=document.getElementById('canvas-wrap');
  dpr=window.devicePixelRatio||1;
  canvas.width=wrap.clientWidth*dpr;canvas.height=wrap.clientHeight*dpr;
  canvas.style.width=wrap.clientWidth+'px';canvas.style.height=wrap.clientHeight+'px';
  if(S.terrain&&S.terrain.wCm) fitTerrain(); else requestRender();
}
window.addEventListener('resize',resizeCanvas);

function fitTerrain(tgt){
  const wrap=document.getElementById('canvas-wrap');
  const cw=wrap.clientWidth*dpr,ch=wrap.clientHeight*dpr;
  const sx=cw*.82/S.terrain.wCm,sy=ch*.82/S.terrain.hCm;
  V.scale=tgt||Math.min(sx,sy);
  V.x=(cw-S.terrain.wCm*V.scale)/2;
  V.y=(ch-S.terrain.hCm*V.scale)/2;
  requestRender();
}

document.addEventListener('DOMContentLoaded',()=>{
  resizeCanvas();
  initDB().catch(()=>{});
  try{
    const saved=localStorage.getItem('ecobrick_v1');
    if(saved){const d=JSON.parse(saved);if(d.S)S=d.S;if(d.V)V=d.V;
      document.getElementById('project-name').value=S.meta.name||'';
      document.getElementById('modal-terrain').style.display='none';
      computeCorners();detectRooms();fitTerrain();return;}
  }catch(e){}
  document.getElementById('modal-terrain').style.display='flex';
  requestRender();
});

// ── 16. TURSO CLOUD ───────────────────────────────────────────────
async function tursoExec(sql, args=[]){
  const res=await fetch('/api/turso',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({requests:[
      {type:'execute',stmt:{sql,args:args.map(v=>({type:'text',value:String(v)}))}},
      {type:'close'}
    ]})
  });
  if(!res.ok) throw new Error(`Turso HTTP ${res.status}`);
  const j=await res.json();
  if(j.results&&j.results[0]&&j.results[0].type==='error') throw new Error(j.results[0].error.message);
  return j.results[0]?.response?.result;
}

async function initDB(){
  await tursoExec(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER DEFAULT (unixepoch()),
    updated_at INTEGER DEFAULT (unixepoch())
  )`);
}

async function cloudSave(){
  if(!S.meta.id) S.meta.id=newId();
  const name=S.meta.name||'Minha Casa';
  const data=JSON.stringify({S,V});
  await tursoExec(
    `INSERT INTO projects(id,name,data,updated_at) VALUES(?,?,?,unixepoch())
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,data=excluded.data,updated_at=excluded.updated_at`,
    [S.meta.id,name,data]
  );
  return name;
}

async function cloudList(){
  const r=await tursoExec('SELECT id,name,updated_at FROM projects ORDER BY updated_at DESC LIMIT 50');
  return (r?.rows||[]).map(row=>({id:row[0].value,name:row[1].value,ts:parseInt(row[2].value)}));
}

async function cloudLoad(id){
  const r=await tursoExec('SELECT data FROM projects WHERE id=?',[id]);
  const row=r?.rows?.[0];
  if(!row) throw new Error('Projeto não encontrado');
  return JSON.parse(row[0].value);
}

async function cloudDelete(id){
  await tursoExec('DELETE FROM projects WHERE id=?',[id]);
}

function fmtDate(ts){
  const d=new Date(ts*1000);
  return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}

function cloudStatus(msg,type){
  const el=document.getElementById('cloud-status');
  el.textContent=msg; el.className='cloud-status '+(type||'ok');
  if(type==='ok') setTimeout(()=>{el.className='cloud-status';},3000);
}

async function openCloudModal(){
  const modal=document.getElementById('modal-cloud');
  modal.classList.remove('hidden');
  const list=document.getElementById('cloud-list');
  const status=document.getElementById('cloud-status');
  status.className='cloud-status';
  list.innerHTML='<p class="hint">Carregando...</p>';
  try{
    const projects=await cloudList();
    if(!projects.length){ list.innerHTML='<p class="hint">Nenhum projeto salvo na nuvem.</p>'; return; }
    list.innerHTML=projects.map(p=>`
      <div class="cloud-row">
        <span class="cloud-row-name">${p.name}</span>
        <span class="cloud-row-date">${fmtDate(p.ts)}</span>
        <div class="cloud-row-actions">
          <button class="btn-cloud-load" data-id="${p.id}">Abrir</button>
          <button class="btn-cloud-del"  data-id="${p.id}">🗑</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.btn-cloud-load').forEach(b=>b.addEventListener('click',async()=>{
      b.textContent='...';b.disabled=true;
      try{
        const d=await cloudLoad(b.dataset.id);
        if(d.S)S=d.S;if(d.V)V=d.V;
        document.getElementById('project-name').value=S.meta.name||'';
        computeCorners();detectRooms();fitTerrain();
        modal.classList.add('hidden');
        cloudStatus('Projeto carregado!','ok');
      }catch(e){cloudStatus('Erro ao carregar: '+e.message,'err');}
    }));
    list.querySelectorAll('.btn-cloud-del').forEach(b=>b.addEventListener('click',async()=>{
      if(!confirm('Deletar este projeto da nuvem?')) return;
      b.textContent='...';b.disabled=true;
      try{ await cloudDelete(b.dataset.id); await openCloudModal(); }
      catch(e){ cloudStatus('Erro ao deletar: '+e.message,'err'); }
    }));
  }catch(e){
    list.innerHTML=`<p class="hint" style="color:#c0392b">Erro ao conectar: ${e.message}</p>`;
  }
}

document.getElementById('btn-cloud').addEventListener('click',openCloudModal);
document.getElementById('btn-cloud-close').addEventListener('click',()=>document.getElementById('modal-cloud').classList.add('hidden'));
document.getElementById('btn-cloud-save').addEventListener('click',async()=>{
  const btn=document.getElementById('btn-cloud-save');
  btn.textContent='Salvando...';btn.disabled=true;
  try{
    const name=await cloudSave();
    cloudStatus(`"${name}" salvo na nuvem ✓`,'ok');
    await openCloudModal();
  }catch(e){
    cloudStatus('Erro ao salvar: '+e.message,'err');
  }finally{
    btn.textContent='💾 Salvar Projeto Atual';btn.disabled=false;
  }
});
