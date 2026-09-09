import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
//  API SERVICE  (swap BASE_URL to your deployed backend)
// ─────────────────────────────────────────────────────────────
const BASE_URL = "http://localhost:5000/api";   // ← change for production

const getToken  = () => localStorage.getItem("nexus_token");
const setToken  = (t) => localStorage.setItem("nexus_token", t);
const clearToken = () => localStorage.removeItem("nexus_token");

async function apiRequest(method, path, body) {
  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // Use AbortController for broader compatibility
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000); // 3s max

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || "Request failed");
      err.status = res.status; err.upgrade = data.upgrade;
      throw err;
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    // Any network/timeout/CORS error = treat as offline
    if (err.name === "AbortError" || err.name === "TypeError" ||
        err.name === "TimeoutError" || err.message?.includes("fetch") ||
        err.message?.includes("network") || err.message?.includes("Failed")) {
      const offline = new Error("Server offline — running in demo mode");
      offline.offline = true;
      throw offline;
    }
    throw err;
  }
}

const API = {
  // Health
  health: () => apiRequest("GET", "/health"),

  // Auth
  register: (body) => apiRequest("POST", "/auth/register", body),
  login:    (body) => apiRequest("POST", "/auth/login",    body),
  me:       ()     => apiRequest("GET",  "/auth/me"),

  // Wallet
  getWallet: ()     => apiRequest("GET",  "/wallet"),
  deposit:   (body) => apiRequest("POST", "/wallet/deposit",  body),
  withdraw:  (body) => apiRequest("POST", "/wallet/withdraw", body),

  // Signals
  getSignals: () => apiRequest("GET", "/signals"),

  // AI
  analyzeAI: (body) => apiRequest("POST", "/ai/analyze", body),

  // Trades
  getTrades:   ()     => apiRequest("GET",   "/trades"),
  openTrade:   (body) => apiRequest("POST",  "/trades",            body),
  closeTrade:  (id, body) => apiRequest("PATCH", `/trades/${id}/close`, body),

  // Copy trading
  toggleCopy: (body) => apiRequest("POST", "/copy/toggle", body),

  // Subscription
  paystackInit:   (body) => apiRequest("POST", "/subscription/paystack/init",         body),
  paystackVerify: (ref)  => apiRequest("GET",  `/subscription/paystack/verify/${ref}`),

  // Referrals
  getReferrals: () => apiRequest("GET", "/referrals"),

  // Admin
  adminUsers:            ()     => apiRequest("GET",   "/admin/users"),
  adminSetTier:          (id,b) => apiRequest("PATCH", `/admin/users/${id}/tier`, b),
  adminWithdrawals:      ()     => apiRequest("GET",   "/admin/withdrawals"),
  adminUpdateWithdrawal: (id,b) => apiRequest("PATCH", `/admin/withdrawals/${id}`, b),
};

// ─── Design tokens ────────────────────────────────────────────
const C = {
  bg:"#03070d", panel:"#080f1a", panel2:"#0d1825",
  border:"#0f2035", border2:"#162840",
  accent:"#00d4ff", gold:"#ffb800", diamond:"#b388ff",
  green:"#00e676", red:"#ff3d5a", orange:"#ff8c00",
  text:"#c8dff0", bright:"#e8f4ff", muted:"#2d4a62", muted2:"#4a6e87",
};

// ─── Pair data ────────────────────────────────────────────────
const PAIRS = ["BTCUSDT","ETHUSDT","EURUSD","GBPUSD","USDJPY","XAUUSD"];
const PAIR_META = {
  BTCUSDT:{ label:"BTC/USDT", icon:"₿",   cat:"crypto", base:64000 },
  ETHUSDT:{ label:"ETH/USDT", icon:"Ξ",   cat:"crypto", base:3100  },
  EURUSD: { label:"EUR/USD",  icon:"🇪🇺", cat:"forex",  base:1.08  },
  GBPUSD: { label:"GBP/USD",  icon:"🇬🇧", cat:"forex",  base:1.27  },
  USDJPY: { label:"USD/JPY",  icon:"🇯🇵", cat:"forex",  base:154   },
  XAUUSD: { label:"XAU/USD",  icon:"🥇",  cat:"metals", base:2312  },
};
const CAT_GROUPS = { crypto:["BTCUSDT","ETHUSDT"], forex:["EURUSD","GBPUSD","USDJPY"], metals:["XAUUSD"] };
const CAT_COLOR  = { crypto:C.gold, forex:C.accent, metals:"#ffd700" };

// ─── Helpers ──────────────────────────────────────────────────
const formatPrice = (pair, price) => {
  if (!price && price !== 0) return "—";
  if (pair==="USDJPY") return price.toFixed(3);
  if (pair==="BTCUSDT"||pair==="ETHUSDT") return price.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
  if (pair==="XAUUSD") return price.toFixed(2);
  return price.toFixed(5);
};

const generateCandle = (price) => {
  const open  = price;
  const close = price + (Math.random()-0.5)*price*0.002;
  const high  = Math.max(open,close)+Math.random()*price*0.001;
  const low   = Math.min(open,close)-Math.random()*price*0.001;
  return { open,high,low,close };
};

const seedCandles = (base, n=55) => {
  const vol = base>5000?0.012:base>100?0.005:0.003;
  let p = base;
  return Array.from({length:n},()=>{
    p = Math.max(p+(Math.random()-0.49)*p*vol, base*0.7);
    return generateCandle(p);
  });
};

const initPairData = () => ({
  BTCUSDT:{ price:64000, change:0, candles:seedCandles(64000) },
  ETHUSDT:{ price:3100,  change:0, candles:seedCandles(3100)  },
  EURUSD: { price:1.08,  change:0, candles:seedCandles(1.08)  },
  GBPUSD: { price:1.27,  change:0, candles:seedCandles(1.27)  },
  USDJPY: { price:154,   change:0, candles:seedCandles(154)   },
  XAUUSD: { price:2312,  change:0, candles:seedCandles(2312)  },
});

// ─── Static demo data ─────────────────────────────────────────
const DEMO_SIGNALS = [
  { pair:"BTCUSDT", signal:"STRONG BUY",  rsi:26.1, time:"5m",  tier:"diamond" },
  { pair:"EURUSD",  signal:"BUY",         rsi:28.4, time:"2m",  tier:"gold"    },
  { pair:"GBPUSD",  signal:"HOLD",        rsi:51.2, time:"8m",  tier:"gold"    },
  { pair:"XAUUSD",  signal:"STRONG SELL", rsi:74.8, time:"12m", tier:"diamond" },
  { pair:"USDJPY",  signal:"SELL",        rsi:68.9, time:"15m", tier:"gold"    },
];
const DEMO_BROKERS = [
  { name:"AlphaTrader", winRate:87, trades:412, profit:18420, followers:284, tier:"diamond" },
  { name:"FXMaster",    winRate:79, trades:310, profit:11050, followers:198, tier:"diamond" },
  { name:"CryptoKing",  winRate:72, trades:218, profit:7890,  followers:143, tier:"gold"    },
];
const DEMO_LEADERS = [
  { rank:1, name:"alpha_wolf",  profit:12840, winRate:91, badge:"🥇", tier:"diamond" },
  { rank:2, name:"fx_empress",  profit:9310,  winRate:84, badge:"🥈", tier:"diamond" },
  { rank:3, name:"scalper_pro", profit:7620,  winRate:79, badge:"🥉", tier:"diamond" },
  { rank:4, name:"trader_nova", profit:5200,  winRate:73, badge:"4",  tier:"gold"    },
  { rank:5, name:"btc_hunter",  profit:4100,  winRate:68, badge:"5",  tier:"gold"    },
  { rank:6, name:"YOU",         profit:1120,  winRate:62, badge:"6",  tier:"gold", isMe:true },
];
const DEMO_TRADES = [
  { id:1, type:"BUY",  pair:"EURUSD",  entry:1.0820, exit:1.0854, profit:34,  date:"Apr 16" },
  { id:2, type:"SELL", pair:"GBPUSD",  entry:1.2750, exit:1.2710, profit:40,  date:"Apr 15" },
  { id:3, type:"BUY",  pair:"BTCUSDT", entry:63100,  exit:62800,  profit:-30, date:"Apr 14" },
  { id:4, type:"SELL", pair:"XAUUSD",  entry:2318,   exit:2295,   profit:23,  date:"Apr 13" },
  { id:5, type:"BUY",  pair:"USDJPY",  entry:154.10, exit:154.55, profit:45,  date:"Apr 12" },
];
const DEMO_TXS = [
  { type:"deposit",  amount:500,  status:"completed", date:"Apr 15", method:"Stripe"   },
  { type:"withdraw", amount:200,  status:"approved",  date:"Apr 14", method:"Bank"     },
  { type:"deposit",  amount:1000, status:"completed", date:"Apr 12", method:"Paystack" },
  { type:"withdraw", amount:150,  status:"pending",   date:"Apr 11", method:"Crypto"   },
];
const DEMO_USERS = [
  { id:1, username:"trader_alex", email:"alex@email.com",  tier:"diamond", balance:4200 },
  { id:2, username:"fx_queen",    email:"queen@email.com", tier:"gold",    balance:1800 },
  { id:3, username:"crypto_bull", email:"bull@email.com",  tier:"diamond", balance:9100 },
  { id:4, username:"free_trader", email:"free@email.com",  tier:"free",    balance:0    },
  { id:5, username:"scalper_99",  email:"scalp@email.com", tier:"gold",    balance:3300 },
];
const DEMO_WITHDRAWALS = [
  { id:1, user:"trader_alex", amount:500,  method:"Bank",   status:"pending"  },
  { id:2, user:"fx_queen",    amount:200,  method:"Crypto", status:"pending"  },
  { id:3, user:"scalper_99",  amount:1000, method:"Bank",   status:"approved" },
];
const DEMO_NOTIFS = [
  { id:1, cat:"trading",  title:"Strong Buy Signal", desc:"BTCUSDT RSI at 26 — strong momentum", time:"2m ago",  read:false },
  { id:2, cat:"trading",  title:"Trade Closed",      desc:"EURUSD closed +$34 profit",           time:"15m ago", read:false },
  { id:3, cat:"account",  title:"Trial Expiring",    desc:"Your Diamond trial expires in 5 days", time:"1h ago",  read:false },
  { id:4, cat:"payments", title:"Referral Reward",   desc:"Your referral signed up — +$10",       time:"3h ago",  read:true  },
  { id:5, cat:"system",   title:"Promotion",         desc:"Upgrade to Annual and save 40%",       time:"1d ago",  read:true  },
];

// ─── Atoms ────────────────────────────────────────────────────
function SigBadge({ signal }) {
  const M = {
    "STRONG BUY": [C.green,"#00e67618"], "BUY":["#56e094","#56e09412"],
    "HOLD":["#ffcc44","#ffcc4412"],      "SELL":["#ff7070","#ff707012"],
    "STRONG SELL":[C.red,"#ff3d5a18"],
  };
  const [color,bg] = M[signal]||M.HOLD;
  return <span style={{background:bg,color,border:`1px solid ${color}66`,borderRadius:5,padding:"3px 10px",fontSize:11,fontWeight:800,letterSpacing:.5}}>{signal}</span>;
}

function TierBadge({ tier }) {
  const M = { free:[C.muted2,"FREE"], gold:[C.gold,"GOLD"], diamond:[C.diamond,"DIAMOND"] };
  const [color,label] = M[tier]||M.free;
  return <span style={{color,fontSize:10,fontWeight:800,background:color+"18",border:`1px solid ${color}44`,borderRadius:4,padding:"3px 9px"}}>{label}</span>;
}

function RSIBar({ value }) {
  const pct = Math.min(Math.max(value,0),100);
  const color = pct<30?C.green:pct>70?C.red:C.gold;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <div style={{flex:1,height:4,background:C.border2,borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2}}/>
      </div>
      <span style={{color,fontSize:11,fontFamily:"monospace",width:34,textAlign:"right"}}>{value.toFixed(1)}</span>
    </div>
  );
}

