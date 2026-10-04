import React,{useEffect,useMemo,useRef,useState}from"react";
import{createRoot}from"react-dom/client";
 import{io}from"socket.io-client";import"./style.css";
const API=location.hostname==="localhost"?(localStorage.getItem("okeyServer")||"http://localhost:3001"):location.origin;
const s=io(API),COL={"Siyah":"#151515","Kırmızı":"#d52727","Mavi":"#176fd1","Sarı":"#d89b00"};
const AVATARS=["🦁","🐺","🦅","🐯","🦊","👑","🎩","🕶️","⚡","🔥","🌙","⭐"];
const savedProfile=(()=>{try{return JSON.parse(localStorage.getItem("okeyProfile")||"{}")}catch{return{}}})();
const PLAYER_TOKEN=(()=>{let t=localStorage.getItem("okeyPlayerToken");if(!t){t=(crypto?.randomUUID?.()||("p-"+Date.now()+"-"+Math.random()));localStorage.setItem("okeyPlayerToken",t)}return t})();
function Tile({t,sel,onClick,drag,onDrop,isOkey=false,allowReveal=false,flipped=false,onFlip}){
 const timer=useRef(null),held=useRef(false);
 const begin=()=>{if(!allowReveal||!isOkey)return;held.current=false;timer.current=setTimeout(()=>{held.current=true;onFlip?.(t.id)},5000)};
 const endHold=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null};
 useEffect(()=>()=>endHold(),[]);
 const click=e=>{if(held.current){held.current=false;e.preventDefault();return}onClick?.(e)};
 return <button draggable={!!drag} onDragStart={drag} onDragOver={e=>e.preventDefault()} onDrop={onDrop}
  onMouseDown={begin} onMouseUp={endHold} onMouseLeave={endHold} onTouchStart={begin} onTouchEnd={endHold}
  className={"tile "+(sel?"selected ":"")+(flipped?"revealed ":"")} onClick={click}>
  <span className="tileface front">{t.c==="Sahte"?<><b className="fake">★</b><small>SAHTE</small></>:<><b style={{color:COL[t.c]}}>{t.n}</b><i style={{background:COL[t.c]}}/></>}</span>
  <span className="tileface back"><b>★</b><small>OKEY</small></span>
 </button>
}
function logical(t,st){if(!t)return null;if(t.c==="Sahte"&&st?.indicator)return{...t,c:st.indicator.c,n:st.okey.n};return t}
function jokerTile(t,st){return !!(t&&st?.okey&&t.c===st.okey.c&&t.n===st.okey.n)}
function validGroup(ts,st){
 if(ts.length<3)return false;let js=ts.filter(t=>jokerTile(t,st)).length,a=ts.filter(t=>!jokerTile(t,st)).map(t=>logical(t,st));if(!a.length)return true;
 if(a.every(t=>t.n===a[0].n)&&new Set(a.map(t=>t.c)).size===a.length&&a.length+js<=4)return true;
 if(!a.every(t=>t.c===a[0].c))return false;let ns=a.map(t=>t.n).sort((x,y)=>x-y);if(new Set(ns).size!==ns.length)return false;let gaps=0;for(let i=1;i<ns.length;i++)gaps+=ns[i]-ns[i-1]-1;return gaps<=js
}
function allRackRuns(slots,st){
 let out=[],cur=[],start=0;
 slots.forEach((t,i)=>{if(t){if(!cur.length)start=i;cur.push(t)}else if(cur.length){if(validGroup(cur,st))out.push({tiles:cur,start,end:i-1});cur=[]}});
 if(cur.length&&validGroup(cur,st))out.push({tiles:cur,start,end:slots.length-1});
 return out
}
function perValue(groups,st){return groups.flatMap(g=>g.tiles||g).reduce((z,t)=>z+(jokerTile(t,st)?0:(logical(t,st)?.n||0)),0)}
function pairAnalysis(slots,st){
 let tiles=slots.filter(Boolean),used=new Set(),pairs=0;
 for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){if(used.has(i)||used.has(j)||jokerTile(tiles[i],st)||jokerTile(tiles[j],st))continue;let a=logical(tiles[i],st),b=logical(tiles[j],st);if(a.c===b.c&&a.n===b.n){used.add(i);used.add(j);pairs++;break}}
 let jok=tiles.filter(t=>jokerTile(t,st)).length,need=Math.max(0,5-pairs),useJ=Math.min(jok,need),count=pairs+useJ;
 let pairIds=[...used].map(i=>tiles[i]?.id).filter(Boolean),jokerTiles=tiles.filter(t=>jokerTile(t,st)).slice(0,need);
 if(count>=5){let singles=tiles.filter((t,i)=>!used.has(i)&&!jokerTile(t,st)).slice(0,jokerTiles.length);pairIds.push(...jokerTiles.map(t=>t.id),...singles.map(t=>t.id))}
 let pairSet=new Set(pairIds),remaining=tiles.filter(t=>!pairSet.has(t.id)),sum=remaining.reduce((z,t)=>z+(jokerTile(t,st)?0:(logical(t,st)?.n||0)),0);
 return{count,penalty:count>=5?sum*2:null,pairIds}
}
function smartGroups(hand,st){
 const nonJ=hand.filter(t=>!jokerTile(t,st)),jokers=hand.filter(t=>jokerTile(t,st)),cands=[];
 const add=arr=>{let ids=[...new Set(arr.map(t=>t.id))];if(ids.length>=3)cands.push({tiles:arr,ids,score:arr.reduce((z,t)=>z+(jokerTile(t,st)?0:(logical(t,st)?.n||0)),0)})};
 for(let n=1;n<=13;n++){let a=nonJ.filter(t=>logical(t,st).n===n),by={};a.forEach(t=>(by[logical(t,st).c]??=[]).push(t));
   let colors=Object.keys(by);if(colors.length>=3)add(colors.slice(0,4).map(c=>by[c][0]));
   if(colors.length===2&&jokers.length)add([by[colors[0]][0],by[colors[1]][0],jokers[0]]);
 }
 for(let c of Object.keys(COL)){let by={};nonJ.filter(t=>logical(t,st).c===c).forEach(t=>(by[logical(t,st).n]??=[]).push(t));
  for(let a=1;a<=13;a++)for(let b=a+2;b<=13;b++){let vals=[],missing=[];for(let n=a;n<=b;n++){if(by[n]?.length)vals.push(by[n][0]);else missing.push(n)}
   if(missing.length<=jokers.length&&vals.length+missing.length>=3)add([...vals,...jokers.slice(0,missing.length)])
  }
 }
 let index=new Map(hand.map((t,i)=>[t.id,i])),uniq=new Map();
 cands.forEach(g=>{let mask=0n;g.ids.forEach(id=>mask|=1n<<BigInt(index.get(id)));let k=mask.toString();let prev=uniq.get(k);if(!prev||g.score>prev.score)uniq.set(k,{...g,mask})});
 let arr=[...uniq.values()].sort((a,b)=>b.score-a.score||b.tiles.length-a.tiles.length).slice(0,180),memo=new Map();
 function dfs(i,used){if(i>=arr.length)return{score:0,count:0,gs:[]};let key=i+"|"+used.toString();if(memo.has(key))return memo.get(key);
  let best=dfs(i+1,used),g=arr[i];if((g.mask&used)===0n){let z=dfs(i+1,used|g.mask),take={score:g.score+z.score,count:g.tiles.length+z.count,gs:[g,...z.gs]};if(take.score>best.score||(take.score===best.score&&take.count>best.count))best=take}
  memo.set(key,best);return best
 }
 return dfs(0,0n).gs
}
function buildSlots(groups,hand){
 let used=new Set(groups.flatMap(g=>g.tiles.map(t=>t.id))),rest=hand.filter(t=>!used.has(t.id)),out=Array(32).fill(null),p=0;
 for(let g of groups){for(let t of g.tiles){if(p>=32)break;out[p++]=t}p=Math.min(31,p+1)}
 for(let t of rest){while(p<32&&out[p])p++;if(p<32)out[p++]=t}
 return out
}
function App(){
 const[name,setName]=useState(savedProfile.name||"Oyuncu"),[avatar,setAvatar]=useState(savedProfile.avatar||"🦁"),[photo,setPhoto]=useState(savedProfile.photo||""),[screen,setScreen]=useState("home"),[rooms,setRooms]=useState([]),[room,setRoom]=useState(null),[st,setSt]=useState(null),[hand,setHand]=useState([]),[slots,setSlots]=useState(Array(32).fill(null)),[sel,setSel]=useState([]),[chosenGroups,setChosenGroups]=useState([]),[msg,setMsg]=useState(""),[flipped,setFlipped]=useState(()=>new Set());
 const[mode,setMode]=useState("katlamasiz"),[help,setHelp]=useState(true),[hands,setHands]=useState(5),[code,setCode]=useState(""),[serverUrl,setServerUrl]=useState(API);
 const joinPayload=(c,create=false,settings)=>({code:c,name,avatar,photo,token:PLAYER_TOKEN,create,settings});
 useEffect(()=>{
  const onHand=h=>{setHand(h);setFlipped(f=>new Set([...f].filter(id=>h.some(t=>t.id===id))));setSlots(old=>{let ids=new Set(h.map(t=>t.id)),kept=old.map(t=>t&&ids.has(t.id)?h.find(x=>x.id===t.id):null),present=new Set(kept.filter(Boolean).map(t=>t.id)),add=h.filter(t=>!present.has(t.id));for(let t of add){let k=kept.indexOf(null);if(k<0)kept.push(t);else kept[k]=t}return kept.slice(0,32)})};
  const onJoined=x=>{setRoom(x);setScreen("room");localStorage.setItem("okeyLastRoom",x.code)};
  const onNotice=x=>setMsg(x);
  const onConnect=()=>{let c=localStorage.getItem("okeyLastRoom");if(c&&screen==="room")s.emit("join",joinPayload(c,false))};
  s.on("lobby",setRooms);s.on("state",setSt);s.on("hand",onHand);s.on("joined",onJoined);s.on("err",setMsg);s.on("notice",onNotice);s.on("connect",onConnect);
  return()=>{s.off("lobby",setRooms);s.off("state",setSt);s.off("hand",onHand);s.off("joined",onJoined);s.off("err",setMsg);s.off("notice",onNotice);s.off("connect",onConnect)}
 },[name,avatar,photo,screen]);
 const saveProfile=()=>{let p={name:name.trim()||"Oyuncu",avatar,photo};localStorage.setItem("okeyProfile",JSON.stringify(p));setName(p.name);s.emit("profileUpdate",p);setMsg("Profil kaydedildi.");setScreen("home")};
 const choosePhoto=e=>{let f=e.target.files?.[0];if(!f)return;if(!f.type.startsWith("image/"))return setMsg("Lütfen bir fotoğraf seç.");let rd=new FileReader();rd.onload=()=>{let im=new Image();im.onload=()=>{let c=document.createElement("canvas"),size=256;c.width=size;c.height=size;let m=Math.min(im.width,im.height),sx=(im.width-m)/2,sy=(im.height-m)/2;c.getContext("2d").drawImage(im,sx,sy,m,m,0,0,size,size);setPhoto(c.toDataURL("image/jpeg",.78));setAvatar("")};im.src=rd.result};rd.readAsDataURL(f)};
 const saveServer=()=>{localStorage.setItem("okeyServer",serverUrl.trim());setMsg("Sunucu adresi kaydedildi. Yeniden açınca aktif olur.")};
 const create=()=>{let c=(Math.floor(100000+Math.random()*900000)).toString();s.emit("join",joinPayload(c,true,{mode,help,hands:+hands}))};
 const join=c=>s.emit("join",joinPayload(c,false));
 const isOkey=t=>!!(st?.okey&&t?.c===st.okey.c&&t?.n===st.okey.n);
 const toggle=id=>setSel(a=>a.includes(id)?a.filter(x=>x!==id):[...a,id]);
 const flip=id=>setFlipped(a=>{let n=new Set(a);n.has(id)?n.delete(id):n.add(id);return n});
 const emitOrder=a=>s.emit("reorder",a.filter(Boolean).map(t=>t.id));
 const move=(from,to)=>setSlots(old=>{let a=[...old],x=a[from];if(!x)return a;let y=a[to];a[to]=x;a[from]=y||null;emitOrder(a);return a});
 const moveGroup=(start,end,to)=>setSlots(old=>{let a=[...old],len=end-start+1;if(to+len>32)return old;let block=a.slice(start,end+1);if(block.some(x=>!x))return old;
  let source=new Set(Array.from({length:len},(_,i)=>start+i)),target=Array.from({length:len},(_,i)=>to+i),blocked=target.some(i=>a[i]&&!source.has(i));if(blocked){setMsg("Peri taşımak için hedefte yan yana yeterli boş alan bırak.");return old}
  source.forEach(i=>a[i]=null);target.forEach((i,k)=>a[i]=block[k]);emitOrder(a);return a});
 const doSeries=()=>{if(!room?.settings?.help)return setMsg("Seri Diz sadece Yardımlı odalarda kullanılabilir.");let gs=smartGroups(hand,st),a=buildSlots(gs,hand);setSlots(a);emitOrder(a);setMsg(gs.length?`En yüksek per toplamına göre ${gs.length} per dizildi.`:"Geçerli per bulunamadı.")};
 const doPairs=()=>{if(!room?.settings?.help)return setMsg("Çift Diz sadece Yardımlı odalarda kullanılabilir.");let q={};hand.forEach(t=>{let k=(logical(t,st)?.c||t.c)+"-"+(logical(t,st)?.n||t.n);(q[k]??=[]).push(t)});let pairs=[],rest=[],used=new Set();Object.values(q).forEach(a=>{while(a.length>=2){let x=a.shift(),y=a.shift();pairs.push([x,y]);used.add(x.id);used.add(y.id)}});rest=hand.filter(t=>!used.has(t.id));let a=Array(32).fill(null),p=0;pairs.forEach(g=>{a[p++]=g[0];a[p++]=g[1];p++});rest.forEach(t=>{while(p<32&&a[p])p++;if(p<32)a[p++]=t});setSlots(a);emitOrder(a);setMsg(`${pairs.length} çift yan yana dizildi.`)};
 const groups=allRackRuns(slots,st),perTotal=perValue(groups,st),pairInfo=pairAnalysis(slots,st);
 const openFromRack=()=>{let use=chosenGroups.length?groups.filter((_,i)=>chosenGroups.includes(i)):groups,gs=use.map(g=>g.tiles.map(t=>t.id));if(!gs.length)return setMsg("Geçerli per bulunamadı.");s.emit("openGroups",gs);setChosenGroups([])};
 const openPairsRack=()=>{if(pairInfo.count<5)return setMsg("Henüz 5 çift yok.");s.emit("pairs",pairInfo.pairIds)};
 if(screen==="home")return <main className="home"><div className="topbar"><span>👑 VIP</span><span>✉ Mesajlar</span><span>👥 Arkadaşlar</span><span>⚙ Ayarlar</span></div><div className="hero"><div className="logo"><span>1</span><span>0</span><span>1</span></div><h1>OKEY ARENA</h1><p className="tag">İstanbul gecelerinde masanı kur</p><div className="homeProfile"><div className="profileAvatar">{photo?<img src={photo}/>:<span>{avatar||"🦁"}</span>}</div><div><b>{name}</b><button onClick={()=>setScreen("profile")}>Profili Düzenle</button></div></div><input value={name} onChange={e=>setName(e.target.value)} placeholder="Kullanıcı adın"/><div className="homeBtns"><button onClick={()=>setScreen("create")}>🀄 ODA AÇ<br/><small>Kendi masanı kur</small></button><button onClick={()=>setScreen("find")}>👥 ODA BUL<br/><small>Açık masalara katıl</small></button></div><p>{msg}</p><div className="homeDock"><button onClick={()=>setScreen("profile")}>👤 Profil</button><span>🏆 Sıralama</span><span>📻 Radyo</span><span>⭐ Etkinlikler</span></div></div></main>;
 if(screen==="profile")return <main className="panelPage"><section className="panel profilePanel"><button className="back" onClick={()=>setScreen("home")}>←</button><h2>PROFİLİM</h2><div className="bigAvatar">{photo?<img src={photo}/>:<span>{avatar||"🦁"}</span>}</div><label>Kullanıcı adı</label><input maxLength={18} value={name} onChange={e=>setName(e.target.value)}/><label>Hazır avatarlar</label><div className="avatarGrid">{AVATARS.map(a=><button key={a} className={!photo&&avatar===a?"chosen":""} onClick={()=>{setAvatar(a);setPhoto("")}}>{a}</button>)}</div><label className="galleryButton">📷 GALERİDEN FOTOĞRAF SEÇ<input type="file" accept="image/*" onChange={choosePhoto}/></label>{photo&&<button className="removePhoto" onClick={()=>{setPhoto("");setAvatar("🦁")}}>Fotoğrafı kaldır</button>}<button className="gold" onClick={saveProfile}>PROFİLİ KAYDET</button><hr/><label>Android test sunucusu</label><div className="serverRow"><input value={serverUrl} onChange={e=>setServerUrl(e.target.value)}/><button onClick={saveServer}>Kaydet</button></div><p>{msg}</p></section></main>;
 if(screen==="create")return <main className="panelPage"><section className="panel"><button className="back" onClick={()=>setScreen("home")}>←</button><h2>ODA AÇ</h2><label>Oyun modu</label><div className="choice"><button className={mode==="katlamasiz"?"on":""} onClick={()=>setMode("katlamasiz")}>Katlamasız</button><button className={mode==="katlamali"?"on":""} onClick={()=>setMode("katlamali")}>Katlamalı</button></div><label>Yardım</label><div className="choice"><button className={help?"on":""} onClick={()=>setHelp(true)}>Yardımlı</button><button className={!help?"on":""} onClick={()=>setHelp(false)}>Yardımsız</button></div><label>El sayısı</label><select value={hands} onChange={e=>setHands(e.target.value)}>{[1,3,5,7,10,15,20].map(x=><option key={x} value={x}>{x} El</option>)}</select><button className="gold" onClick={create}>ODAYI OLUŞTUR</button></section></main>;
 if(screen==="find")return <main className="panelPage"><section className="panel wide"><button className="back" onClick={()=>setScreen("home")}>←</button><h2>ODA BUL</h2><div className="roomList">{rooms.length?rooms.map(r=><div className="roomCard" key={r.code}><div><b>Oda #{r.code}</b><small>{r.count}/4 oyuncu • {r.mode==="katlamali"?"Katlamalı":"Katlamasız"} • {r.help?"Yardımlı":"Yardımsız"} • {r.hands} El</small></div><button onClick={()=>join(r.code)}>KATIL</button></div>):<p>Açık oda bulunamadı.</p>}</div><div className="codeJoin"><input value={code} onChange={e=>setCode(e.target.value)} placeholder="Oda kodu"/><button onClick={()=>join(code)}>KODLA KATIL</button></div><p>{msg}</p></section></main>;
 return <main className="game premiumGame"><header><b>101 OKEY</b><span>ODA #{room?.code}</span><span>{room?.settings?.mode==="katlamali"?"KATLAMALI":"KATLAMASIZ"}</span><span>{room?.settings?.help?"YARDIMLI":"YARDIMSIZ"}</span><span>{room?.settings?.hands} EL</span></header>
 <div className="players">{st?.players?.map((p,i)=><div key={p.id||i} className={(st.current===i?"turn ":"")+(p.connected===false?"offline":"")}><div className="playerAvatar">{p.photo?<img src={p.photo}/>:<span>{p.avatar||"🦁"}</span>}</div><div><b>{p.name}</b><small>{p.score} ceza {p.opened?"• AÇTI":""}{p.bot?" • BOT":""}{p.connected===false?" • ÇIKTI":""}</small></div></div>)}</div>
 <section className="table"><div className="istanbulGlow"></div><div className="indicator"><label>GÖSTERGE</label>{st?.indicator&&<Tile t={st.indicator}/>}</div><div className="okey"><label>OKEY</label>{st?.okey&&<Tile t={st.okey}/>}</div><div className="melds">{st?.melds?.map((m,i)=><div className="meld" key={i}><small>{m.name}</small><div>{m.ts?.map(t=><Tile key={t.id} t={t}/>)}</div></div>)}</div><div className="discard"><label>YER</label>{st?.discard?.length?<Tile t={st.discard.at(-1)}/>:<b>—</b>}</div></section>
 <div className="message">{msg}</div><div className="actions">{!st?.started?<>{room?.owner&&<button className="botPlay" onClick={()=>s.emit("playBots")}>🤖 BOTLARLA OYNA</button>}<button onClick={()=>s.emit("start")}>OYUNU BAŞLAT</button></>:<><button onClick={()=>s.emit("draw")}>ORTADAN ÇEK</button><button onClick={()=>s.emit("take")}>YANDAN AL</button><button onClick={()=>s.emit("returnSide")}>YANDAN GERİ KOY</button><button onClick={openFromRack}>PERLERİ AÇ</button><button onClick={openPairsRack}>ÇİFT AÇ</button><button onClick={()=>{if(sel.length===1){s.emit("discard",sel[0]);setSel([])}}}>TAŞ AT</button></>}</div>
 <div className="groupBar"><span>PERLER:</span>{groups.map((g,i)=><button key={i} className={chosenGroups.includes(i)?"picked":""} onClick={()=>setChosenGroups(a=>a.includes(i)?a.filter(x=>x!==i):[...a,i])}>Per {i+1} • {perValue([g],st)}</button>)}<small>Boşluklarla ayırdığın geçerli perler burada tek grup olarak görünür.</small></div>
 <div className="privateCounters"><div><small>SADECE SEN GÖRÜRSÜN</small><b>PER <strong>{perTotal}</strong></b></div><div><small>{pairInfo.count} ÇİFT</small><b>ÇİFT <strong>{pairInfo.penalty===null?"—":pairInfo.penalty}</strong></b></div></div>
 {room?.settings?.help?<div className="optional"><span>Yardımlı dizme:</span><button onClick={doSeries}>Seri Diz</button><button onClick={doPairs}>Çift Diz</button><strong>En yüksek geçerli grupları öne getirir.</strong></div>:<div className="optional disabledHelp">Yardımsız oda: otomatik dizme kapalı.</div>}
 <section className="rack slotRack">{[0,1].map(row=><div className="rackrow" key={row}>{slots.slice(row*16,row*16+16).map((t,j)=>{let i=row*16+j,g=groups.find(g=>g.start===i);return <div className="slot" key={i} onDragOver={e=>e.preventDefault()} onDrop={e=>{let kind=e.dataTransfer.getData("kind");if(kind==="group")moveGroup(+e.dataTransfer.getData("start"),+e.dataTransfer.getData("end"),i);else move(+e.dataTransfer.getData("from"),i)}}>{g&&<button className="groupHandle" draggable onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData("kind","group");e.dataTransfer.setData("start",String(g.start));e.dataTransfer.setData("end",String(g.end))}} title="Peri komple taşı">⇔</button>}{t?<Tile t={t} sel={sel.includes(t.id)} onClick={()=>toggle(t.id)} drag={e=>{e.dataTransfer.setData("kind","tile");e.dataTransfer.setData("from",String(i))}} isOkey={isOkey(t)} allowReveal={true} flipped={flipped.has(t.id)} onFlip={flip}/>:<span className="emptySlot">+</span>}</div>})}</div>)}</section>
 <div className="okeyHint">💡 Okey eldeyken normal görünür. 5 saniye basılı tutunca ters döner ve tekrar 5 saniye basana kadar ters kalır.</div>
 </main>
}
createRoot(document.getElementById("root")).render(<App/>);