// ─── Button system ────────────────────────────────────────────
function BtnPrimary({ children, onClick, disabled, style, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:C.accent, color:"#000", border:"none",
      borderRadius:10, padding:"12px 20px", cursor:disabled?"not-allowed":"pointer",
      fontSize:13, fontWeight:800, letterSpacing:.5,
      opacity:disabled?0.5:1, transition:"all .18s",
      width:full?"100%":undefined, ...style,
    }}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.opacity=".85";}}
      onMouseLeave={e=>{e.currentTarget.style.opacity="1";}}
    >{children}</button>
  );
}
function BtnSecondary({ children, onClick, color=C.accent, disabled, style, full }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background:`${color}18`, color, border:`1.5px solid ${color}55`,
      borderRadius:10, padding:"11px 20px", cursor:disabled?"not-allowed":"pointer",
      fontSize:13, fontWeight:700, opacity:disabled?0.5:1, transition:"all .18s",
      width:full?"100%":undefined, ...style,
    }}
      onMouseEnter={e=>{if(!disabled){e.currentTarget.style.background=`${color}28`;e.currentTarget.style.borderColor=color;}}}
      onMouseLeave={e=>{e.currentTarget.style.background=`${color}18`;e.currentTarget.style.borderColor=`${color}55`;}}
    >{children}</button>
  );
}
function BtnDanger({ children, onClick, style, full }) {
  return (
    <button onClick={onClick} style={{
      background:C.red+"18", color:C.red, border:`1.5px solid ${C.red}55`,
      borderRadius:10, padding:"11px 20px", cursor:"pointer",
      fontSize:13, fontWeight:700, transition:"all .18s",
      width:full?"100%":undefined, ...style,
    }}
      onMouseEnter={e=>{e.currentTarget.style.background=C.red+"28";e.currentTarget.style.borderColor=C.red;}}
      onMouseLeave={e=>{e.currentTarget.style.background=C.red+"18";e.currentTarget.style.borderColor=C.red+"55";}}
    >{children}</button>
  );
}
function BtnIcon({ children, onClick, badge, style }) {
  return (
    <button onClick={onClick} style={{
      background:"none", border:"none", color:C.muted2, cursor:"pointer",
      position:"relative", padding:8, borderRadius:8, fontSize:18, lineHeight:1,
      display:"flex",alignItems:"center",justifyContent:"center",
      transition:"color .15s", minWidth:40, minHeight:40, ...style,
    }}
      onMouseEnter={e=>{e.currentTarget.style.color=C.bright;e.currentTarget.style.background=C.border2;}}
      onMouseLeave={e=>{e.currentTarget.style.color=C.muted2;e.currentTarget.style.background="none";}}
    >
      {children}
      {badge>0&&<span style={{position:"absolute",top:4,right:4,background:C.red,color:"#fff",borderRadius:"50%",width:16,height:16,fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{badge>9?"9+":badge}</span>}
    </button>
  );
}
function Inp({ value, onChange, placeholder, type="text", style }) {
  return (
    <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} type={type}
      style={{background:"#040c16",border:`1.5px solid ${C.border2}`,borderRadius:10,color:C.bright,
        padding:"12px 14px",fontSize:13,outline:"none",width:"100%",
        boxSizing:"border-box",transition:"border-color .2s",...style}}
      onFocus={e=>e.target.style.borderColor=C.accent}
      onBlur={e=>e.target.style.borderColor=C.border2}
    />
  );
}

// ─── Card ─────────────────────────────────────────────────────
function Card({ children, style, glow, onClick }) {
  return (
    <div onClick={onClick} style={{
      background:C.panel, borderRadius:14, padding:16,
      border:`1px solid ${glow?glow+"44":C.border2}`,
      boxShadow:glow?`0 0 24px ${glow}12`:"none",
      cursor:onClick?"pointer":undefined, transition:"all .2s", ...style,
    }}>{children}</div>
  );
}
function SectionTitle({ children }) {
  return <div style={{fontSize:18,fontWeight:800,color:C.bright,marginBottom:16,letterSpacing:.3}}>{children}</div>;
}
function FieldLabel({ children }) {
  return <div style={{fontSize:11,color:C.muted2,marginBottom:6,fontWeight:600,letterSpacing:.5}}>{children}</div>;
}

// ─── Candle chart ─────────────────────────────────────────────
function CandleChart({ candles, h=180 }) {
  if (!candles||candles.length<2) return <div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted2}}>Loading…</div>;
  const W=600, pad=6;
  const vals=candles.flatMap(c=>[c.high,c.low]);
  const mn=Math.min(...vals), mx=Math.max(...vals), rng=mx-mn||mn*0.01;
  const toY=v=>pad+((mx-v)/rng)*(h-pad*2);
  const cw=(W-pad*2)/candles.length;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{width:"100%",height:h}}>
      {candles.map((c,i)=>{
        const bull=c.close>=c.open, col=bull?C.green:C.red;
        const cx=pad+i*cw+cw/2, bt=toY(Math.max(c.open,c.close)), bh=Math.max(toY(Math.min(c.open,c.close))-bt,1);
        return <g key={i}><line x1={cx} y1={toY(c.high)} x2={cx} y2={toY(c.low)} stroke={col} strokeWidth=".8" opacity=".5"/><rect x={pad+i*cw+cw*.14} y={bt} width={cw*.72} height={bh} fill={col} opacity=".85" rx=".5"/></g>;
      })}
    </svg>
  );
}

// ─── Market row ───────────────────────────────────────────────
function MarketRow({ pair, pairData, onClick, compact }) {
  const meta = PAIR_META[pair];
  const data = pairData[pair];
  const up   = data.change>=0;
  return (
    <div onClick={()=>onClick&&onClick(pair)} style={{
      display:"flex", alignItems:"center", gap:12, padding:compact?"10px 14px":"14px 16px",
      borderRadius:10, cursor:onClick?"pointer":"default",
      transition:"background .15s",
    }}
      onMouseEnter={e=>{if(onClick)e.currentTarget.style.background=C.border;}}
      onMouseLeave={e=>{e.currentTarget.style.background="none";}}
    >
      <div style={{fontSize:compact?20:24,width:compact?32:40,textAlign:"center"}}>{meta.icon}</div>
      <div style={{flex:1}}>
        <div style={{fontSize:compact?13:14,fontWeight:700,color:C.bright}}>{meta.label}</div>
        <div style={{fontSize:11,color:C.muted2,marginTop:1}}>{meta.cat.toUpperCase()}</div>
      </div>
      <div style={{textAlign:"right"}}>
        <div style={{fontSize:compact?13:14,fontWeight:800,color:C.bright,fontFamily:"monospace"}}>{formatPrice(pair,data.price)}</div>
        <div style={{fontSize:11,color:up?C.green:C.red,fontWeight:700,marginTop:1}}>{up?"+":""}{data.change.toFixed(3)}%</div>
      </div>
    </div>
  );
}

// ─── Toast stack ──────────────────────────────────────────────
function Toasts({ list }) {
  return (
    <div style={{position:"fixed",bottom:76,right:16,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
      {list.map(t=>{
        const color=t.type==="error"?C.red:t.type==="warn"?C.gold:C.green;
        return <div key={t.id} style={{background:C.panel2,border:`1px solid ${color}55`,color,padding:"12px 18px",borderRadius:12,fontSize:12,fontWeight:700,boxShadow:`0 4px 24px ${color}14`,animation:"toastIn .25s ease",display:"flex",alignItems:"center",gap:8,minWidth:240,maxWidth:320}}>
          <span>{t.type==="error"?"✗":t.type==="warn"?"⚠":"✓"}</span>
          <span style={{color:C.text,fontWeight:500,flex:1}}>{t.msg}</span>
        </div>;
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PAGES
// ═══════════════════════════════════════════════════════════════

// ── HOME (Dashboard) ──────────────────────────────────────────
function PageHome({ pairData, setPage, trades, userTier, setPayModal, selectedPair, setSelectedPair, notifs, balance, onTrial, trialDays }) {
  const totalPnL = trades.reduce((a,t)=>a+(t.profit||0),0);
  const winRate  = trades.length?((trades.filter(t=>(t.profit||0)>0).length/trades.length)*100).toFixed(0):0;
  const btc      = pairData.BTCUSDT;
  const unread   = notifs.filter(n=>!n.read).length;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>

      {/* Trial banner — compact */}
      {onTrial&&<div style={{background:`linear-gradient(135deg,${C.diamond}18,${C.gold}10)`,border:`1px solid ${C.diamond}44`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:C.diamond}}>⏳ Diamond Trial — {trialDays} days left</div>
          <div style={{fontSize:11,color:C.muted2,marginTop:2}}>Unlock all features permanently</div>
        </div>
        <BtnSecondary onClick={()=>setPayModal("diamond")} color={C.diamond} style={{padding:"7px 14px",fontSize:12,whiteSpace:"nowrap"}}>View Plan</BtnSecondary>
      </div>}

      {/* Portfolio card */}
      <Card glow={C.accent} style={{background:`linear-gradient(135deg,#080f1a,#0d1825)`,padding:22}}>
        <FieldLabel>Portfolio Balance</FieldLabel>
        <div style={{fontSize:36,fontWeight:900,color:C.bright,letterSpacing:-1,marginBottom:4}}>${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
        <div style={{display:"flex",gap:24}}>
          <div>
            <FieldLabel>Today's P&L</FieldLabel>
            <div style={{fontSize:16,fontWeight:800,color:totalPnL>=0?C.green:C.red}}>{totalPnL>=0?"+":""}{totalPnL.toFixed(2)}</div>
          </div>
          <div>
            <FieldLabel>Win Rate</FieldLabel>
            <div style={{fontSize:16,fontWeight:800,color:C.gold}}>{winRate}%</div>
          </div>
          <div>
            <FieldLabel>Open Trades</FieldLabel>
            <div style={{fontSize:16,fontWeight:800,color:C.accent}}>{trades.filter(t=>t.profit===null).length}</div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div>
        <SectionTitle>Quick Actions</SectionTitle>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {[
            {icon:"📈",label:"Trade",   page:"trade",  color:C.green},
            {icon:"🤖",label:"AI",      page:"ai",     color:C.diamond},
            {icon:"💰",label:"Deposit", page:"wallet", color:C.gold},
            {icon:"📊",label:"Markets", page:"markets",color:C.accent},
          ].map(a=>(
            <button key={a.label} onClick={()=>setPage(a.page)} style={{
              background:a.color+"15",border:`1px solid ${a.color}33`,
              borderRadius:12,padding:"14px 8px",cursor:"pointer",textAlign:"center",
              transition:"all .2s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.background=a.color+"28";e.currentTarget.style.borderColor=a.color+"66";}}
              onMouseLeave={e=>{e.currentTarget.style.background=a.color+"15";e.currentTarget.style.borderColor=a.color+"33";}}
            >
              <div style={{fontSize:22,marginBottom:6}}>{a.icon}</div>
              <div style={{fontSize:11,color:a.color,fontWeight:700}}>{a.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Market overview */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <SectionTitle>Market Overview</SectionTitle>
          <button onClick={()=>setPage("markets")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:600}}>See all →</button>
        </div>
        <Card style={{padding:4}}>
          {PAIRS.map((pair,i)=>(
            <div key={pair} style={{borderBottom:i<PAIRS.length-1?`1px solid ${C.border}`:"none"}}>
              <MarketRow pair={pair} pairData={pairData} onClick={p=>{setSelectedPair(p);setPage("trade");}} compact/>
            </div>
          ))}
        </Card>
      </div>

      {/* Recent signals */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <SectionTitle>Recent Signals</SectionTitle>
          <button onClick={()=>setPage("signals")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:600}}>See all →</button>
        </div>
        {userTier==="free"
          ? <Card style={{textAlign:"center",padding:28}}>
              <div style={{fontSize:28,marginBottom:8}}>🔒</div>
              <div style={{color:C.bright,fontWeight:700,marginBottom:6}}>Signals Locked</div>
              <div style={{color:C.muted2,fontSize:12,marginBottom:16}}>Gold plan includes live trading signals</div>
              <BtnSecondary onClick={()=>setPayModal("gold")} color={C.gold}>Unlock Signals</BtnSecondary>
            </Card>
          : <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {DEMO_SIGNALS.slice(0,3).map((s,i)=>(
                <Card key={i} style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:12}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:C.bright}}>{PAIR_META[s.pair]?.label}</div>
                    <RSIBar value={s.rsi}/>
                  </div>
                  <div style={{textAlign:"right",display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <SigBadge signal={s.signal}/>
                    <span style={{fontSize:10,color:C.muted2}}>{s.time} ago</span>
                  </div>
                </Card>
              ))}
            </div>
        }
      </div>

      {/* Recent trades */}
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <SectionTitle>Recent Trades</SectionTitle>
          <button onClick={()=>setPage("history")} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:13,fontWeight:600}}>History →</button>
        </div>
        <Card style={{padding:4}}>
          {trades.slice(0,3).map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
              <div style={{width:32,height:32,borderRadius:8,background:t.type==="BUY"?C.green+"18":C.red+"18",border:`1px solid ${t.type==="BUY"?C.green:C.red}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:t.type==="BUY"?C.green:C.red,fontWeight:900}}>{t.type==="BUY"?"▲":"▼"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.bright}}>{PAIR_META[t.pair]?.label||t.pair}</div>
                <div style={{fontSize:11,color:C.muted2}}>{t.type} · {t.date}</div>
              </div>
              <div style={{color:t.profit>=0?C.green:C.red,fontWeight:800,fontSize:15}}>{t.profit>=0?"+":""}${t.profit?.toFixed(2)}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── MARKETS ───────────────────────────────────────────────────
function PageMarkets({ pairData, setPage, setSelectedPair }) {
  const [filter,setFilter] = useState("all");
  const cats = ["all","crypto","forex","metals"];
  const filtered = PAIRS.filter(p=>filter==="all"||PAIR_META[p].cat===filter);

  return (
    <div>
      <SectionTitle>Markets</SectionTitle>

      {/* Category filter */}
      <div style={{display:"flex",gap:8,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setFilter(c)} style={{
            background:filter===c?C.accent+"20":"none",
            border:`1.5px solid ${filter===c?C.accent:C.border2}`,
            color:filter===c?C.accent:C.muted2,
            borderRadius:20,padding:"7px 18px",cursor:"pointer",
            fontSize:12,fontWeight:700,whiteSpace:"nowrap",transition:"all .2s",
          }}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>
        ))}
      </div>

      <Card style={{padding:4}}>
        {filtered.map((pair,i)=>(
          <div key={pair} style={{borderBottom:i<filtered.length-1?`1px solid ${C.border}`:"none"}}>
            <MarketRow pair={pair} pairData={pairData} onClick={p=>{setSelectedPair(p);setPage("trade");}}/>
          </div>
        ))}
      </Card>

      {/* Leaderboard */}
      <div style={{marginTop:24}}>
        <SectionTitle>🏆 Top Traders</SectionTitle>
        <Card style={{padding:4}}>
          {DEMO_LEADERS.map((e,i)=>(
            <div key={e.rank} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderBottom:i<DEMO_LEADERS.length-1?`1px solid ${C.border}`:"none",background:e.isMe?C.accent+"0a":"none",borderRadius:e.isMe?10:0}}>
              <div style={{width:30,textAlign:"center",fontSize:i<3?18:13,fontWeight:900,color:i===0?C.gold:i===1?"#aaa":i===2?C.orange:C.muted2}}>{e.badge}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:e.isMe?C.accent:C.bright}}>{e.name}{e.isMe?" (You)":""}</div>
                <TierBadge tier={e.tier}/>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:C.green,fontWeight:800,fontSize:14}}>+${e.profit.toLocaleString()}</div>
                <div style={{fontSize:11,color:C.gold}}>{e.winRate}% win</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ── TRADE ─────────────────────────────────────────────────────
function PageTrade({ pairData, selectedPair, setSelectedPair, userTier, setPayModal, trades, setTrades, balance, notify, serverOnline }) {
  const [dir,setDir]         = useState("BUY");
  const [amount,setAmount]   = useState("100");
  const [sl,setSl]           = useState("");
  const [tp,setTp]           = useState("");
  const [loading,setLoading] = useState(false);
  const data = pairData[selectedPair];
  const meta = PAIR_META[selectedPair];
  const up   = data.change >= 0;

  const autoFill = () => {
    const p = data.price;
    setSl(formatPrice(selectedPair, dir==="BUY" ? p*0.98 : p*1.02));
    setTp(formatPrice(selectedPair, dir==="BUY" ? p*1.04 : p*0.96));
  };

  const executeTrade = async () => {
    if (userTier !== "diamond") { notify("Diamond plan required for auto-trading","error"); setPayModal("diamond"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { notify("Enter valid amount","error"); return; }
    if (amt > balance)    { notify("Insufficient funds","error"); return; }
    setLoading(true);
    try {
      if (serverOnline) {
        const { trade } = await API.openTrade({
          pair: selectedPair, direction: dir,
          entry: data.price, amount: amt,
          stopLoss:   parseFloat(sl)  || data.price * (dir==="BUY" ? 0.98 : 1.02),
          takeProfit: parseFloat(tp)  || data.price * (dir==="BUY" ? 1.04 : 0.96),
        });
        setTrades(t => [{ id:trade._id, type:dir, pair:selectedPair, entry:data.price, exit:null, profit:null, date:"Now" }, ...t]);
      } else {
        setTrades(t => [{ id:Date.now(), type:dir, pair:selectedPair, entry:data.price, exit:null, profit:null, date:"Now" }, ...t]);
      }
      const risk = (amt * 0.02).toFixed(2);
      notify(`${dir} ${meta.label} · $${risk} risk · SL/TP set`);
    } catch (err) {
      notify(err.message || "Trade failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Asset selector */}
      <div>
        <FieldLabel>Select Asset</FieldLabel>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {PAIRS.map(pair=>{
            const m=PAIR_META[pair];
            const active=pair===selectedPair;
            const col=CAT_COLOR[m.cat]||C.accent;
            return (
              <button key={pair} onClick={()=>setSelectedPair(pair)} style={{
                background:active?`${col}22`:C.panel2,border:`1.5px solid ${active?col:C.border2}`,
                borderRadius:10,padding:"10px 14px",cursor:"pointer",
                flexShrink:0,minWidth:90,textAlign:"center",transition:"all .18s",
              }}>
                <div style={{fontSize:16,marginBottom:4}}>{m.icon}</div>
                <div style={{fontSize:10,fontWeight:700,color:active?col:C.muted2}}>{m.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Price card */}
      <Card glow={up?C.green:C.red} style={{padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <FieldLabel>{meta.label}</FieldLabel>
            <div style={{fontSize:32,fontWeight:900,color:C.bright,fontFamily:"monospace",letterSpacing:-1}}>{formatPrice(selectedPair,data.price)}</div>
            <div style={{color:up?C.green:C.red,fontSize:13,fontWeight:700,marginTop:4}}>{up?"▲ +":"▼ "}{Math.abs(data.change).toFixed(3)}%</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,textAlign:"right"}}>
            {[["HIGH",formatPrice(selectedPair,data.price*1.002),C.green],["LOW",formatPrice(selectedPair,data.price*0.998),C.red]].map(([l,v,col])=>(
              <div key={l}><div style={{fontSize:10,color:C.muted2}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:col,fontFamily:"monospace"}}>{v}</div></div>
            ))}
          </div>
        </div>
        <div style={{marginTop:12}}><CandleChart candles={data.candles} h={150}/></div>
      </Card>

      {/* Timeframe */}
      <div style={{display:"flex",gap:6}}>
        {["1m","5m","15m","1h","4h","1d"].map(tf=>(
          <button key={tf} style={{background:tf==="1m"?C.accent+"20":C.panel2,border:`1px solid ${tf==="1m"?C.accent:C.border2}`,color:tf==="1m"?C.accent:C.muted2,borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:12,fontWeight:600,flex:1,minWidth:36}}>{tf}</button>
        ))}
      </div>

      {/* Direction */}
      <div>
        <FieldLabel>Direction</FieldLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={()=>setDir("BUY")} style={{background:dir==="BUY"?C.green+"22":C.panel2,border:`2px solid ${dir==="BUY"?C.green:C.border2}`,borderRadius:10,padding:"14px",cursor:"pointer",color:dir==="BUY"?C.green:C.muted2,fontSize:15,fontWeight:800,transition:"all .2s"}}>▲ BUY</button>
          <button onClick={()=>setDir("SELL")} style={{background:dir==="SELL"?C.red+"22":C.panel2,border:`2px solid ${dir==="SELL"?C.red:C.border2}`,borderRadius:10,padding:"14px",cursor:"pointer",color:dir==="SELL"?C.red:C.muted2,fontSize:15,fontWeight:800,transition:"all .2s"}}>▼ SELL</button>
        </div>
      </div>

      {/* Order settings */}
      <div>
        <FieldLabel>Position Size (USD)</FieldLabel>
        <Inp value={amount} onChange={setAmount} placeholder="e.g. 100" type="number"/>
        <div style={{display:"flex",gap:6,marginTop:6}}>
          {["50","100","500","1000"].map(a=><button key={a} onClick={()=>setAmount(a)} style={{flex:1,background:C.border,border:`1px solid ${C.border2}`,color:C.muted2,borderRadius:8,padding:"7px",cursor:"pointer",fontSize:11,fontWeight:600}}>${a}</button>)}
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div>
          <FieldLabel>Stop Loss</FieldLabel>
          <Inp value={sl} onChange={setSl} placeholder="Price"/>
        </div>
        <div>
          <FieldLabel>Take Profit</FieldLabel>
          <Inp value={tp} onChange={setTp} placeholder="Price"/>
        </div>
      </div>
      <button onClick={autoFill} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,textAlign:"left",padding:0}}>↺ Auto-fill SL/TP (2% / 4%)</button>

      {/* Risk info */}
      {amount&&<div style={{background:C.border,borderRadius:10,padding:"12px 14px",display:"flex",gap:20}}>
        {[["Risk",`$${(parseFloat(amount||0)*0.02).toFixed(2)}`],["Potential",`$${(parseFloat(amount||0)*0.04).toFixed(2)}`],["R:R","1:2"]].map(([l,v])=>(
          <div key={l}><div style={{fontSize:10,color:C.muted2}}>{l}</div><div style={{fontSize:13,fontWeight:700,color:C.bright}}>{v}</div></div>
        ))}
      </div>}

      {/* Execute */}
      {dir==="BUY"
        ?<BtnPrimary onClick={executeTrade} disabled={loading} full style={{background:C.green,fontSize:15,padding:15}}>{loading?"Placing Order…":`▲ BUY ${meta.label}`}</BtnPrimary>
        :<BtnDanger onClick={executeTrade} full style={{fontSize:15,padding:15,background:C.red,color:"#fff",border:"none"}}>{loading?"Placing Order…":`▼ SELL ${meta.label}`}</BtnDanger>
      }
      {userTier!=="diamond"&&<div style={{fontSize:12,color:C.muted2,textAlign:"center"}}>Auto-trading requires Diamond. <span onClick={()=>setPayModal("diamond")} style={{color:C.diamond,cursor:"pointer"}}>Upgrade →</span></div>}
    </div>
  );
}

// ── WALLET ────────────────────────────────────────────────────
function PageWallet({ balance, transactions, notify, withdrawals, setWithdrawals, isAdmin, handleDeposit, handleWithdraw, handleAdminWithdrawal }) {
  const [depositAmt,setDepositAmt]         = useState("");
  const [withdrawAmt,setWithdrawAmt]       = useState("");
  const [withdrawMethod,setWithdrawMethod] = useState("bank");
  const [bankAcc,setBankAcc]               = useState("");
  const [activeSection,setActiveSection]   = useState("overview");

  const doDeposit = async (method) => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0) { notify("Enter a valid amount","error"); return; }
    await handleDeposit({ amount: amt, method });
    setDepositAmt("");
  };
  const doWithdraw = async () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0) { notify("Enter a valid amount","error"); return; }
    await handleWithdraw({ amount: amt, method: withdrawMethod === "bank" ? "Bank" : "Crypto", accountDetails: bankAcc });
    setWithdrawAmt(""); setBankAcc("");
  };

  const statusColor = s=>s==="completed"||s==="approved"?C.green:s==="pending"?C.gold:C.red;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Balance card */}
      <Card glow={C.accent} style={{background:`linear-gradient(135deg,#080f1a,#0d1825)`,padding:24,textAlign:"center"}}>
        <FieldLabel>Available Balance</FieldLabel>
        <div style={{fontSize:40,fontWeight:900,color:C.bright,letterSpacing:-1,margin:"8px 0"}}>${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          {[["💰","Deposit","deposit"],["💸","Withdraw","withdraw"],["📋","History","history"]].map(([icon,label,sec])=>(
            <button key={sec} onClick={()=>setActiveSection(sec)} style={{
              background:activeSection===sec?C.accent+"22":C.border,
              border:`1px solid ${activeSection===sec?C.accent:C.border2}`,
              color:activeSection===sec?C.accent:C.muted2,
              borderRadius:10,padding:"10px 16px",cursor:"pointer",
              fontSize:12,fontWeight:600,transition:"all .2s",
            }}>{icon} {label}</button>
          ))}
        </div>
      </Card>

      {/* Deposit */}
      {activeSection==="deposit"&&<Card>
        <SectionTitle>Deposit Funds</SectionTitle>
        <FieldLabel>Amount (USD)</FieldLabel>
        <Inp value={depositAmt} onChange={setDepositAmt} placeholder="Enter amount" type="number"/>
        <div style={{display:"flex",gap:6,margin:"10px 0"}}>
          {[100,500,1000,5000].map(a=><button key={a} onClick={()=>setDepositAmt(a.toString())} style={{flex:1,background:C.border,border:`1px solid ${C.border2}`,color:C.muted2,borderRadius:8,padding:"8px 4px",cursor:"pointer",fontSize:11,fontWeight:600}}>${a}</button>)}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:8}}>
          <BtnPrimary onClick={()=>doDeposit("Stripe")} full style={{background:C.accent,color:"#000"}}>💳 Pay with Stripe</BtnPrimary>
          <BtnSecondary onClick={()=>doDeposit("Paystack")} color={C.gold} full>🏦 Pay with Paystack</BtnSecondary>
          <BtnSecondary onClick={()=>doDeposit("PayPal")} color={C.accent} full>🅿️ Pay with PayPal</BtnSecondary>
        </div>
      </Card>}

      {/* Withdraw */}
      {activeSection==="withdraw"&&<Card>
        <SectionTitle>Withdraw Funds</SectionTitle>
        <FieldLabel>Amount (USD)</FieldLabel>
        <Inp value={withdrawAmt} onChange={setWithdrawAmt} placeholder="Enter amount" type="number"/>
        <div style={{display:"flex",gap:8,margin:"12px 0"}}>
          {[["bank","🏦 Bank Transfer"],["crypto","₿ Crypto"]].map(([k,l])=>(
            <button key={k} onClick={()=>setWithdrawMethod(k)} style={{flex:1,background:withdrawMethod===k?C.accent+"18":C.border,border:`1.5px solid ${withdrawMethod===k?C.accent:C.border2}`,color:withdrawMethod===k?C.accent:C.muted2,borderRadius:10,padding:"10px",cursor:"pointer",fontSize:12,fontWeight:600}}>{l}</button>
          ))}
        </div>
        {withdrawMethod==="bank"&&<><FieldLabel>Account Number</FieldLabel><Inp value={bankAcc} onChange={setBankAcc} placeholder="Account number"/><div style={{fontSize:11,color:C.muted2,marginTop:6}}>Supported: GTBank · Access · UBA · First Bank · Zenith</div></>}
        {withdrawMethod==="crypto"&&<Inp value={bankAcc} onChange={setBankAcc} placeholder="BTC / ETH / USDT wallet address"/>}
        <BtnDanger onClick={doWithdraw} full style={{marginTop:14}}>Withdraw Funds</BtnDanger>
        <div style={{fontSize:11,color:C.muted2,marginTop:8,textAlign:"center"}}>Withdrawals are reviewed by admin before processing</div>
      </Card>}

      {/* Admin withdrawals */}
      {isAdmin&&activeSection!=="deposit"&&activeSection!=="withdraw"&&<Card>
        <SectionTitle>Pending Withdrawals</SectionTitle>
        {withdrawals.map((w,i)=>(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<withdrawals.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.bright}}>{w.user}</div><div style={{fontSize:11,color:C.muted2}}>{w.method}</div></div>
            <div style={{fontWeight:800,fontSize:15,color:C.gold}}>${w.amount.toLocaleString()}</div>
            <span style={{fontSize:11,fontWeight:700,color:statusColor(w.status)}}>{w.status.toUpperCase()}</span>
            {w.status==="pending"&&<div style={{display:"flex",gap:6}}>
              <BtnSecondary onClick={()=>handleAdminWithdrawal(w.id,"approved")} color={C.green} style={{padding:"6px 12px",fontSize:11}}>✓ Approve</BtnSecondary>
              <BtnSecondary onClick={()=>handleAdminWithdrawal(w.id,"rejected")} color={C.red}   style={{padding:"6px 12px",fontSize:11}}>✗ Reject</BtnSecondary>
            </div>}
          </div>
        ))}
      </Card>}

      {/* Transaction history */}
      {(activeSection==="history"||activeSection==="overview")&&<div>
        <SectionTitle>Transaction History</SectionTitle>
        <Card style={{padding:4}}>
          {transactions.map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<transactions.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{width:36,height:36,borderRadius:10,background:t.type==="deposit"?C.green+"18":C.red+"18",border:`1px solid ${t.type==="deposit"?C.green:C.red}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{t.type==="deposit"?"↓":"↑"}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.bright,textTransform:"capitalize"}}>{t.type} · {t.method}</div>
                <div style={{fontSize:11,color:C.muted2}}>{t.date}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,fontWeight:800,color:t.type==="deposit"?C.green:C.red}}>{t.type==="deposit"?"+":"-"}${t.amount.toLocaleString()}</div>
                <div style={{fontSize:10,fontWeight:700,color:statusColor(t.status)}}>{t.status.toUpperCase()}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>}
    </div>
  );
}

// ── NOTIFICATIONS ─────────────────────────────────────────────
function PageNotifications({ notifs, setNotifs }) {
  const [filter,setFilter] = useState("all");
  const cats = ["all","trading","account","payments","system"];
  const catIcon = { all:"🔔", trading:"📈", account:"👤", payments:"💳", system:"⚙️" };
  const filtered = notifs.filter(n=>filter==="all"||n.cat===filter);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <SectionTitle>Notifications</SectionTitle>
        <button onClick={()=>setNotifs(n=>n.map(x=>({...x,read:true})))} style={{background:"none",border:"none",color:C.accent,cursor:"pointer",fontSize:12,fontWeight:600}}>Mark all read</button>
      </div>

      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {cats.map(c=>(
          <button key={c} onClick={()=>setFilter(c)} style={{
            background:filter===c?C.accent+"20":C.panel2,border:`1.5px solid ${filter===c?C.accent:C.border2}`,
            color:filter===c?C.accent:C.muted2,borderRadius:20,padding:"7px 14px",cursor:"pointer",
            fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0,
          }}>{catIcon[c]} {c.charAt(0).toUpperCase()+c.slice(1)}</button>
        ))}
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filtered.length===0&&<Card style={{textAlign:"center",padding:32,color:C.muted2}}>No notifications</Card>}
        {filtered.map((n,i)=>(
          <Card key={n.id} style={{padding:"14px 16px",opacity:n.read?0.55:1,borderLeft:`3px solid ${n.read?C.border:C.accent}`,cursor:"pointer"}} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{fontSize:20,width:32,flexShrink:0,textAlign:"center",marginTop:2}}>{catIcon[n.cat]}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:C.bright,marginBottom:3}}>{n.title}</div>
                <div style={{fontSize:12,color:C.muted2,lineHeight:1.5}}>{n.desc}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:6}}>{n.time}</div>
              </div>
              {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:C.accent,flexShrink:0,marginTop:4}}/>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── SIGNALS ───────────────────────────────────────────────────
function PageSignals({ userTier, setPayModal, pairData, signals }) {
  const signalList = signals || DEMO_SIGNALS;
  return (
    <div>
      <SectionTitle>Trading Signals</SectionTitle>
      {userTier==="free"
        ?<Card style={{textAlign:"center",padding:40}}>
            <div style={{fontSize:40,marginBottom:12}}>🔒</div>
            <div style={{fontSize:16,fontWeight:700,color:C.bright,marginBottom:8}}>Signals Locked</div>
            <div style={{color:C.muted2,fontSize:13,marginBottom:20,lineHeight:1.6}}>Upgrade to Gold or Diamond to receive live trading signals with RSI analysis.</div>
            <BtnSecondary onClick={()=>setPayModal("gold")} color={C.gold}>Unlock with Gold →</BtnSecondary>
          </Card>
        :<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {signalList.map((s,i)=>(
              <Card key={i} glow={s.tier==="diamond"?C.diamond:undefined} style={{padding:"16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <div style={{fontSize:15,fontWeight:800,color:C.bright}}>{PAIR_META[s.pair]?.label}</div>
                    <div style={{fontSize:11,color:C.muted2,marginTop:2}}>{s.time} ago · {s.tier==="diamond"?"Diamond signal":"Gold signal"}</div>
                  </div>
                  {s.tier==="diamond"&&userTier!=="diamond"
                    ?<span style={{color:C.diamond,fontSize:11,cursor:"pointer"}} onClick={()=>setPayModal("diamond")}>◆ Diamond only</span>
                    :<SigBadge signal={s.signal}/>
                  }
                </div>
                <div style={{marginBottom:6}}><FieldLabel>RSI ({s.rsi})</FieldLabel><RSIBar value={s.rsi}/></div>
                <div style={{display:"flex",justifyContent:"space-between",marginTop:10}}>
                  <div><FieldLabel>Current Price</FieldLabel><div style={{fontWeight:700,fontSize:13,fontFamily:"monospace",color:C.bright}}>{formatPrice(s.pair,pairData[s.pair]?.price??0)}</div></div>
                  <div style={{textAlign:"right"}}><FieldLabel>Category</FieldLabel><div style={{color:CAT_COLOR[PAIR_META[s.pair]?.cat]||C.accent,fontWeight:700,fontSize:12,textTransform:"uppercase"}}>{PAIR_META[s.pair]?.cat}</div></div>
                </div>
              </Card>
            ))}
          </div>
      }
    </div>
  );
}

// ── AI ANALYSIS ───────────────────────────────────────────────
function PageAI({ userTier, setPayModal, pairData, selectedPair, setSelectedPair, serverOnline }) {
  const [loading,setLoading] = useState(false);
  const [result,setResult]   = useState(null);
  const data = pairData[selectedPair];
  const meta = PAIR_META[selectedPair];

  const runAnalysis = async () => {
    if (userTier === "free") { setPayModal("diamond"); return; }
    setLoading(true); setResult(null);
    try {
      let res;
      if (serverOnline) {
        res = await API.analyzeAI({ pair: selectedPair });
      } else {
        await new Promise(r => setTimeout(r, 1400));
        const rsi = Math.random() * 100;
        res = {
          signal: rsi<30?"STRONG BUY":rsi<45?"BUY":rsi>70?"STRONG SELL":rsi>58?"SELL":"HOLD",
          rsi: rsi.toFixed(1), trend: rsi<50?"BULLISH":"BEARISH",
          structure: rsi<50?"Higher highs forming":"Lower lows forming",
          confidence: Math.floor(60+Math.random()*35), rr:"1:2",
          positionSize:"2% of capital",
          risks:["Upcoming news event","High volatility session","Counter-trend setup"],
        };
      }
      const p = data.price;
      const isBuy = res.signal?.includes("BUY");
      setResult({
        ...res, pair: selectedPair,
        entry: formatPrice(selectedPair, p),
        tp1:   formatPrice(selectedPair, isBuy ? p*1.02 : p*0.98),
        tp2:   formatPrice(selectedPair, isBuy ? p*1.04 : p*0.96),
        tp3:   formatPrice(selectedPair, isBuy ? p*1.06 : p*0.94),
        sl:    formatPrice(selectedPair, isBuy ? p*0.98 : p*1.02),
        size:  res.positionSize || "2% of capital",
      });
    } catch {
      const rsi = Math.random() * 100;
      const p   = data.price;
      setResult({ pair:selectedPair, signal:"HOLD", rsi:rsi.toFixed(1), trend:"NEUTRAL", structure:"Sideways", confidence:60, rr:"1:2", size:"2% of capital", entry:formatPrice(selectedPair,p), tp1:"—",tp2:"—",tp3:"—",sl:"—", risks:["Analysis unavailable offline"] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>AI Market Analysis</SectionTitle>

      {/* Pair selector */}
      <div>
        <FieldLabel>Select Asset to Analyze</FieldLabel>
        <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:4}}>
          {PAIRS.map(pair=>{
            const m=PAIR_META[pair], active=pair===selectedPair, col=CAT_COLOR[m.cat]||C.accent;
            return <button key={pair} onClick={()=>{setSelectedPair(pair);setResult(null);}} style={{background:active?`${col}22`:C.panel2,border:`1.5px solid ${active?col:C.border2}`,borderRadius:10,padding:"9px 14px",cursor:"pointer",flexShrink:0,color:active?col:C.muted2,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{m.icon} {m.label}</button>;
          })}
        </div>
      </div>

      {/* Chart preview */}
      <Card style={{padding:14}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div><div style={{fontSize:14,fontWeight:700,color:C.bright}}>{meta.label}</div><div style={{fontSize:12,color:data.change>=0?C.green:C.red,marginTop:2}}>{data.change>=0?"+":""}{data.change.toFixed(3)}%</div></div>
          <div style={{fontSize:22,fontWeight:900,color:C.bright,fontFamily:"monospace"}}>{formatPrice(selectedPair,data.price)}</div>
        </div>
        <CandleChart candles={data.candles} h={130}/>
      </Card>

      {/* Run button */}
      {userTier==="free"
        ?<Card style={{textAlign:"center",padding:28}}>
            <div style={{fontSize:32,marginBottom:8}}>🤖</div>
            <div style={{fontSize:14,fontWeight:700,color:C.bright,marginBottom:6}}>AI Analysis — Diamond Feature</div>
            <div style={{color:C.muted2,fontSize:12,marginBottom:18}}>Get deep RSI + SMA analysis with entry zones, take profits, and risk assessment.</div>
            <BtnSecondary onClick={()=>setPayModal("diamond")} color={C.diamond}>Unlock with Diamond →</BtnSecondary>
          </Card>
        :<BtnPrimary onClick={runAnalysis} disabled={loading} full style={{fontSize:15,padding:15,background:loading?C.muted2:C.diamond,color:"#fff"}}>
            {loading?"🤖 Analyzing market…":"🤖 Analyze "+meta.label}
          </BtnPrimary>
      }

      {/* Results */}
      {result&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
        {/* Signal */}
        <Card glow={C.diamond} style={{padding:18}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div><div style={{fontSize:12,color:C.muted2,marginBottom:4}}>SIGNAL</div><SigBadge signal={result.signal}/></div>
            <div style={{textAlign:"right"}}><div style={{fontSize:12,color:C.muted2,marginBottom:4}}>CONFIDENCE</div><div style={{fontSize:22,fontWeight:900,color:result.confidence>75?C.green:result.confidence>60?C.gold:C.red}}>{result.confidence}%</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {[["Market Structure",result.structure],["Trend",result.trend],["RSI",result.rsi],["Risk:Reward",result.rr]].map(([l,v])=>(
              <div key={l} style={{background:C.border,borderRadius:8,padding:"10px 12px"}}>
                <div style={{fontSize:10,color:C.muted2,marginBottom:3}}>{l}</div>
                <div style={{fontSize:13,fontWeight:700,color:C.bright}}>{v}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Levels */}
        <Card style={{padding:18}}>
          <SectionTitle>Price Levels</SectionTitle>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {[["Entry Zone",result.entry,C.accent],["Take Profit 1",result.tp1,C.green],["Take Profit 2",result.tp2,C.green],["Take Profit 3",result.tp3,C.green],["Stop Loss",result.sl,C.red]].map(([l,v,col])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{fontSize:13,color:C.muted2}}>{l}</div>
                <div style={{fontSize:14,fontWeight:800,color:col,fontFamily:"monospace"}}>{v}</div>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0"}}>
              <div style={{fontSize:13,color:C.muted2}}>Position Size</div>
              <div style={{fontSize:13,fontWeight:700,color:C.bright}}>{result.size}</div>
            </div>
          </div>
        </Card>

        {/* Risks */}
        <Card style={{padding:18}}>
          <SectionTitle>Key Risks</SectionTitle>
          {result.risks.map((r,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<result.risks.length-1?`1px solid ${C.border}`:"none"}}>
              <span style={{color:C.red,fontSize:14}}>⚠</span>
              <span style={{fontSize:13,color:C.text}}>{r}</span>
            </div>
          ))}
        </Card>
      </div>}
    </div>
  );
}

// ── HISTORY ───────────────────────────────────────────────────
function PageHistory({ trades }) {
  const totalPnL = trades.reduce((a,t)=>a+(t.profit||0),0);
  const wins     = trades.filter(t=>(t.profit||0)>0).length;
  const winRate  = trades.length?((wins/trades.length)*100).toFixed(0):0;
  const best     = trades.length?Math.max(...trades.map(t=>t.profit||0)):0;

  return (
    <div>
      <SectionTitle>Trade History</SectionTitle>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        {[[totalPnL>=0?C.green:C.red,"Total P&L",`${totalPnL>=0?"+":""}$${totalPnL.toFixed(2)}`],[C.gold,"Win Rate",`${winRate}%`],[C.accent,"Total Trades",trades.length],[C.green,"Best Trade",`+$${best.toFixed(2)}`]].map(([col,lbl,val])=>(
          <Card key={lbl} glow={col} style={{padding:14}}>
            <FieldLabel>{lbl}</FieldLabel>
            <div style={{fontSize:20,fontWeight:900,color:col}}>{val}</div>
          </Card>
        ))}
      </div>

      <Card style={{padding:4}}>
        {trades.map((t,i)=>(
          <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<trades.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{width:36,height:36,borderRadius:10,background:t.type==="BUY"?C.green+"18":C.red+"18",border:`1px solid ${t.type==="BUY"?C.green:C.red}33`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:t.type==="BUY"?C.green:C.red,fontWeight:900}}>{t.type==="BUY"?"▲":"▼"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:C.bright}}>{PAIR_META[t.pair]?.label||t.pair}</div>
              <div style={{fontSize:11,color:C.muted2}}>Entry: {formatPrice(t.pair,t.entry)} · {t.date}</div>
            </div>
            <div style={{textAlign:"right"}}>
              {t.profit!==null
                ?<div style={{fontSize:15,fontWeight:800,color:t.profit>=0?C.green:C.red}}>{t.profit>=0?"+":""}${t.profit.toFixed(2)}</div>
                :<span style={{fontSize:11,color:C.gold,fontWeight:600}}>OPEN</span>
              }
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── COPY TRADING ──────────────────────────────────────────────
function PageCopy({ userTier, setPayModal, notify }) {
  const [copyEnabled,setCopyEnabled] = useState(false);
  const [copyAmount,setCopyAmount]   = useState("50");
  const [copyBroker,setCopyBroker]   = useState("AlphaTrader");

  if(userTier==="free") return (
    <div><SectionTitle>Copy Trading</SectionTitle>
      <Card style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:40,marginBottom:12}}>🤖</div>
        <div style={{fontSize:16,fontWeight:700,color:C.bright,marginBottom:8}}>Copy Trading Locked</div>
        <div style={{color:C.muted2,fontSize:13,marginBottom:20}}>Mirror top traders automatically. Requires Gold or Diamond.</div>
        <BtnSecondary onClick={()=>setPayModal("gold")} color={C.gold}>Unlock with Gold →</BtnSecondary>
      </Card>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <SectionTitle>Copy Trading</SectionTitle>

      {/* Status */}
      <Card glow={copyEnabled?C.green:C.border2} style={{padding:"16px",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:48,height:48,borderRadius:12,background:copyEnabled?C.green+"22":C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{copyEnabled?"🟢":"⚫"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:700,color:C.bright}}>{copyEnabled?"Copy Trading Active":"Copy Trading Off"}</div>
          {copyEnabled&&<div style={{fontSize:12,color:C.green,marginTop:2}}>Copying {copyBroker} · ${copyAmount}/trade · 2% risk</div>}
        </div>
        <button onClick={()=>{const n=!copyEnabled;setCopyEnabled(n);notify(n?`Copying ${copyBroker}`:"Copy trading paused");}} style={{background:copyEnabled?C.red+"18":C.green+"18",border:`1.5px solid ${copyEnabled?C.red:C.green}`,color:copyEnabled?C.red:C.green,borderRadius:10,padding:"10px 18px",cursor:"pointer",fontSize:13,fontWeight:700}}>{copyEnabled?"Stop":"Start"}</button>
      </Card>

      {/* Broker list */}
      <div>
        <SectionTitle>Select Broker</SectionTitle>
        {DEMO_BROKERS.map((b,i)=>(
          <Card key={i} glow={copyBroker===b.name?C.accent:undefined} style={{marginBottom:8,cursor:"pointer",borderLeft:copyBroker===b.name?`3px solid ${C.accent}`:"3px solid transparent"}} onClick={()=>setCopyBroker(b.name)}>
            <div style={{display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:44,height:44,borderRadius:"50%",background:C.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:C.accent}}>{b.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:700,color:C.bright}}>{b.name}</div>
                <div style={{fontSize:11,color:C.muted2,marginTop:2}}>{b.trades} trades · {b.followers} followers</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:C.green,fontWeight:800,fontSize:14}}>+${b.profit.toLocaleString()}</div>
                <div style={{fontSize:11,color:C.gold}}>{b.winRate}% win</div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Settings */}
      <Card>
        <SectionTitle>Copy Settings</SectionTitle>
        <FieldLabel>Amount Per Trade (USD)</FieldLabel>
        <Inp value={copyAmount} onChange={setCopyAmount} placeholder="e.g. 50" type="number"/>
        <div style={{fontSize:11,color:C.muted2,marginTop:8,padding:"10px 12px",background:C.border,borderRadius:8}}>
          ⚙️ Risk management: 2% stop-loss · 4% take-profit applied automatically
        </div>
      </Card>
    </div>
  );
}

// ── REFERRALS ─────────────────────────────────────────────────
function PageReferrals({ notify }) {
  const stats = { clicks:142, signups:28, conversions:9, earned:90 };
  const code  = "NX-AB4K2";
  const link  = `https://nexustrade.io/ref/${code}`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Referrals</SectionTitle>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[[C.accent,"Link Clicks",stats.clicks],[C.gold,"Signups",stats.signups],[C.green,"Conversions",stats.conversions],[C.green,"Total Earned",`$${stats.earned}`]].map(([col,lbl,val])=>(
          <Card key={lbl} glow={col} style={{padding:14}}>
            <FieldLabel>{lbl}</FieldLabel>
            <div style={{fontSize:24,fontWeight:900,color:col}}>{val}</div>
          </Card>
        ))}
      </div>

      {/* Code */}
      <Card glow={C.gold} style={{padding:20}}>
        <FieldLabel>Your Referral Code</FieldLabel>
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
          <div style={{flex:1,background:"#040c16",border:`1.5px solid ${C.border2}`,borderRadius:10,padding:"13px 16px",fontFamily:"monospace",fontSize:18,letterSpacing:3,fontWeight:800,color:C.accent}}>{code}</div>
          <BtnSecondary onClick={()=>notify("Code copied!")} color={C.gold} style={{padding:"13px 18px"}}>Copy</BtnSecondary>
        </div>
        <FieldLabel>Referral Link</FieldLabel>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{flex:1,background:"#040c16",border:`1px solid ${C.border2}`,borderRadius:10,padding:"11px 14px",fontSize:11,color:C.muted2,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{link}</div>
          <BtnSecondary onClick={()=>notify("Link copied!")} color={C.accent} style={{padding:"11px 16px",whiteSpace:"nowrap"}}>Copy</BtnSecondary>
        </div>
        <div style={{display:"flex",gap:8,marginTop:12}}>
          {["Twitter","WhatsApp","Telegram","Email"].map(s=><button key={s} style={{flex:1,background:C.border,border:`1px solid ${C.border2}`,color:C.muted2,borderRadius:8,padding:"8px 4px",cursor:"pointer",fontSize:11,fontWeight:600}}>{s}</button>)}
        </div>
      </Card>

      {/* How it works */}
      <Card style={{padding:18}}>
        <SectionTitle>How It Works</SectionTitle>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {[["1️⃣","Share your link","Post it on social media, WhatsApp, or Telegram"],["2️⃣","Friend signs up","They get a 7-day free Diamond trial"],["3️⃣","Earn $10","Per paid upgrade, credited monthly"]].map(([icon,title,desc])=>(
            <div key={title} style={{display:"flex",gap:14,alignItems:"flex-start",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
              <div><div style={{fontSize:13,fontWeight:700,color:C.bright,marginBottom:3}}>{title}</div><div style={{fontSize:12,color:C.muted2}}>{desc}</div></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── SUBSCRIPTION ──────────────────────────────────────────────
function PageSubscription({ userTier, setUserTier, onTrial, trialDays, setOnTrial, setPayModal, notify }) {
  const PLANS = [
    { tier:"free",    price:0,   period:"forever",  color:C.muted2,
      features:["Basic charts","Live market prices","3 signals per day","No copy trading","No AI analysis"] },
    { tier:"gold",    price:50,  period:"/ month",   color:C.gold,
      features:["Unlimited signals","Copy trading","Email alerts","3 major pairs","Priority support"] },
    { tier:"diamond", price:29,  period:"/ month",   color:C.diamond,
      features:["Everything in Gold","AI technical analysis","Smart auto-trading","All 6 pairs","Crypto + Gold","Leaderboard access","VIP support"] },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Subscription</SectionTitle>

      {/* Current plan */}
      <Card glow={userTier==="diamond"?C.diamond:userTier==="gold"?C.gold:C.muted2} style={{padding:20}}>
        <FieldLabel>Current Plan</FieldLabel>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <TierBadge tier={userTier}/>
            {onTrial&&<div style={{fontSize:12,color:C.diamond,marginTop:6}}>⏳ Trial: {trialDays} days remaining</div>}
            {!onTrial&&userTier!=="free"&&<div style={{fontSize:12,color:C.green,marginTop:6}}>✓ Active · Renews monthly</div>}
          </div>
          {userTier!=="free"&&<button onClick={()=>{setUserTier("free");setOnTrial(false);notify("Subscription cancelled");}} style={{background:"none",border:"none",color:C.muted2,cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Cancel</button>}
        </div>
      </Card>

      {/* Plans */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {PLANS.map(p=>(
          <Card key={p.tier} glow={userTier===p.tier?p.color:p.tier==="diamond"?C.diamond+"44":undefined} style={{padding:18,position:"relative",background:userTier===p.tier?`${p.color}08`:C.panel}}>
            {p.tier==="diamond"&&<div style={{position:"absolute",top:-1,right:16,background:C.diamond,color:"#fff",borderRadius:"0 0 8px 8px",padding:"3px 12px",fontSize:10,fontWeight:800}}>MOST POPULAR</div>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
              <div>
                <TierBadge tier={p.tier}/>
                <div style={{fontSize:26,fontWeight:900,color:p.color,marginTop:8}}>${p.price}<span style={{fontSize:13,color:C.muted2,fontWeight:400}}> {p.period}</span></div>
                {p.tier==="diamond"&&<div style={{fontSize:11,color:C.muted2,marginTop:2}}>or $209/year — save 40%</div>}
                {p.tier==="gold"&&<div style={{fontSize:11,color:C.muted2,marginTop:2}}>or $360/year</div>}
              </div>
              {userTier===p.tier&&<div style={{color:p.color,fontSize:12,fontWeight:700}}>✓ Active</div>}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
              {p.features.map((f,i)=><div key={i} style={{fontSize:12,color:C.muted2,display:"flex",gap:8}}><span style={{color:p.color}}>✓</span>{f}</div>)}
            </div>
            {userTier!==p.tier&&p.tier!=="free"&&(
              <div style={{display:"flex",gap:8}}>
                <BtnSecondary onClick={()=>setPayModal(p.tier)} color={p.color} full>Upgrade Monthly</BtnSecondary>
                <BtnSecondary onClick={()=>setPayModal(p.tier)} color={C.accent} style={{whiteSpace:"nowrap",padding:"11px 14px",fontSize:12}}>Annual 40% off</BtnSecondary>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── PROFILE ───────────────────────────────────────────────────
function PageProfile({ userTier, isAdmin, onTrial, trialDays, setPage, setScreen, setIsAdmin, notify }) {
  const items = [
    { icon:"👤", label:"Account Information",  action:()=>notify("Account settings coming soon") },
    { icon:"🔐", label:"Security",              action:()=>notify("Security settings coming soon") },
    { icon:"🔔", label:"Notification Settings", action:()=>setPage("notifications")               },
    { icon:"💎", label:"Subscription",          action:()=>setPage("subscription")                },
    { icon:"💳", label:"Payment Methods",       action:()=>notify("Payment methods coming soon")  },
    { icon:"🎁", label:"Referrals",             action:()=>setPage("referrals")                   },
    { icon:"❓", label:"Help & Support",        action:()=>notify("Support chat coming soon")      },
  ];

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Profile card */}
      <Card style={{padding:24,textAlign:"center"}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.diamond})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:900,color:"#fff",margin:"0 auto 12px"}}>N</div>
        <div style={{fontSize:18,fontWeight:800,color:C.bright,marginBottom:4}}>Nexus Trader</div>
        <div style={{fontSize:13,color:C.muted2,marginBottom:10}}>trader@nexus.io</div>
        <TierBadge tier={userTier}/>
        {onTrial&&<div style={{fontSize:12,color:C.diamond,marginTop:8}}>⏳ Trial — {trialDays} days left</div>}
        {isAdmin&&<div style={{fontSize:11,color:C.red,marginTop:6,fontWeight:700}}>⚙️ Admin Access</div>}
      </Card>

      {/* Settings list */}
      <Card style={{padding:4}}>
        {items.map((item,i)=>(
          <button key={i} onClick={item.action} style={{
            display:"flex",alignItems:"center",gap:14,padding:"16px 16px",
            background:"none",border:"none",borderBottom:i<items.length-1?`1px solid ${C.border}`:"none",
            width:"100%",textAlign:"left",cursor:"pointer",borderRadius:i===0?"14px 14px 0 0":i===items.length-1?"0 0 14px 14px":0,
            transition:"background .15s",
          }}
            onMouseEnter={e=>{e.currentTarget.style.background=C.border;}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";}}
          >
            <span style={{fontSize:18,width:28,textAlign:"center"}}>{item.icon}</span>
            <span style={{flex:1,fontSize:14,color:C.text,fontWeight:500}}>{item.label}</span>
            <span style={{color:C.muted2,fontSize:16}}>›</span>
          </button>
        ))}
      </Card>

      {/* Logout */}
      <BtnDanger onClick={()=>setScreen("landing")} full>Log Out</BtnDanger>
    </div>
  );
}

// ── ADMIN DASHBOARD ───────────────────────────────────────────
function PageAdmin({ users, handleAdminTier, withdrawals, handleAdminWithdrawal, serverOnline }) {
  const dCount = users.filter(u=>u.tier==="diamond").length;
  const gCount = users.filter(u=>u.tier==="gold").length;
  const rev    = dCount*29 + gCount*50;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <SectionTitle>Admin — Revenue</SectionTitle>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[[C.accent,"Total Users",users.length],[C.diamond,"Diamond",dCount],[C.gold,"Gold",gCount],[C.green,"MRR",`$${rev}`]].map(([col,lbl,val])=>(
          <Card key={lbl} glow={col} style={{padding:14}}><FieldLabel>{lbl}</FieldLabel><div style={{fontSize:22,fontWeight:900,color:col}}>{val}</div></Card>
        ))}
      </div>

      <Card><SectionTitle>Users</SectionTitle>
        {users.map((u,i)=>(
          <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:i<users.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.bright}}>{u.username}</div><div style={{fontSize:11,color:C.muted2}}>{u.email}</div></div>
            <TierBadge tier={u.tier}/>
            <div style={{fontSize:12,fontFamily:"monospace",color:C.muted2,marginLeft:8}}>${u.balance.toLocaleString()}</div>
            {u.tier!=="free"&&<BtnSecondary onClick={()=>handleAdminTier(u.id,"free")} color={C.red} style={{padding:"5px 10px",fontSize:10}}>↓ Free</BtnSecondary>}
          </div>
        ))}
      </Card>

      <Card><SectionTitle>Pending Withdrawals</SectionTitle>
        {withdrawals.map((w,i)=>(
          <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 0",borderBottom:i<withdrawals.length-1?`1px solid ${C.border}`:"none"}}>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.bright}}>{w.user}</div><div style={{fontSize:11,color:C.muted2}}>{w.method}</div></div>
            <div style={{fontWeight:800,color:C.gold}}>${w.amount.toLocaleString()}</div>
            <span style={{fontSize:10,fontWeight:700,color:w.status==="approved"?C.green:w.status==="rejected"?C.red:C.gold,marginLeft:6}}>{w.status.toUpperCase()}</span>
            {w.status==="pending"&&<div style={{display:"flex",gap:4}}>
              <BtnSecondary onClick={()=>handleAdminWithdrawal(w.id,"approved")} color={C.green} style={{padding:"5px 10px",fontSize:11}}>✓ Approve</BtnSecondary>
              <BtnSecondary onClick={()=>handleAdminWithdrawal(w.id,"rejected")} color={C.red}   style={{padding:"5px 10px",fontSize:11}}>✗ Reject</BtnSecondary>
            </div>}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  LANDING
// ═══════════════════════════════════════════════════════════════
function Landing({ onEnter }) {
  const [count,setCount] = useState(1284);
  useEffect(()=>{const iv=setInterval(()=>setCount(n=>n+Math.floor(Math.random()*3)-1),2800);return()=>clearInterval(iv);},[]);
  return (
    <div style={{background:C.bg,color:C.text,fontFamily:"system-ui,sans-serif",minHeight:"100vh"}}>
      <div style={{background:"#020508",borderBottom:`1px solid ${C.border}`,padding:"5px 20px",display:"flex",gap:24,fontSize:11,color:C.muted2,overflowX:"auto",whiteSpace:"nowrap"}}>
        <span>🔥 <b style={{color:C.green}}>{count.toLocaleString()}</b> traders online</span>
        <span>💸 <b style={{color:C.gold}}>$42,391</b> profit today</span>
        <span>⚡ Next signal in <b style={{color:C.accent}}>00:38</b></span>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontSize:20,fontWeight:900,letterSpacing:2,color:C.accent}}>◈ NEXUS</div>
        <div style={{display:"flex",gap:8}}>
          <BtnSecondary onClick={()=>onEnter("login")} color={C.accent} style={{padding:"9px 18px"}}>Login</BtnSecondary>
          <BtnPrimary onClick={()=>onEnter("register")} style={{padding:"9px 18px"}}>Get Started</BtnPrimary>
        </div>
      </div>
      <div style={{textAlign:"center",padding:"60px 24px 40px",background:"radial-gradient(ellipse at 50% 0%,#00d4ff0a 0%,transparent 60%)"}}>
        <div style={{display:"inline-block",background:C.gold+"20",border:`1px solid ${C.gold}44`,color:C.gold,borderRadius:20,padding:"5px 16px",fontSize:11,marginBottom:20}}>🚀 AI-POWERED TRADING PLATFORM</div>
        <h1 style={{fontSize:36,fontWeight:900,lineHeight:1.15,margin:"0 0 14px",color:C.bright}}>Trade Like a Pro<br/><span style={{color:C.accent}}>— Automatically</span></h1>
        <p style={{color:C.muted2,fontSize:14,maxWidth:400,margin:"0 auto 28px",lineHeight:1.7}}>Copy top traders, receive AI signals, and let smart risk management protect your capital.</p>
        <BtnPrimary onClick={()=>onEnter("register")} style={{padding:"14px 32px",fontSize:15,borderRadius:12}}>🎁 Start Free Trial</BtnPrimary>
        <div style={{color:C.muted2,fontSize:11,marginTop:10}}>No card required · 7-day Diamond trial</div>
      </div>
      <div style={{padding:"0 20px 60px"}}>
        <div style={{display:"flex",justifyContent:"center",gap:12,flexWrap:"wrap",marginBottom:32}}>
          {["Copy Trading","AI Signals","2% Risk Management","P&L Dashboard","Stripe + Paystack + PayPal"].map(f=>(
            <div key={f} style={{background:C.panel,border:`1px solid ${C.border2}`,borderRadius:20,padding:"7px 16px",fontSize:12,color:C.muted2}}>✓ {f}</div>
          ))}
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
          {[{tier:"free",price:"$0",sub:"forever",color:C.muted2,f:["Basic charts","3 signals/day"]},{tier:"gold",price:"$50",sub:"/month",color:C.gold,f:["Unlimited signals","Copy trading"]},{tier:"diamond",price:"$29",sub:"/month",color:C.diamond,f:["AI analysis","Auto-trading","All pairs"],popular:true}].map(p=>(
            <div key={p.tier} style={{background:C.panel,border:`1.5px solid ${p.popular?p.color:C.border2}`,borderRadius:16,padding:20,minWidth:160,flex:1,maxWidth:220,position:"relative"}}>
              {p.popular&&<div style={{position:"absolute",top:-1,left:"50%",transform:"translateX(-50%)",background:p.color,color:"#fff",borderRadius:"0 0 8px 8px",padding:"3px 14px",fontSize:10,fontWeight:800,whiteSpace:"nowrap"}}>⭐ POPULAR</div>}
              <TierBadge tier={p.tier}/>
              <div style={{fontSize:24,fontWeight:900,color:p.color,margin:"10px 0 4px"}}>{p.price}<span style={{fontSize:12,color:C.muted2,fontWeight:400}}> {p.sub}</span></div>
              {p.f.map((f,i)=><div key={i} style={{fontSize:12,color:C.muted2,marginTop:6}}><span style={{color:p.color}}>✓</span> {f}</div>)}
              {p.tier!=="free"&&<BtnSecondary onClick={()=>onEnter("register")} color={p.color} full style={{marginTop:14}}>Choose {p.tier.charAt(0).toUpperCase()+p.tier.slice(1)}</BtnSecondary>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════
function Auth({ mode, setMode, onLogin, loading, serverOnline }) {
  const [em,setEm]=useState(""); const [pw,setPw]=useState("");
  const [un,setUn]=useState(""); const [rc,setRc]=useState("");
  return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:28,fontWeight:900,letterSpacing:2,color:C.accent,marginBottom:4}}>◈ NEXUS</div>
          <div style={{color:C.muted2,fontSize:13}}>Professional Trading Platform</div>
          {mode==="register"&&<div style={{marginTop:12,background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:10,padding:"10px 16px",color:C.gold,fontSize:12}}>🎁 7-day Diamond trial · No card needed</div>}
        </div>
        <Card style={{padding:24}}>
          <div style={{display:"flex",background:C.border,borderRadius:10,padding:3,marginBottom:22}}>
            {["login","register"].map(m=>(
              <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px 0",background:mode===m?C.accent:"none",border:"none",color:mode===m?"#000":C.muted2,borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,transition:"all .2s",textTransform:"capitalize"}}>{m==="login"?"Sign In":"Sign Up"}</button>
            ))}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {mode==="register"&&<Inp value={un} onChange={setUn} placeholder="Username"/>}
            <Inp value={em} onChange={setEm} placeholder="Email address" type="email"/>
            <Inp value={pw} onChange={setPw} placeholder="Password" type="password"/>
            {mode==="register"&&<Inp value={rc} onChange={setRc} placeholder="Referral code (optional)"/>}
            <BtnPrimary onClick={()=>onLogin(null,{email:em,password:pw,username:un,referralCode:rc})} disabled={loading} full style={{marginTop:4,fontSize:14,padding:14}}>
              {loading?"Please wait…":mode==="login"?"Sign In":"Create Account"}
            </BtnPrimary>
            {serverOnline!==null&&<div style={{textAlign:"center",marginTop:8,fontSize:11,color:serverOnline?C.green:C.gold,display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:serverOnline?C.green:C.gold}}/>
              {serverOnline?"Connected to server":"Demo mode — backend offline"}
            </div>}
          </div>
          <div style={{marginTop:16,borderTop:`1px solid ${C.border2}`,paddingTop:14,textAlign:"center"}}>
            <button onClick={()=>onLogin("admin")} style={{background:"none",border:"none",color:C.muted2,cursor:"pointer",fontSize:12}}>⚙️ Admin demo login</button>
          </div>
        </Card>
        <div style={{textAlign:"center",marginTop:12,color:C.muted,fontSize:11}}>Demo mode · any credentials work</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PAYMENT MODAL
// ═══════════════════════════════════════════════════════════════
function PayModal({ plan, onClose, onSuccess }) {
  const [method,setMethod]   = useState("stripe");
  const [billing,setBilling] = useState("monthly");
  const [loading,setLoading] = useState(false);
  const prices = { diamond:{ monthly:29, annual:209 }, gold:{ monthly:50, annual:360 } };
  const price  = prices[plan]?.[billing]??29;
  const color  = plan==="diamond"?C.diamond:C.gold;
  const methods= [["stripe","💳","Stripe","Visa / Mastercard / Amex"],["paystack","🏦","Paystack","GTBank · Access · Zenith"],["paypal","🅿️","PayPal","PayPal balance or card"],["crypto","₿","Crypto","BTC · ETH · USDT"]];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center",padding:16}}>
      <div style={{background:C.panel,borderRadius:20,padding:24,width:"100%",maxWidth:440,border:`1px solid ${color}44`,boxShadow:`0 -8px 40px ${color}18`,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><TierBadge tier={plan}/><div style={{fontSize:20,fontWeight:900,color,marginTop:6}}>Upgrade to {plan.charAt(0).toUpperCase()+plan.slice(1)}</div></div>
          <BtnIcon onClick={onClose} style={{fontSize:22,color:C.muted2}}>×</BtnIcon>
        </div>
        {/* Billing */}
        <div style={{display:"flex",background:C.border,borderRadius:10,padding:3,marginBottom:16}}>
          {[["monthly","Monthly"],["annual","Annual — 40% off 🔥"]].map(([k,l])=>(
            <button key={k} onClick={()=>setBilling(k)} style={{flex:1,padding:"10px",background:billing===k?color+"22":"none",border:billing===k?`1.5px solid ${color}55`:"1.5px solid transparent",borderRadius:8,color:billing===k?color:C.muted2,cursor:"pointer",fontSize:12,fontWeight:700}}>{l}</button>
          ))}
        </div>
        <div style={{fontSize:32,fontWeight:900,color,marginBottom:16}}>${price}<span style={{fontSize:14,color:C.muted2,fontWeight:400}}>/{billing==="annual"?"yr":"mo"}</span></div>
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:18}}>
          {methods.map(([key,icon,name,desc])=>(
            <div key={key} onClick={()=>setMethod(key)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:`1.5px solid ${method===key?color:C.border2}`,background:method===key?color+"0a":"none",cursor:"pointer"}}>
              <span style={{fontSize:20}}>{icon}</span>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:C.bright}}>{name}</div><div style={{fontSize:11,color:C.muted2}}>{desc}</div></div>
              <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${method===key?color:C.muted}`,background:method===key?color:"none",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {method===key&&<div style={{width:6,height:6,borderRadius:"50%",background:C.bg}}/>}
              </div>
            </div>
          ))}
        </div>
        <BtnPrimary onClick={()=>{setLoading(true);setTimeout(()=>{setLoading(false);onSuccess(plan);},1400);}} disabled={loading} full style={{background:color,fontSize:14,padding:15}}>
          {loading?"Processing…":`Pay $${price} · Start ${plan.charAt(0).toUpperCase()+plan.slice(1)}`}
        </BtnPrimary>
        <div style={{textAlign:"center",color:C.muted2,fontSize:11,marginTop:10}}>🔒 Secured · Instant access · Cancel anytime</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════
function SuccessScreen({ plan, onContinue }) {
  const color = plan==="diamond"?C.diamond:C.gold;
  return (
    <div style={{background:C.bg,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24}}>
      <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 40%,${color}12 0%,transparent 60%)`}}/>
      <div style={{position:"relative",zIndex:1}}>
        <div style={{fontSize:72,marginBottom:20}}>🎉</div>
        <div style={{fontSize:28,fontWeight:900,color,letterSpacing:1,marginBottom:8}}>You're now {plan?.toUpperCase()}!</div>
        <div style={{color:C.muted2,fontSize:14,marginBottom:32,lineHeight:1.6}}>Full access unlocked<br/>Confirmation email sent</div>
        <BtnPrimary onClick={onContinue} style={{padding:"14px 40px",fontSize:15,background:color}}>Go to Dashboard →</BtnPrimary>
      </div>
    </div>
  );
}

// ─── Onboarding ───────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step,setStep]=useState(0);
  const steps=[
    {icon:"📊",title:"Welcome to Nexus Trade",body:"Professional AI-powered trading. 3 steps to get you started."},
    {icon:"🎁",title:"7-Day Diamond Trial",body:"All Diamond features, free for 7 days. No credit card required."},
    {icon:"🤖",title:"Copy Top Traders",body:"Mirror winning strategies with built-in 2% risk management."},
    {icon:"🚀",title:"You're ready!",body:"Explore the dashboard, check signals, or activate copy trading."},
  ];
  const s=steps[step];
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.9)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:C.panel,borderRadius:20,padding:32,width:"100%",maxWidth:380,textAlign:"center",border:`1px solid ${C.accent}44`}}>
        <div style={{fontSize:56,marginBottom:16}}>{s.icon}</div>
        <div style={{fontSize:20,fontWeight:800,color:C.bright,marginBottom:10}}>{s.title}</div>
        <div style={{color:C.muted2,fontSize:13,lineHeight:1.7,marginBottom:28}}>{s.body}</div>
        <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:24}}>
          {steps.map((_,i)=><div key={i} style={{width:i===step?24:8,height:8,borderRadius:4,background:i===step?C.accent:C.muted,transition:"all .3s"}}/>)}
        </div>
        <BtnPrimary onClick={()=>step<steps.length-1?setStep(s=>s+1):onDone()} full style={{fontSize:14,padding:14}}>
          {step<steps.length-1?"Next →":"Start Trading 🚀"}
        </BtnPrimary>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP LAYOUT — Bottom Nav (mobile) + Sidebar (desktop)
// ═══════════════════════════════════════════════════════════════
function AppLayout({ page, setPage, children, notifs, balance, isAdmin, userTier, isDesktop, serverOnline }) {
  const unread = notifs.filter(n=>!n.read).length;

  const userNav = [
    {id:"home",     icon:"🏠", label:"Home"   },
    {id:"markets",  icon:"📊", label:"Markets" },
    {id:"trade",    icon:"💹", label:"Trade"   },
    {id:"wallet",   icon:"💰", label:"Wallet"  },
    {id:"profile",  icon:"👤", label:"Profile" },
  ];
  const sideNav = [
    {id:"home",         icon:"🏠", label:"Home"         },
    {id:"markets",      icon:"📊", label:"Markets"       },
    {id:"trade",        icon:"💹", label:"Trade"         },
    {id:"signals",      icon:"📡", label:"Signals"       },
    {id:"ai",           icon:"🤖", label:"AI Analysis"   },
    {id:"copy",         icon:"📋", label:"Copy Trading"  },
    {id:"history",      icon:"📜", label:"History"       },
    {id:"wallet",       icon:"💰", label:"Wallet"        },
    {id:"referrals",    icon:"🎁", label:"Referrals"     },
    {id:"subscription", icon:"💎", label:"Subscription"  },
    ...(isAdmin?[{id:"admin",icon:"⚙️",label:"Admin"}]:[]),
  ];

  // Page titles
  const titles = { home:"Dashboard", markets:"Markets", trade:"Trade", signals:"Signals", ai:"AI Analysis", copy:"Copy Trading", history:"History", wallet:"Wallet", notifications:"Notifications", referrals:"Referrals", subscription:"Subscription", profile:"Profile", admin:"Admin" };

  if (isDesktop) {
    // ── Desktop layout: sidebar + main ──────────────────────
    return (
      <div style={{display:"flex",minHeight:"100vh",background:C.bg,fontFamily:"system-ui,sans-serif"}}>
        {/* Sidebar */}
        <div style={{width:220,background:C.panel,borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",position:"fixed",top:0,left:0,bottom:0,zIndex:50}}>
          <div style={{padding:"20px 20px 16px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:20,fontWeight:900,letterSpacing:2,color:C.accent}}>◈ NEXUS</div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"8px 8px"}}>
            {sideNav.map(n=>(
              <button key={n.id} onClick={()=>setPage(n.id)} style={{
                display:"flex",alignItems:"center",gap:12,padding:"11px 14px",
                width:"100%",background:page===n.id?C.accent+"18":"none",
                border:`1.5px solid ${page===n.id?C.accent+"44":"transparent"}`,
                borderRadius:10,cursor:"pointer",
                color:page===n.id?C.accent:C.muted2,
                fontSize:13,fontWeight:page===n.id?700:500,
                textAlign:"left",marginBottom:2,transition:"all .15s",
              }}
                onMouseEnter={e=>{if(page!==n.id){e.currentTarget.style.background=C.border;e.currentTarget.style.color=C.text;}}}
                onMouseLeave={e=>{if(page!==n.id){e.currentTarget.style.background="none";e.currentTarget.style.color=C.muted2;}}}
              >
                <span style={{fontSize:16,width:22,textAlign:"center"}}>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </div>
          <div style={{borderTop:`1px solid ${C.border}`,padding:"10px 8px"}}>
            <button onClick={()=>setPage("profile")} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",width:"100%",background:"none",border:"1.5px solid transparent",borderRadius:10,cursor:"pointer",color:C.muted2,fontSize:13,textAlign:"left",transition:"all .15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=C.border;e.currentTarget.style.color=C.text;}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=C.muted2;}}
            ><span style={{fontSize:16}}>👤</span> Profile</button>
          </div>
        </div>

        {/* Main */}
        <div style={{marginLeft:220,flex:1,display:"flex",flexDirection:"column"}}>
          {/* Top header */}
          <div style={{height:56,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",background:C.panel+"ee",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:40}}>
            <div style={{fontSize:16,fontWeight:700,color:C.bright}}>{titles[page]||"Dashboard"}</div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div
                title={serverOnline===null?"Checking…":serverOnline?"Connected":"Demo mode"}
                style={{width:7,height:7,borderRadius:"50%",background:serverOnline===null?C.gold:serverOnline?C.green:C.muted2,flexShrink:0}}
              />
              <div style={{fontSize:13,fontFamily:"monospace",color:C.accent,fontWeight:700}}>${balance.toLocaleString("en-US",{minimumFractionDigits:2})}</div>
              <BtnIcon onClick={()=>setPage("notifications")} badge={unread}>🔔</BtnIcon>
              <BtnIcon onClick={()=>setPage("profile")}>👤</BtnIcon>
            </div>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"24px"}}>
            <div style={{maxWidth:900,margin:"0 auto"}}>{children}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Mobile layout: header + content + bottom nav ──────────
  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"system-ui,sans-serif",paddingBottom:64}}>
      {/* Top header */}
      <div style={{height:54,borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 16px",background:C.panel+"f0",backdropFilter:"blur(12px)",position:"sticky",top:0,zIndex:40}}>
        <div style={{fontSize:18,fontWeight:900,letterSpacing:2,color:C.accent}}>◈ NEXUS</div>
        <div style={{fontSize:14,fontWeight:700,color:C.bright}}>{titles[page]||""}</div>
        <div style={{display:"flex",gap:2}}>
          <BtnIcon onClick={()=>setPage("notifications")} badge={unread}>🔔</BtnIcon>
          <BtnIcon onClick={()=>setPage("profile")}>👤</BtnIcon>
        </div>
      </div>

      {/* Page content */}
      <div style={{padding:"16px 16px 0"}}>{children}</div>

      {/* Fixed bottom nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.panel+"f8",borderTop:`1px solid ${C.border}`,display:"flex",height:60,zIndex:40,backdropFilter:"blur(16px)"}}>
        {userNav.map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id)} style={{
            flex:1,display:"flex",flexDirection:"column",alignItems:"center",
            justifyContent:"center",gap:3,
            background:"none",border:"none",cursor:"pointer",
            color:page===n.id?C.accent:C.muted,
            padding:"6px 0",transition:"color .15s",minHeight:44,
          }}>
            <span style={{fontSize:page===n.id?20:18,transition:"font-size .15s"}}>{n.icon}</span>
            <span style={{fontSize:9,fontWeight:page===n.id?800:500,letterSpacing:.3}}>{n.label}</span>
            {page===n.id&&<div style={{position:"absolute",bottom:0,width:24,height:2,background:C.accent,borderRadius:"2px 2px 0 0"}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROOT APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  // ── screens
  const [screen,      setScreen]      = useState("landing");
  const [authMode,    setAuthMode]    = useState("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [isAdmin,     setIsAdmin]     = useState(false);

  // ── ui
  const [page,        setPage]        = useState("home");
  const [showOnboard, setShowOnboard] = useState(false);
  const [payModal,    setPayModal]    = useState(null);
  const [successPlan, setSuccessPlan] = useState(null);
  const [toasts,      setToasts]      = useState([]);
  const [isDesktop,   setIsDesktop]   = useState(window.innerWidth >= 900);
  const [serverOnline, setServerOnline] = useState(null); // null=checking, true, false

  // ── user (populated from real API or demo)
  const [userId,      setUserId]      = useState(null);
  const [userTier,    setUserTier]    = useState("gold");
  const [onTrial,     setOnTrial]     = useState(true);
  const [trialDays,   setTrialDays]   = useState(5);
  const [balance,     setBalance]     = useState(3248.75);

  // ── pair state (exact user spec structure)
  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [pairData,     setPairData]     = useState(initPairData);

  // ── trading (start with demo, replaced by real data on connect)
  const [trades,       setTrades]       = useState(DEMO_TRADES);
  const [transactions, setTransactions] = useState(DEMO_TXS);
  const [notifs,       setNotifs]       = useState(DEMO_NOTIFS);
  const [signals,      setSignals]      = useState(DEMO_SIGNALS);

  // ── admin
  const [users,        setUsers]        = useState(DEMO_USERS);
  const [withdrawals,  setWithdrawals]  = useState(DEMO_WITHDRAWALS);

  // ── responsive
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ── toast helper
  const notify = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);

  // ── Check server health + auto-login from stored token
  useEffect(() => {
    async function init() {
      try {
        await API.health();
        setServerOnline(true);
        // Auto-login if valid token stored
        const token = getToken();
        if (token) {
          try {
            const { user } = await API.me();
            applyUser(user);
            setScreen("app");
          } catch {
            clearToken();
          }
        }
      } catch {
        // Backend unreachable — silently use demo mode
        setServerOnline(false);
      }
    }
    init();
  }, []); // eslint-disable-line

  // Apply user data from API response
  function applyUser(user) {
    if (!user) return;
    setUserId(user._id);
    setIsAdmin(user.isAdmin || false);

    // Tier
    const tier = user.tier || "free";
    setUserTier(tier);

    // Trial
    if (user.trialEnds) {
      const daysLeft = Math.max(0, Math.ceil((new Date(user.trialEnds) - Date.now()) / 86400000));
      setOnTrial(daysLeft > 0);
      setTrialDays(daysLeft);
    } else {
      setOnTrial(false);
    }

    // Balance
    if (user.wallet?.balance !== undefined) {
      setBalance(user.wallet.balance);
    }
  }

  // Load wallet data from API
  async function loadWallet() {
    if (!serverOnline) return;
    try {
      const { balance: bal, transactions: txs } = await API.getWallet();
      setBalance(bal);
      if (txs) setTransactions(txs.map(t => ({
        type:   t.type,
        amount: t.amount,
        status: t.status,
        date:   new Date(t.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
        method: t.method,
      })));
    } catch {}
  }

  // Load trades from API
  async function loadTrades() {
    if (!serverOnline) return;
    try {
      const { trades: apiTrades } = await API.getTrades();
      if (apiTrades?.length) {
        setTrades(apiTrades.map(t => ({
          id:     t._id,
          type:   t.direction,
          pair:   t.pair,
          entry:  t.entry,
          exit:   t.exit,
          profit: t.profit,
          date:   new Date(t.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
        })));
      }
    } catch {}
  }

  // Load signals
  async function loadSignals() {
    if (!serverOnline) return;
    try {
      const { signals: apiSigs } = await API.getSignals();
      if (apiSigs?.length) setSignals(apiSigs);
    } catch (err) {
      if (err.upgrade) notify("Signal limit reached — upgrade for unlimited", "warn");
    }
  }

  // Load admin data
  async function loadAdminData() {
    if (!serverOnline || !isAdmin) return;
    try {
      const [usersRes, wdRes] = await Promise.all([API.adminUsers(), API.adminWithdrawals()]);
      if (usersRes.users) setUsers(usersRes.users.map(u => ({
        id: u._id, username: u.username, email: u.email,
        tier: u.tier, balance: u.wallet?.balance || 0,
      })));
      if (wdRes.withdrawals) setWithdrawals(wdRes.withdrawals.map(w => ({
        id: w._id, user: w.userId?.username || "—",
        amount: w.amount, method: w.method, status: w.status,
        date: new Date(w.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric" }),
      })));
    } catch {}
  }

  // When screen becomes "app", load real data
  useEffect(() => {
    if (screen !== "app") return;
    loadWallet();
    loadTrades();
    loadSignals();
    if (isAdmin) loadAdminData();
  }, [screen, isAdmin]); // eslint-disable-line

  // ── Live ticker (exact user spec logic)
  useEffect(() => {
    if (screen !== "app") return;
    const interval = setInterval(() => {
      setPairData(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(pair => {
          const base = updated[pair].price;
          const volatility =
            pair === "BTCUSDT" || pair === "ETHUSDT" ? 0.02 :
            pair === "USDJPY"  ? 0.002 : 0.001;
          const move = (Math.random() - 0.5) * base * volatility;
          updated[pair] = {
            ...updated[pair],
            price:   base + move,
            change:  (move / base) * 100,
            candles: [...updated[pair].candles.slice(-50), generateCandle(base + move)],
          };
        });
        return { ...updated };
      });
    }, 1700);
    return () => clearInterval(interval);
  }, [screen]);

  // ── Auth handler — real API with guaranteed demo fallback
  const handleAuth = async (role, formData) => {
    if (role === "admin") {
      setIsAdmin(true); setUserTier("diamond"); setOnTrial(false);
      setScreen("app"); setPage("admin");
      notify("Admin demo mode");
      return;
    }
    setAuthLoading(true);
    try {
      if (serverOnline === true) {
        // Try real API
        const res = authMode === "login"
          ? await API.login({ email: formData?.email, password: formData?.password })
          : await API.register({
              username: formData?.username,
              email: formData?.email,
              password: formData?.password,
              referralCode: formData?.referralCode,
            });
        applyUser(res.user);
      } else {
        // Demo mode — server offline or still checking
        setUserTier("gold");
        setOnTrial(true);
        setTrialDays(5);
        setBalance(3248.75);
      }
      setScreen("app");
      setPage("home");
      if (authMode === "register") setTimeout(() => setShowOnboard(true), 400);
      notify(authMode === "login" ? "Welcome back!" : "Account created 🎉");
    } catch (err) {
      if (err.offline) {
        // API call failed mid-flight — fall back to demo
        setUserTier("gold"); setOnTrial(true); setTrialDays(5); setBalance(3248.75);
        setScreen("app"); setPage("home");
        notify("Running in demo mode", "warn");
      } else {
        notify(err.message || "Authentication failed", "error");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Upgrade handler (real API with fallback)
  const handleUpgrade = async (plan) => {
    if (serverOnline) {
      try {
        // Initialize Paystack payment
        const res = await API.paystackInit({ plan, billing: "monthly" });
        if (res?.data?.authorization_url) {
          // Open Paystack checkout in new tab
          window.open(res.data.authorization_url, "_blank");
          notify("Complete payment in the Paystack window");
          setPayModal(null);
          return;
        }
      } catch (err) {
        if (err.offline) {
          // Fallback: apply upgrade locally in demo mode
          notify("Demo mode — upgrade applied locally", "warn");
        } else {
          notify(err.message || "Payment failed", "error");
          return;
        }
      }
    }
    // Demo / offline upgrade
    setPayModal(null); setUserTier(plan); setOnTrial(false);
    setSuccessPlan(plan); setScreen("success");
  };

  // ── Wallet handlers (real API)
  const handleDeposit = async ({ amount, method }) => {
    if (!serverOnline) {
      // Demo mode
      setBalance(b => b + parseFloat(amount));
      setTransactions(t => [{ type:"deposit", amount:parseFloat(amount), status:"completed", date:"Now", method },...t]);
      notify(`$${parseFloat(amount).toLocaleString()} deposited`);
      return;
    }
    try {
      const res = await API.deposit({ amount: parseFloat(amount), method });
      setBalance(res.balance);
      await loadWallet();
      notify(`$${parseFloat(amount).toLocaleString()} deposited`);
    } catch (err) { notify(err.message, "error"); }
  };

  const handleWithdraw = async ({ amount, method, accountDetails }) => {
    const amt = parseFloat(amount);
    if (amt > balance) { notify("Insufficient funds", "error"); return; }
    if (!serverOnline) {
      setBalance(b => b - amt);
      setTransactions(t => [{ type:"withdraw", amount:amt, status:"pending", date:"Now", method },...t]);
      notify("Withdrawal submitted — pending review");
      return;
    }
    try {
      const res = await API.withdraw({ amount: amt, method, accountDetails });
      setBalance(res.balance);
      await loadWallet();
      notify("Withdrawal submitted — pending admin review");
    } catch (err) { notify(err.message, "error"); }
  };

  // ── Admin handlers (real API)
  const handleAdminTier = async (userId, tier) => {
    if (serverOnline) {
      try { await API.adminSetTier(userId, { tier }); } catch {}
    }
    setUsers(us => us.map(u => u.id === userId ? { ...u, tier } : u));
    notify(`User tier updated to ${tier}`);
  };

  const handleAdminWithdrawal = async (id, status) => {
    if (serverOnline) {
      try { await API.adminUpdateWithdrawal(id, { status }); } catch {}
    }
    setWithdrawals(ws => ws.map(w => w.id === id ? { ...w, status } : w));
    notify(status === "approved" ? "Withdrawal approved" : "Withdrawal rejected",
      status === "approved" ? "success" : "error");
  };

  // ── screen routing
  if (screen === "landing") return (
    <>
      <Landing onEnter={m => { setAuthMode(m); setScreen("auth"); }}/>
      <Toasts list={toasts}/>
      {/* Server status pill — bottom left */}
      {serverOnline !== null && (
        <div style={{
          position:"fixed", bottom:20, left:20, zIndex:999,
          display:"flex", alignItems:"center", gap:7,
          background:C.panel, border:`1px solid ${serverOnline ? C.green+"55" : C.gold+"55"}`,
          borderRadius:20, padding:"6px 14px", fontSize:11, fontFamily:"monospace",
        }}>
          <div style={{width:7,height:7,borderRadius:"50%",background:serverOnline?C.green:C.gold,flexShrink:0}}/>
          <span style={{color:serverOnline?C.green:C.gold}}>
            {serverOnline ? "Backend connected" : "Demo mode"}
          </span>
        </div>
      )}
    </>
  );
  if (screen === "auth")    return (
    <>
      <Auth mode={authMode} setMode={setAuthMode} onLogin={handleAuth} loading={authLoading} serverOnline={serverOnline}/>
      <Toasts list={toasts}/>
    </>
  );
  if (screen === "success") return <SuccessScreen plan={successPlan} onContinue={() => { setScreen("app"); setPage("home"); }}/>;

  // ── page routing
  const pageProps = {
    // pair / chart
    pairData, selectedPair, setSelectedPair,
    // user
    userTier, setUserTier, onTrial, trialDays, setOnTrial, isAdmin, userId,
    // ui
    setPayModal, notify, setPage, setScreen, setIsAdmin,
    // wallet (real API handlers)
    balance, setBalance,
    transactions, setTransactions,
    handleDeposit, handleWithdraw,
    // data
    trades, setTrades,
    signals,
    notifs, setNotifs,
    // admin (real API handlers)
    users, setUsers, handleAdminTier,
    withdrawals, setWithdrawals, handleAdminWithdrawal,
    // server
    serverOnline,
    // reload helpers
    loadWallet, loadTrades, loadSignals,
  };
  const renderPage = () => {
    switch(page) {
      case "home":         return <PageHome         {...pageProps}/>;
      case "markets":      return <PageMarkets       {...pageProps}/>;
      case "trade":        return <PageTrade         {...pageProps}/>;
      case "wallet":       return <PageWallet        {...pageProps}/>;
      case "signals":      return <PageSignals       {...pageProps}/>;
      case "ai":           return <PageAI            {...pageProps}/>;
      case "copy":         return <PageCopy          {...pageProps}/>;
      case "history":      return <PageHistory       {...pageProps}/>;
      case "notifications":return <PageNotifications {...pageProps}/>;
      case "referrals":    return <PageReferrals     {...pageProps}/>;
      case "subscription": return <PageSubscription  {...pageProps}/>;
      case "profile":      return <PageProfile       {...pageProps}/>;
      case "admin":        return <PageAdmin         {...pageProps}/>;
      default:             return <PageHome          {...pageProps}/>;
    }
  };

  return (
    <>
      <style>{`
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{margin:0;background:#03070d;}
        @keyframes toastIn{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#162840;border-radius:4px;}
        input::placeholder{color:#2d4a62;}
      `}</style>

      {showOnboard&&<Onboarding onDone={()=>setShowOnboard(false)}/>}
      {payModal   &&<PayModal plan={payModal} onClose={()=>setPayModal(null)} onSuccess={handleUpgrade}/>}

      <AppLayout page={page} setPage={setPage} notifs={notifs} balance={balance} isAdmin={isAdmin} userTier={userTier} isDesktop={isDesktop} serverOnline={serverOnline}>
        {renderPage()}
      </AppLayout>

      <Toasts list={toasts}/>
    </>
  );
}
