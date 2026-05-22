import { useState, useEffect, useCallback, createContext, useContext } from "react";

// MOCK AUTH — preview only, no network calls
// Real Supabase auth is in OpsExposure_v4.jsx for deployment
const mockAuth = {
  _user: null,
  _listeners: [],
  _init() {
    try { const s = localStorage.getItem("mock-user"); if(s) this._user = JSON.parse(s); } catch {}
  },
  async getSession() {
    this._init();
    const session = this._user ? { user: this._user } : null;
    return { data: { session } };
  },
  async signUp(email, password) {
    if (!email || !password) return { data:null, error:{ message:"Please fill in all fields." }};
    if (password.length < 6) return { data:null, error:{ message:"Password must be at least 6 characters." }};
    const user = { id: "mock-" + Date.now(), email };
    this._user = user;
    localStorage.setItem("mock-user", JSON.stringify(user));
    this._listeners.forEach(fn => fn("SIGNED_IN", { user }));
    return { data: { user }, error: null };
  },
  async signInWithPassword(email, password) {
    if (!email || !password) return { data:null, error:{ message:"Please fill in all fields." }};
    if (password.length < 6) return { data:null, error:{ message:"Password must be at least 6 characters." }};
    const stored = localStorage.getItem("mock-user");
    if (!stored) return { data:null, error:{ message:"No account found. Please sign up first." }};
    const user = JSON.parse(stored);
    if (user.email !== email) return { data:null, error:{ message:"Incorrect email or password." }};
    this._user = user;
    this._listeners.forEach(fn => fn("SIGNED_IN", { user }));
    return { data: { user }, error: null };
  },
  async signOut() {
    this._user = null;
    localStorage.removeItem("mock-user");
    this._listeners.forEach(fn => fn("SIGNED_OUT", null));
  },
  onAuthStateChange(fn) {
    this._listeners.push(fn);
    return { data: { subscription: { unsubscribe: () => { this._listeners = this._listeners.filter(l=>l!==fn); } } } };
  },
};
const supabase = { auth: mockAuth };

const globalStyles = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --black: #080808; --surface: #0d0b12; --surface2: #131020;
  --border: #1e1a2e; --border2: #2a2440;
  --purple: #7c3aed; --purple-dim: #6d28d9; --purple-bright: #a855f7;
  --purple-critical: #c026d3; --purple-soft: #818cf8;
  --green: #1a9e5c; --white: #f0ede8; --muted: #5a5470;
  --mono: 'Space Mono', monospace; --sans: 'DM Sans', sans-serif;
}
html { -webkit-text-size-adjust:100%; overflow-x:hidden; }
body { background:var(--black); color:var(--white); font-family:var(--sans); overflow-x:hidden; -webkit-tap-highlight-color:transparent; }
button { cursor:pointer; font-family:var(--sans); touch-action:manipulation; }
input, select { font-size:16px !important; font-family:var(--sans); }
@keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes loadFill { from{width:0} to{width:100%} }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:var(--black)} ::-webkit-scrollbar-thumb{background:var(--border2)}
.desktop-nav{display:flex} .mobile-nav{display:none}
.app-content{padding-left:200px;padding-bottom:40px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.hero-layout{display:grid;grid-template-columns:1fr auto;gap:60px;align-items:center}
.hero-widget{display:block}
.domain-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border)}
.threshold-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border)}
.plan-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border);max-width:700px;width:100%}
@media(max-width:768px){
  .desktop-nav{display:none!important} .mobile-nav{display:flex!important}
  .app-content{padding-left:0;padding-bottom:72px}
  .grid-2{grid-template-columns:1fr}
  .hero-layout{grid-template-columns:1fr;gap:0}
  .hero-widget{display:none}
  .domain-grid{grid-template-columns:1fr 1fr}
  .threshold-grid{grid-template-columns:1fr 1fr}
  .plan-grid{grid-template-columns:1fr;max-width:100%}
  .rescore-card{flex-direction:column!important;align-items:flex-start!important;gap:16px!important}
  .stress-card{flex-direction:column!important;align-items:flex-start!important}
  .account-header{flex-direction:column!important;align-items:flex-start!important;gap:12px!important}
}`;

const STORAGE_KEY = "opsExposureStore";
const defaultState = { revenueInfo:null, currentPlan:null, diagnosticAnswers:[], scores:null, scoreHistory:[], isRescore:false };
const StoreContext = createContext(null);
function StoreProvider({children}) {
  const [state,setState] = useState(()=>{ try{const s=localStorage.getItem(STORAGE_KEY);return s?JSON.parse(s):defaultState}catch{return defaultState} });
  useEffect(()=>{ try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}catch{} },[state]);
  const set = useCallback((patch)=>setState(p=>({...p,...patch})),[]);
  return <StoreContext.Provider value={{...state,setRevenueInfo:v=>set({revenueInfo:v}),setDiagnosticAnswers:v=>set({diagnosticAnswers:v}),setScores:v=>setState(p=>({...p,scores:v,scoreHistory:[...p.scoreHistory,v]})),setCurrentPlan:v=>set({currentPlan:v}),setIsRescore:v=>set({isRescore:v}),clearAll:()=>setState(defaultState)}}>{children}</StoreContext.Provider>;
}
const useStore = () => useContext(StoreContext);

const AuthContext = createContext(null);
function AuthProvider({children}) {
  const [user,setUser] = useState(null);
  const [authLoading,setAuthLoading] = useState(true);
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ setUser(session?.user||null); setAuthLoading(false); });
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_,session)=>setUser(session?.user||null));
    return ()=>subscription.unsubscribe();
  },[]);
  const signUp = async(email,password)=>{ return await supabase.auth.signUp(email,password); };
  const signIn = async(email,password)=>{ return await supabase.auth.signInWithPassword(email,password); };
  const signOut = async()=>{ await supabase.auth.signOut(); };
  return <AuthContext.Provider value={{user,authLoading,signUp,signIn,signOut}}>{children}</AuthContext.Provider>;
}
const useAuth = () => useContext(AuthContext);

const QUESTIONS = [
  {id:"cap_1",domain:"CAPTURE",text:"How do new enquiries currently reach your business?",isFollowUp:false,options:[{label:"Consistent inbound pipeline",value:4},{label:"Mix of referrals and marketing",value:3},{label:"Referrals only",value:2},{label:"I don't track this",value:1,triggerFollowUp:true}]},
  {id:"cap_2",domain:"CAPTURE",text:"Do you have a documented process for logging and following up on every enquiry?",isFollowUp:false,options:[{label:"Yes, always followed",value:4},{label:"Sometimes",value:3},{label:"No process",value:2},{label:"Unknown",value:1,triggerFollowUp:true}]},
  {id:"cap_fu",domain:"CAPTURE",text:"How many new enquiries did you receive last month?",isFollowUp:true,options:[{label:"More than 20",value:4},{label:"10–20",value:3},{label:"Fewer than 10",value:2},{label:"No idea",value:1}]},
  {id:"con_1",domain:"CONVERSION",text:"What is your approximate proposal-to-close rate?",isFollowUp:false,options:[{label:"Above 60%",value:4},{label:"40–60%",value:3},{label:"Below 40%",value:2},{label:"I don't track this",value:1,triggerFollowUp:true}]},
  {id:"con_2",domain:"CONVERSION",text:"How consistently do you follow up with unconverted prospects?",isFollowUp:false,options:[{label:"Structured follow-up system",value:4},{label:"Ad hoc",value:3},{label:"Rarely",value:2},{label:"Never",value:1,triggerFollowUp:true}]},
  {id:"con_fu",domain:"CONVERSION",text:"When did you last review your conversion rate?",isFollowUp:true,options:[{label:"This month",value:4},{label:"Last quarter",value:3},{label:"Over 6 months ago",value:2},{label:"Never",value:1}]},
  {id:"del_1",domain:"DELIVERY",text:"How often do projects exceed their original scope without additional billing?",isFollowUp:false,options:[{label:"Rarely",value:4},{label:"Occasionally",value:3},{label:"Frequently",value:2},{label:"Almost always",value:1}]},
  {id:"del_2",domain:"DELIVERY",text:"Do you track rework or error rates in delivery?",isFollowUp:false,options:[{label:"Yes, formally",value:4},{label:"Informally",value:3},{label:"No",value:2},{label:"Unknown",value:1,triggerFollowUp:true}]},
  {id:"del_fu",domain:"DELIVERY",text:"Do clients ever leave a project feeling it wasn't fully delivered?",isFollowUp:true,options:[{label:"Rarely",value:4},{label:"Sometimes",value:3},{label:"Often",value:2},{label:"Unknown",value:1}]},
  {id:"ret_1",domain:"RETENTION",text:"What percentage of clients return for repeat work within 12 months?",isFollowUp:false,options:[{label:"Over 50%",value:4},{label:"25–50%",value:3},{label:"Under 25%",value:2},{label:"I don't track this",value:1,triggerFollowUp:true}]},
  {id:"ret_2",domain:"RETENTION",text:"Do you have a structured process for post-project follow-up or check-ins?",isFollowUp:false,options:[{label:"Yes, always",value:4},{label:"Sometimes",value:3},{label:"No",value:2},{label:"Unknown",value:1,triggerFollowUp:true}]},
  {id:"ret_fu",domain:"RETENTION",text:"When did you last proactively contact a past client?",isFollowUp:true,options:[{label:"This week",value:4},{label:"This month",value:3},{label:"Over 3 months ago",value:2},{label:"Can't remember",value:1}]},
];

function calculateScores(answers) {
  const domains=["CAPTURE","CONVERSION","DELIVERY","RETENTION"],ds={};
  domains.forEach(d=>{const da=answers.filter(a=>a.domain===d);if(!da.length){ds[d]=0;return;}const avg=da.reduce((s,a)=>s+a.value,0)/da.length;ds[d]=Math.round(((avg-1)/3)*100);});
  return{overall:Math.round(Object.values(ds).reduce((s,v)=>s+v,0)/4),capture:ds.CAPTURE,conversion:ds.CONVERSION,delivery:ds.DELIVERY,retention:ds.RETENTION};
}
function getStatus(score){if(score<40)return{label:"CRITICALLY EXPOSED",color:"#c026d3"};if(score<60)return{label:"ELEVATED EXPOSURE",color:"#a855f7"};if(score<80)return{label:"EXPOSED",color:"#818cf8"};return{label:"CONTAINED",color:"#1a9e5c"};}
function getContext(score){if(score<40)return"Multiple domains are critically exposed. Revenue is leaking across your whole operation. This needs attention now.";if(score<60)return"There are clear gaps in how your business captures, converts, delivers, or retains. Left unchecked, they compound.";if(score<80)return"You're running reasonably well but there's measurable leakage. A few targeted fixes will make a real difference.";return"Your operations are tight. Keep the discipline and focus on the marginal gains.";}
function calcLeakage(revenue,score){const base=revenue*(1-score/100)*0.15;return{min:Math.round(base*0.8),max:Math.round(base*1.2)};}
function getExposureFactors(answers){return[...answers].sort((a,b)=>a.value-b.value).slice(0,3).map(a=>`${a.domain.charAt(0)+a.domain.slice(1).toLowerCase()}: ${a.answer}`);}
function getStabilityFactors(answers){return[...answers].sort((a,b)=>b.value-a.value).slice(0,2).map(a=>`${a.domain.charAt(0)+a.domain.slice(1).toLowerCase()}: ${a.answer}`);}
function getPriorityActions(answers,revenue,scores){
  const actions=[],check=(id,domain,title,desc)=>{const a=answers.find(a=>a.questionId===id);if(a&&a.value<=2)actions.push({domain,title,desc});};
  check("con_2","CONVERSION","Implement structured follow-up for unconverted proposals","Consistent follow-up captures value currently abandoning the pipeline.");
  check("del_2","DELIVERY","Introduce a delivery quality checkpoint","Formalizing checks prevents scope creep and protects profit margins.");
  check("ret_2","RETENTION","Build a 30-day post-project check-in sequence","Systematic check-ins directly increase repeat business and referrals.");
  check("cap_2","CAPTURE","Install a lead capture and logging system","A single source of truth ensures no inbound interest falls through.");
  check("con_1","CONVERSION","Audit and rewrite your proposal structure","Optimising your pitch dramatically improves return on capture efforts.");
  return actions.slice(0,3).map((act,i)=>{const dScore=act.domain==="CAPTURE"?scores.capture:act.domain==="CONVERSION"?scores.conversion:act.domain==="DELIVERY"?scores.delivery:scores.retention;const base=(revenue*(1-dScore/100)*0.15)/4*0.4;return{...act,id:`act_${i}`,recovery:{min:Math.round(base*0.8),max:Math.round(base*1.2)}};});
}

const s={
  btn:{fontFamily:"var(--mono)",fontSize:12,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",padding:"16px 28px",background:"var(--purple)",color:"var(--white)",border:"none",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,transition:"background 0.2s",minHeight:48,touchAction:"manipulation"},
  btnOutline:{fontFamily:"var(--mono)",fontSize:11,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",padding:"14px 24px",background:"transparent",color:"var(--white)",border:"1px solid var(--border2)",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s",minHeight:48,touchAction:"manipulation"},
  input:{width:"100%",background:"var(--surface)",border:"1px solid var(--border2)",color:"var(--white)",fontFamily:"var(--sans)",fontSize:16,padding:"16px",outline:"none",transition:"border-color 0.2s",borderRadius:0,appearance:"none",WebkitAppearance:"none"},
  card:{background:"var(--surface)",border:"1px solid var(--border)",padding:24},
  label:{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.15em",textTransform:"uppercase",color:"var(--muted)",display:"block",marginBottom:8},
};

function Btn({children,onClick,disabled,variant="primary",style={}}){
  const base=variant==="outline"?s.btnOutline:s.btn;
  return <button onClick={onClick} disabled={disabled} style={{...base,...style,opacity:disabled?0.4:1,background:disabled?"var(--border2)":(variant==="outline"?"transparent":"var(--purple)")}} onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background=variant==="outline"?"var(--border2)":"var(--purple-dim)";}} onMouseLeave={e=>{if(!disabled)e.currentTarget.style.background=variant==="outline"?"transparent":"var(--purple)";}}>{children}</button>;
}

function Nav({page,setPage}){
  const{currentPlan}=useStore();
  const isPublic=["landing","signup","login","revenue-input","diagnostic","score-reveal","plan-selection"].includes(page);
  if(isPublic)return(
    <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid var(--border)",background:"rgba(8,8,8,0.95)",backdropFilter:"blur(12px)"}}>
      <span onClick={()=>setPage("landing")} style={{fontFamily:"var(--mono)",fontSize:13,fontWeight:700,letterSpacing:"0.1em",cursor:"pointer"}}>Ops<span style={{color:"var(--purple)"}}>Exposure</span></span>
      {page==="landing"&&<div style={{display:"flex",gap:12,alignItems:"center"}}>
        <button onClick={()=>setPage("login")} style={{background:"none",border:"none",color:"var(--muted)",fontFamily:"var(--sans)",fontSize:13,cursor:"pointer",padding:"8px",minHeight:44}}>Sign in</button>
        <Btn onClick={()=>setPage("signup")} style={{padding:"10px 16px",fontSize:10}}>Start for £1</Btn>
      </div>}
    </nav>
  );
  const navItems=[{id:"dashboard",label:"Dashboard"},{id:"actions",label:"Actions",locked:currentPlan==="exposure"},{id:"stress-test",label:"Stress",locked:currentPlan==="exposure"},{id:"account",label:"Account"}];
  return(<>
    <nav className="desktop-nav" style={{position:"fixed",top:0,left:0,bottom:0,width:200,borderRight:"1px solid var(--border)",background:"var(--surface)",flexDirection:"column",padding:"24px 0",zIndex:100}}>
      <span style={{fontFamily:"var(--mono)",fontSize:12,fontWeight:700,letterSpacing:"0.1em",padding:"0 24px 24px",borderBottom:"1px solid var(--border)",display:"block"}}>Ops<span style={{color:"var(--purple)"}}>Exposure</span></span>
      <div style={{flex:1,paddingTop:16}}>{navItems.map(item=>(
        <button key={item.id} onClick={()=>setPage(item.id)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",background:page===item.id?"rgba(124,58,237,0.1)":"transparent",borderLeft:page===item.id?"2px solid var(--purple)":"2px solid transparent",border:"none",borderRight:"none",color:page===item.id?"var(--purple)":"var(--muted)",fontFamily:"var(--mono)",fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",cursor:"pointer",textAlign:"left",minHeight:48}}>
          {item.label}{item.locked&&<span style={{fontSize:9,opacity:0.5}}>🔒</span>}
        </button>
      ))}</div>
    </nav>
    <nav className="mobile-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,borderTop:"1px solid var(--border)",background:"var(--surface)"}}>
      {navItems.map(item=>(
        <button key={item.id} onClick={()=>setPage(item.id)} style={{flex:1,padding:"12px 4px",background:"none",border:"none",color:page===item.id?"var(--purple)":"var(--muted)",fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",minHeight:56,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
          {item.label}{item.locked?" 🔒":""}
        </button>
      ))}
    </nav>
  </>);
}

function LandingPage({setPage}){
  const bars=[{name:"CAPTURE",score:72,color:"#1a9e5c"},{name:"CONVERSION",score:38,color:"#c026d3"},{name:"DELIVERY",score:31,color:"#c026d3"},{name:"RETENTION",score:58,color:"#a855f7"}];
  return(
    <div style={{minHeight:"100vh",paddingTop:64,overflowX:"hidden"}}>
      <div className="hero-layout" style={{maxWidth:1200,margin:"0 auto",padding:"60px 20px 48px"}}>
        <div style={{animation:"fadeUp 0.6s ease both"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--purple)",marginBottom:20,display:"flex",alignItems:"center",gap:12}}>
            <span style={{width:24,height:1,background:"var(--purple)",display:"inline-block",flexShrink:0}}/>Operational Diagnostic
          </div>
          <h1 style={{fontFamily:"var(--mono)",fontSize:"clamp(28px,7vw,60px)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.02em",marginBottom:20}}>
            Your business is losing money.<br/><span style={{color:"var(--purple)"}}>Find out where.</span>
          </h1>
          <p style={{fontSize:"clamp(15px,4vw,17px)",color:"#888",maxWidth:480,lineHeight:1.7,marginBottom:36,fontWeight:300}}>Answer 8 questions. Get a scored breakdown across four operational domains. See exactly where revenue is leaking and what to fix first.</p>
          <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:360}}>
            <Btn onClick={()=>setPage("signup")} style={{width:"100%",fontSize:13}}>Get my score →</Btn>
            <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",textAlign:"center"}}>£1 trial · 7 days · Cancel anytime</span>
          </div>
        </div>
        <div className="hero-widget" style={{...s.card,width:280,flexShrink:0}}>
          <div style={{...s.label,marginBottom:6}}>Overall Exposure Score</div>
          <div style={{fontFamily:"var(--mono)",fontSize:72,fontWeight:700,lineHeight:1,color:"var(--purple-bright)",marginBottom:4}}>41</div>
          <div style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:700,letterSpacing:"0.15em",color:"var(--purple-bright)",border:"1px solid var(--purple-bright)",display:"inline-block",padding:"3px 8px",marginBottom:20}}>ELEVATED EXPOSURE</div>
          <div style={{display:"flex",flexDirection:"column",gap:10,borderTop:"1px solid var(--border)",paddingTop:16}}>
            {bars.map(d=>(
              <div key={d.name} style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)",width:80,flexShrink:0}}>{d.name}</span>
                <div style={{flex:1,height:3,background:"var(--border2)"}}><div style={{width:`${d.score}%`,height:"100%",background:d.color}}/></div>
                <span style={{fontFamily:"var(--mono)",fontSize:10,width:24,textAlign:"right"}}>{d.score}</span>
              </div>
            ))}
          </div>
          <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)"}}>
            <div style={{...s.label,marginBottom:4}}>Est. Monthly Leakage</div>
            <div style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,color:"var(--purple)"}}>£4,200–£6,800</div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"0 20px"}}>
        <div className="threshold-grid">
          {[{r:"0–39",l:"Critical",c:"#c026d3"},{r:"40–59",l:"Elevated",c:"#a855f7"},{r:"60–79",l:"Exposed",c:"#818cf8"},{r:"80–100",l:"Contained",c:"#1a9e5c"}].map(t=>(
            <div key={t.r} style={{background:"var(--surface)",padding:"16px 12px",textAlign:"center"}}>
              <div style={{fontFamily:"var(--mono)",fontSize:"clamp(11px,3vw,13px)",fontWeight:700,color:t.c,marginBottom:4}}>{t.r}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:"clamp(8px,2vw,9px)",letterSpacing:"0.1em",textTransform:"uppercase",color:t.c}}>{t.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"48px auto 0",padding:"0 20px"}}>
        <div style={{...s.label,marginBottom:24}}>Four domains · Everything scored</div>
        <div className="domain-grid">
          {[{k:"C",name:"Capture",desc:"Pipeline, enquiry handling, lead logging and visibility."},{k:"C",name:"Conversion",desc:"Proposal quality, follow-up discipline, close rate tracking."},{k:"D",name:"Delivery",desc:"Scope creep, rework rate, client communication, margin erosion."},{k:"R",name:"Retention",desc:"Churn triggers, repeat engagement, referral generation."}].map((d,i)=>(
            <div key={i} style={{background:"var(--black)",padding:"28px 20px"}}>
              <div style={{width:32,height:32,border:"1px solid var(--border2)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--mono)",fontSize:13,color:"var(--purple)",marginBottom:14}}>{d.k}</div>
              <h3 style={{fontFamily:"var(--mono)",fontSize:"clamp(11px,2.5vw,13px)",fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:8}}>{d.name}</h3>
              <p style={{fontSize:"clamp(12px,3vw,13px)",color:"var(--muted)",lineHeight:1.6}}>{d.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"60px auto",padding:"0 20px"}}>
        <div style={{...s.label,marginBottom:8}}>Pricing</div>
        <h2 style={{fontFamily:"var(--mono)",fontSize:"clamp(22px,5vw,40px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:40}}>Two plans. <span style={{color:"var(--purple)"}}>No hidden costs.</span></h2>
        <div className="plan-grid">
          {[{name:"Exposure",price:49,features:["8-question adaptive diagnostic","Scored out of 100","All four domain scores","Monthly leakage estimate in £","Re-score every 30 days","Score history over time"],highlighted:false},{name:"Containment",price:99,features:["Everything in Exposure","Ranked priority action list","Stress test simulations","Per-intervention recovery estimate","Downloadable PDF report","Constrained revenue calculation"],highlighted:true}].map(plan=>(
            <div key={plan.name} style={{background:plan.highlighted?"var(--surface2)":"var(--surface)",padding:"32px 28px",border:plan.highlighted?"1px solid var(--border2)":"none"}}>
              {plan.highlighted&&<div style={{fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.2em",color:"var(--purple)",border:"1px solid var(--purple)",padding:"3px 8px",display:"inline-block",marginBottom:14}}>MOST COMPLETE</div>}
              <div style={{fontFamily:"var(--mono)",fontSize:18,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:6}}>{plan.name}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:44,fontWeight:700,lineHeight:1}}>£{plan.price}</div>
              <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",marginBottom:24}}>/month</div>
              <ul style={{listStyle:"none",marginBottom:28,display:"flex",flexDirection:"column",gap:10}}>
                {plan.features.map(f=><li key={f} style={{fontSize:13,color:"#aaa",display:"flex",gap:10,alignItems:"flex-start"}}><span style={{color:"var(--purple)",fontFamily:"var(--mono)",fontSize:11,marginTop:1,flexShrink:0}}>—</span>{f}</li>)}
              </ul>
              <Btn onClick={()=>setPage("signup")} variant={plan.highlighted?"primary":"outline"} style={{width:"100%",fontSize:12}}>Start for £1</Btn>
              <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",textAlign:"center",marginTop:10}}>7-day trial · then £{plan.price}/mo</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{background:"var(--surface)",borderTop:"1px solid var(--border)",borderBottom:"1px solid var(--border)",padding:"60px 20px",textAlign:"center"}}>
        <h2 style={{fontFamily:"var(--mono)",fontSize:"clamp(22px,5vw,40px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:12}}>8 questions.<br/><span style={{color:"var(--purple)"}}>Real answers.</span></h2>
        <p style={{color:"var(--muted)",marginBottom:32,fontSize:15,maxWidth:420,margin:"0 auto 32px"}}>No fluff. No upsell calls. Just your score, your leakage number, and what to fix — delivered in under 10 minutes.</p>
        <Btn onClick={()=>setPage("signup")} style={{width:"100%",maxWidth:320,fontSize:13}}>Get my Exposure Score →</Btn>
        <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",marginTop:14}}>£1 trial · 7 days · No commitment</div>
      </div>
      <footer style={{maxWidth:1200,margin:"0 auto",padding:"24px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",borderTop:"1px solid var(--border)"}}>
        <span style={{fontFamily:"var(--mono)",fontSize:12,fontWeight:700}}>Ops<span style={{color:"var(--purple)"}}>Exposure</span></span>
        <span style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)"}}>© 2026 OpsExposure</span>
      </footer>
    </div>
  );
}

function AuthPage({mode,setPage}){
  const{signUp,signIn}=useAuth();
  const[email,setEmail]=useState(""); const[password,setPassword]=useState(""); const[error,setError]=useState(""); const[loading,setLoading]=useState(false);
  const handle=async(e)=>{
    e.preventDefault();
    if(!email||!password){setError("Please fill in all fields.");return;}
    if(password.length<6){setError("Password must be at least 6 characters.");return;}
    setError("");setLoading(true);
    if(mode==="signup"){
      const{error:err}=await signUp(email,password);
      if(err){setError(err.message||"Sign up failed.");setLoading(false);return;}
      setPage("revenue-input");
    }else{
      const{error:err}=await signIn(email,password);
      if(err){setError("Incorrect email or password.");setLoading(false);return;}
      setPage("dashboard");
    }
    setLoading(false);
  };
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 20px 40px"}}>
      <div style={{...s.card,width:"100%",maxWidth:420,animation:"fadeUp 0.5s ease both"}}>
        <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.2em",textTransform:"uppercase",color:"var(--purple)",marginBottom:16}}>{mode==="signup"?"Create Account":"Sign In"}</div>
        <h1 style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,marginBottom:24}}>{mode==="signup"?"Start your diagnostic":"Welcome back"}</h1>
        {error&&<div style={{background:"rgba(192,38,211,0.1)",border:"1px solid var(--purple-critical)",color:"var(--purple-critical)",padding:"12px 16px",fontSize:13,marginBottom:16,lineHeight:1.5}}>{error}</div>}
        <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:16}}>
          <div><label style={s.label}>Email</label><input style={s.input} type="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/></div>
          <div><label style={s.label}>Password</label><input style={s.input} type="password" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"}/></div>
          <Btn style={{width:"100%",marginTop:8}} disabled={loading}>{loading?"Please wait…":mode==="signup"?"Create Account →":"Sign In →"}</Btn>
        </form>
        <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",textAlign:"center",marginTop:16}}>
          {mode==="signup"?<span>Already have an account? <span onClick={()=>setPage("login")} style={{color:"var(--purple)",cursor:"pointer"}}>Sign in</span></span>:<span>No account? <span onClick={()=>setPage("signup")} style={{color:"var(--purple)",cursor:"pointer"}}>Start for £1</span></span>}
        </div>
        {mode==="signup"&&<div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",textAlign:"center",marginTop:8}}>£1 for 7 days. Then £49 or £99/mo. Cancel anytime.</div>}
      </div>
    </div>
  );
}

function RevenueInputPage({setPage}){
  const{setRevenueInfo}=useStore();
  const[currency,setCurrency]=useState("GBP"),[revenue,setRevenue]=useState(""),[businessName,setBusinessName]=useState(""),[error,setError]=useState("");
  const handle=e=>{e.preventDefault();const r=parseFloat(revenue);if(!revenue||isNaN(r)||r<=0){setError("Please enter a valid monthly revenue.");return;}setRevenueInfo({currency,monthlyRevenue:r,businessName:businessName.trim()});setPage("diagnostic");};
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"80px 20px 40px"}}>
      <div style={{...s.card,width:"100%",maxWidth:480,animation:"fadeUp 0.5s ease both"}}>
        <div style={{...s.label,marginBottom:16}}>Step 1 of 2</div>
        <h1 style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,marginBottom:10}}>What's your monthly revenue?</h1>
        <p style={{color:"var(--muted)",fontSize:14,marginBottom:24,lineHeight:1.6}}>This anchors your leakage estimate to a real number. We don't store or share it.</p>
        {error&&<div style={{background:"rgba(192,38,211,0.1)",border:"1px solid var(--purple-critical)",color:"var(--purple-critical)",padding:"12px 16px",fontSize:13,marginBottom:16}}>{error}</div>}
        <form onSubmit={handle} style={{display:"flex",flexDirection:"column",gap:16}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:12}}>
            <div><label style={s.label}>Currency</label><select value={currency} onChange={e=>setCurrency(e.target.value)} style={s.input}><option value="GBP">£ GBP</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option></select></div>
            <div><label style={s.label}>Monthly Revenue</label><input style={s.input} type="number" min="1" placeholder="e.g. 85000" value={revenue} onChange={e=>setRevenue(e.target.value)} inputMode="numeric"/></div>
          </div>
          <div><label style={s.label}>Business Name (Optional)</label><input style={s.input} type="text" placeholder="Your business name" value={businessName} onChange={e=>setBusinessName(e.target.value)}/></div>
          <Btn style={{width:"100%",marginTop:8}}>Start Diagnostic →</Btn>
        </form>
      </div>
    </div>
  );
}

function DiagnosticPage({setPage}){
  const{setDiagnosticAnswers,setScores,isRescore}=useStore();
  const[activeQs,setActiveQs]=useState(()=>QUESTIONS.filter(q=>!q.isFollowUp));
  const[idx,setIdx]=useState(0),[answers,setAnswers]=useState([]),[loading,setLoading]=useState(false),[selected,setSelected]=useState(null);
  const q=activeQs[idx],progress=(idx/activeQs.length)*100;
  const handleSelect=opt=>{
    if(selected)return;setSelected(opt.label);
    const newAns=[...answers,{questionId:q.id,domain:q.domain,answer:opt.label,value:opt.value,isFollowUp:!!q.isFollowUp}];
    let newQs=[...activeQs];
    if(opt.triggerFollowUp){const alreadyHas=newAns.some(a=>a.domain===q.domain&&a.isFollowUp);if(!alreadyHas){const fu=QUESTIONS.find(qq=>qq.domain===q.domain&&qq.isFollowUp);if(fu)newQs.splice(idx+1,0,fu);}}
    setTimeout(()=>{setAnswers(newAns);setActiveQs(newQs);setSelected(null);if(idx<newQs.length-1)setIdx(i=>i+1);else setLoading(true);},300);
  };
  useEffect(()=>{if(!loading)return;const t=setTimeout(()=>{const sc=calculateScores(answers);setDiagnosticAnswers(answers);setScores({...sc,date:new Date().toISOString()});setPage("score-reveal");},3000);return()=>clearTimeout(t);},[loading]);
  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{textAlign:"center",maxWidth:360,width:"100%"}}>
        <h2 style={{fontFamily:"var(--mono)",fontSize:"clamp(15px,4vw,18px)",fontWeight:700,marginBottom:32,letterSpacing:"0.02em",lineHeight:1.4}}>Calculating your score…</h2>
        <div style={{height:2,background:"var(--border2)",overflow:"hidden"}}><div style={{height:"100%",background:"var(--purple)",animation:"loadFill 3s linear forwards"}}/></div>
        <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",marginTop:16,animation:"pulse 1.5s ease infinite"}}>RUNNING DIAGNOSTIC</div>
      </div>
    </div>
  );
  if(!q)return null;
  const domainColors={CAPTURE:"#818cf8",CONVERSION:"#a855f7",DELIVERY:"#c026d3",RETENTION:"#7c3aed"};
  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
      <div style={{position:"sticky",top:0,background:"var(--black)",borderBottom:"1px solid var(--border)",padding:"16px 20px",zIndex:10}}>
        <div style={{fontFamily:"var(--mono)",fontSize:10,letterSpacing:"0.12em",color:"var(--muted)",marginBottom:10}}>{isRescore?`RE-SCORE — ${new Date().toLocaleString("default",{month:"long",year:"numeric"}).toUpperCase()}`:`QUESTION ${idx+1} OF ${activeQs.length}`}</div>
        <div style={{height:2,background:"var(--border2)"}}><div style={{height:"100%",background:"var(--purple)",width:`${progress}%`,transition:"width 0.4s ease"}}/></div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"32px 20px 40px"}}>
        <div style={{width:"100%",maxWidth:560,animation:"fadeUp 0.4s ease both"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:10,fontWeight:700,letterSpacing:"0.2em",color:domainColors[q.domain],marginBottom:14,padding:"4px 10px",border:`1px solid ${domainColors[q.domain]}`,display:"inline-block"}}>{q.domain}</div>
          <h1 style={{fontFamily:"var(--mono)",fontSize:"clamp(17px,4vw,24px)",fontWeight:700,lineHeight:1.35,marginBottom:28}}>{q.text}</h1>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {q.options.map(opt=>(
              <button key={opt.label} onClick={()=>handleSelect(opt)} disabled={!!selected} style={{padding:"18px 16px",background:selected===opt.label?"rgba(124,58,237,0.2)":"var(--surface)",border:selected===opt.label?"1px solid var(--purple)":"1px solid var(--border2)",color:"var(--white)",fontFamily:"var(--sans)",fontSize:"clamp(14px,4vw,15px)",textAlign:"left",cursor:selected?"default":"pointer",transition:"all 0.2s",opacity:selected&&selected!==opt.label?0.5:1,minHeight:56,lineHeight:1.4,width:"100%"}}
              onMouseEnter={e=>{if(!selected){e.currentTarget.style.borderColor="var(--purple)";e.currentTarget.style.background="rgba(124,58,237,0.08)";}}}
              onMouseLeave={e=>{if(!selected&&selected!==opt.label){e.currentTarget.style.borderColor="var(--border2)";e.currentTarget.style.background="var(--surface)";}}}
              >{opt.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRevealPage({setPage}){
  const{scores,scoreHistory,currentPlan,isRescore,setIsRescore}=useStore();
  const[display,setDisplay]=useState(0),[showDetails,setShowDetails]=useState(false);
  useEffect(()=>{
    if(!scores){setPage("landing");return;}
    const target=scores.overall,dur=2000;let start=null;
    const step=ts=>{if(!start)start=ts;const p=Math.min((ts-start)/dur,1),ease=1-Math.pow(1-p,4);setDisplay(Math.floor(ease*target));if(p<1)requestAnimationFrame(step);else setShowDetails(true);};
    requestAnimationFrame(step);
  },[scores]);
  if(!scores)return null;
  const{label,color}=getStatus(scores.overall),ctx=getContext(scores.overall);
  let diff=null;
  if(isRescore&&scoreHistory.length>1){const prev=scoreHistory[scoreHistory.length-2].overall,d=scores.overall-prev;diff={text:d>0?`↑ +${d} from last month`:d<0?`↓ ${d} from last month`:"No change from last month",positive:d>=0};}
  return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{textAlign:"center",width:"100%",maxWidth:440,animation:"fadeUp 0.6s ease both"}}>
        <div style={{fontFamily:"var(--mono)",fontSize:"clamp(80px,22vw,140px)",fontWeight:700,lineHeight:1,color:"var(--white)",marginBottom:16}}>{display}</div>
        {showDetails&&(
          <div style={{animation:"fadeIn 0.5s ease both"}}>
            <div style={{fontFamily:"var(--mono)",fontSize:"clamp(10px,3vw,12px)",fontWeight:700,letterSpacing:"0.12em",color,border:`1px solid ${color}`,display:"inline-block",padding:"6px 14px",marginBottom:20}}>{label}</div>
            <p style={{color:"var(--muted)",maxWidth:360,margin:"0 auto 24px",fontSize:"clamp(14px,4vw,15px)",lineHeight:1.7}}>{ctx}</p>
            {diff&&<div style={{fontFamily:"var(--mono)",fontSize:12,color:diff.positive?"var(--green)":"var(--purple-critical)",marginBottom:24}}>{diff.text}</div>}
            <Btn onClick={()=>{setIsRescore(false);setPage(currentPlan?"dashboard":"plan-selection");}} style={{width:"100%",maxWidth:320,fontSize:13}}>See full breakdown →</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function PlanSelectionPage({setPage}){
  const{setCurrentPlan}=useStore();
  const plans=[{id:"exposure",name:"Exposure",price:49,stripeUrl:"https://buy.stripe.com/7sYcN46hYdRs8NC5vtejK04",features:["8-question adaptive diagnostic","Score out of 100","All four domain breakdowns","Monthly leakage estimate in £","Re-score every 30 days","Score history over time"],highlight:false},{id:"containment",name:"Containment",price:99,stripeUrl:"https://buy.stripe.com/7sY00i49QdRs8NC1fdejK03",features:["Everything in Exposure","Ranked priority action list","Stress test simulations","Recovery estimate per action","Downloadable PDF report","Constrained revenue calculation"],highlight:true}];

  const handleChoose = (plan) => {
    setCurrentPlan(plan.id);
    window.open(plan.stripeUrl, "_blank");
    setPage("dashboard");
  };

  return(
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px 40px"}}>
      <div style={{...s.label,marginBottom:12,textAlign:"center"}}>Choose your plan</div>
      <h1 style={{fontFamily:"var(--mono)",fontSize:"clamp(20px,5vw,36px)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:8,textAlign:"center"}}>Pick what you need. <span style={{color:"var(--purple)"}}>Cancel anytime.</span></h1>
      <p style={{color:"var(--muted)",marginBottom:32,fontSize:14,textAlign:"center"}}>£1 for 7 days on either plan. No contracts.</p>
      <div className="plan-grid">
        {plans.map(plan=>(
          <div key={plan.id} style={{background:plan.highlight?"var(--surface2)":"var(--surface)",padding:"28px 24px",border:plan.highlight?"1px solid var(--border2)":"none"}}>
            {plan.highlight&&<div style={{fontFamily:"var(--mono)",fontSize:9,letterSpacing:"0.2em",color:"var(--purple)",border:"1px solid var(--purple)",padding:"3px 8px",display:"inline-block",marginBottom:12}}>MOST COMPLETE</div>}
            <div style={{fontFamily:"var(--mono)",fontSize:17,fontWeight:700,textTransform:"uppercase",marginBottom:6}}>{plan.name}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:40,fontWeight:700,lineHeight:1}}>£{plan.price}</div>
            <div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",marginBottom:20}}>/month</div>
            <ul style={{listStyle:"none",marginBottom:24,display:"flex",flexDirection:"column",gap:10}}>
              {plan.features.map(f=><li key={f} style={{fontSize:13,color:"#aaa",display:"flex",gap:8,alignItems:"flex-start"}}><span style={{color:"var(--purple)",fontFamily:"var(--mono)",fontSize:10,flexShrink:0,marginTop:1}}>—</span>{f}</li>)}
            </ul>
            <Btn onClick={()=>handleChoose(plan)} variant={plan.highlight?"primary":"outline"} style={{width:"100%",fontSize:12}}>Start {plan.name} →</Btn>
            <div style={{fontFamily:"var(--mono)",fontSize:10,color:"var(--muted)",textAlign:"center",marginTop:10}}>£1 for 7 days · then £{plan.price}/mo</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage({setPage}){
  const{scores,scoreHistory,revenueInfo,currentPlan,diagnosticAnswers,setIsRescore}=useStore();
  if(!scores||!revenueInfo)return(<div style={{padding:"60px 20px",textAlign:"center"}}><p style={{color:"var(--muted)",marginBottom:20}}>No diagnostic data found.</p><Btn onClick={()=>setPage("revenue-input")} style={{width:"100%",maxWidth:300}}>Start Diagnostic</Btn></div>);
  const{label,color}=getStatus(scores.overall),sym=revenueInfo.currency==="GBP"?"£":revenueInfo.currency==="USD"?"$":"€",fmt=new Intl.NumberFormat(undefined,{maximumFractionDigits:0}),leak=calcLeakage(revenueInfo.monthlyRevenue,scores.overall);
  const domains=[{n:"CAPTURE",v:scores.capture},{n:"CONVERSION",v:scores.conversion},{n:"DELIVERY",v:scores.delivery},{n:"RETENTION",v:scores.retention}];
  const expF=getExposureFactors(diagnosticAnswers),stabF=getStabilityFactors(diagnosticAnswers);
  const daysSince=Math.floor((Date.now()-new Date(scores.date).getTime())/(1000*3600*24)),daysLeft=Math.max(0,28-daysSince);
  return(
    <div className="app-content">
      <div style={{maxWidth:900,margin:"0 auto",padding:"24px 20px"}}>
        <div className="account-header" style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,paddingBottom:20,borderBottom:"1px solid var(--border)"}}>
          <div><div style={{...s.label,marginBottom:4}}>Your Exposure Score</div><div style={{fontSize:12,color:"var(--muted)"}}>{new Intl.DateTimeFormat(undefined,{dateStyle:"medium"}).format(new Date(scores.date))}</div></div>
          {currentPlan==="containment"&&<Btn variant="outline" onClick={()=>{}} style={{fontSize:10,padding:"10px 16px",minHeight:40}}>Export PDF</Btn>}
        </div>
        <div style={{marginBottom:32,textAlign:"center",padding:"32px 0"}}>
          <div style={{fontFamily:"var(--mono)",fontSize:"clamp(72px,20vw,120px)",fontWeight:700,lineHeight:1}}>{scores.overall}</div>
          <div style={{fontFamily:"var(--mono)",fontSize:"clamp(10px,3vw,12px)",fontWeight:700,letterSpacing:"0.12em",color,border:`1px solid ${color}`,display:"inline-block",padding:"6px 14px",marginTop:12}}>{label}</div>
        </div>
        <div className="grid-2" style={{marginBottom:16}}>
          <div style={s.card}>
            <div style={{...s.label,marginBottom:18}}>Domain Breakdown</div>
            {domains.map(d=>(
              <div key={d.n} style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                <span style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)",width:80,flexShrink:0}}>{d.n}</span>
                <div style={{flex:1,height:3,background:"var(--border2)"}}><div style={{width:`${d.v}%`,height:"100%",background:d.v>75?"var(--green)":"var(--purple)",transition:"width 1s ease"}}/></div>
                <span style={{fontFamily:"var(--mono)",fontSize:11,width:28,textAlign:"right"}}>{d.v}</span>
              </div>
            ))}
          </div>
          <div style={s.card}>
            <div style={{...s.label,marginBottom:10}}>Est. Monthly Leakage</div>
            <div style={{fontFamily:"var(--mono)",fontSize:"clamp(20px,6vw,28px)",fontWeight:700,color:"var(--purple)",lineHeight:1,marginBottom:6}}>{sym}{fmt.format(leak.min)}<span style={{fontSize:14,color:"var(--muted)"}}> – </span>{sym}{fmt.format(leak.max)}</div>
            <div style={{fontSize:12,color:"var(--muted)",lineHeight:1.5}}>Based on {sym}{fmt.format(revenueInfo.monthlyRevenue)}/mo revenue</div>
          </div>
          <div style={s.card}>
            <div style={{...s.label,marginBottom:14}}>Where You're Exposed</div>
            <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10}}>{expF.map((f,i)=><li key={i} style={{fontSize:13,color:"#aaa",display:"flex",gap:8,alignItems:"flex-start",lineHeight:1.5}}><span style={{color:"var(--purple-critical)",fontFamily:"var(--mono)",fontSize:10,flexShrink:0,marginTop:2}}>▸</span>{f}</li>)}</ul>
          </div>
          <div style={s.card}>
            <div style={{...s.label,marginBottom:14}}>What's Working</div>
            <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:10}}>{stabF.map((f,i)=><li key={i} style={{fontSize:13,color:"#aaa",display:"flex",gap:8,alignItems:"flex-start",lineHeight:1.5}}><span style={{color:"var(--green)",fontFamily:"var(--mono)",fontSize:10,flexShrink:0,marginTop:2}}>▸</span>{f}</li>)}</ul>
          </div>
        </div>
        <div style={{...s.card,marginBottom:16}}>
          <div style={{...s.label,marginBottom:14}}>Score History</div>
          {scoreHistory.length>1?(<div style={{display:"flex",alignItems:"flex-end",gap:6,height:72}}>{scoreHistory.map((h,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}><div style={{fontFamily:"var(--mono)",fontSize:9,color:"var(--muted)"}}>{h.overall}</div><div style={{width:"100%",background:"var(--purple)",height:`${h.overall*0.6}px`,maxHeight:52,transition:"height 0.5s ease"}}/><div style={{fontFamily:"var(--mono)",fontSize:8,color:"var(--muted)"}}>#{i+1}</div></div>)}</div>):<p style={{color:"var(--muted)",fontSize:13}}>Score history will appear after your first re-score.</p>}
        </div>
        <div className="rescore-card" style={{...s.card,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><div style={{fontFamily:"var(--mono)",fontSize:12,fontWeight:700,marginBottom:4}}>Monthly Re-Score</div><div style={{fontSize:13,color:"var(--muted)"}}>{daysLeft>0?`Next re-score available in ${daysLeft} days.`:"Your re-score is ready. Run it now."}</div></div>
          <Btn disabled={daysLeft>0} onClick={()=>{setIsRescore(true);setPage("diagnostic");}} style={{flexShrink:0,whiteSpace:"nowrap"}}>Start Re-Score</Btn>
        </div>
        {scores.overall<60&&currentPlan==="containment"&&(
          <div style={{...s.card,border:"1px solid var(--border2)"}}>
            <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.7,marginBottom:12}}>At this score, some businesses choose to work directly with a specialist rather than fix it alone. If that's relevant, here's what that looks like.</p>
            <a href="#specialist" style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--purple)",textDecoration:"none",letterSpacing:"0.08em"}}>See what's involved →</a>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionsPage({setPage}){
  const{currentPlan,diagnosticAnswers,revenueInfo,scores}=useStore();
  if(currentPlan==="exposure")return <LockedPage feature="Priority Actions" setPage={setPage}/>;
  if(!scores||!revenueInfo)return <div style={{padding:"60px 20px",color:"var(--muted)"}}>No data. Complete diagnostic first.</div>;
  const sym=revenueInfo.currency==="GBP"?"£":revenueInfo.currency==="USD"?"$":"€",fmt=new Intl.NumberFormat(undefined,{maximumFractionDigits:0}),actions=getPriorityActions(diagnosticAnswers,revenueInfo.monthlyRevenue,scores);
  return(
    <div className="app-content"><div style={{maxWidth:800,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{...s.label,marginBottom:6}}>Containment Plan</div>
      <h1 style={{fontFamily:"var(--mono)",fontSize:"clamp(20px,5vw,32px)",fontWeight:700,marginBottom:28}}>Priority Actions</h1>
      <div style={{display:"flex",flexDirection:"column",gap:1,background:"var(--border)"}}>
        {actions.length===0&&<div style={{background:"var(--surface)",padding:28,color:"var(--muted)",fontSize:13}}>No critical actions identified. Your operations are performing well.</div>}
        {actions.map((act,i)=>(
          <div key={act.id} style={{background:"var(--surface)",padding:"20px",display:"grid",gridTemplateColumns:"44px 1fr",gap:16}}>
            <div style={{fontFamily:"var(--mono)",fontSize:24,fontWeight:700,color:"var(--border2)",lineHeight:1}}>{(i+1).toString().padStart(2,"0")}</div>
            <div>
              <div style={{fontFamily:"var(--mono)",fontSize:9,fontWeight:700,letterSpacing:"0.15em",color:"var(--purple)",marginBottom:6}}>{act.domain}</div>
              <h3 style={{fontFamily:"var(--mono)",fontSize:"clamp(12px,3vw,14px)",fontWeight:700,marginBottom:6,lineHeight:1.4}}>{act.title}</h3>
              <p style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,marginBottom:10}}>{act.desc}</p>
              <div style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--green)"}}>Est. {sym}{fmt.format(act.recovery.min)}–{sym}{fmt.format(act.recovery.max)}/month</div>
            </div>
          </div>
        ))}
      </div>
    </div></div>
  );
}

function StressTestPage({setPage}){
  const{currentPlan,scores,revenueInfo}=useStore();
  if(currentPlan==="exposure")return <LockedPage feature="Stress Simulations" setPage={setPage}/>;
  if(!scores||!revenueInfo)return <div style={{padding:"60px 20px",color:"var(--muted)"}}>No data. Complete diagnostic first.</div>;
  const[result,setResult]=useState(null),sym=revenueInfo.currency==="GBP"?"£":revenueInfo.currency==="USD"?"$":"€",fmt=new Intl.NumberFormat(undefined,{maximumFractionDigits:0});
  const scenarios=[{id:"s1",title:"Key person dependency",desc:"What if your highest-performing team member left tomorrow?",run:()=>({newScore:Math.max(0,scores.overall-17),rev:revenueInfo.monthlyRevenue})},{id:"s2",title:"Pipeline dries up",desc:"What if inbound enquiries dropped 40% for 90 days?",run:()=>({newScore:Math.max(0,scores.overall-19),rev:revenueInfo.monthlyRevenue})},{id:"s3",title:"Client concentration",desc:"What if your top client (30% of revenue) churned?",run:()=>({newScore:Math.max(0,scores.overall-22),rev:revenueInfo.monthlyRevenue*0.7})}];
  return(
    <div className="app-content"><div style={{maxWidth:800,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{...s.label,marginBottom:6}}>Containment Plan</div>
      <h1 style={{fontFamily:"var(--mono)",fontSize:"clamp(20px,5vw,32px)",fontWeight:700,marginBottom:6}}>Stress Simulations</h1>
      <p style={{color:"var(--muted)",fontSize:14,marginBottom:28,lineHeight:1.6}}>See how your score and leakage change under three common failure scenarios.</p>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {scenarios.map(sc=>(
          <div key={sc.id} className="stress-card" style={{...s.card,display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:200}}><h3 style={{fontFamily:"var(--mono)",fontSize:"clamp(12px,3vw,14px)",fontWeight:700,marginBottom:6,lineHeight:1.3}}>{sc.title}</h3><p style={{fontSize:13,color:"var(--muted)",lineHeight:1.6}}>{sc.desc}</p></div>
            {result?.id===sc.id?(<div style={{flexShrink:0}}><div style={{fontFamily:"var(--mono)",fontSize:12,marginBottom:4}}><span style={{textDecoration:"line-through",color:"var(--muted)"}}>{scores.overall}</span><span style={{color:"var(--purple-critical)",marginLeft:8}}>→ {result.newScore}</span></div><div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)"}}>{sym}{fmt.format(result.leak.min)}–{sym}{fmt.format(result.leak.max)}/mo</div></div>):(<Btn variant="outline" onClick={()=>{const r=sc.run();setResult({id:sc.id,newScore:r.newScore,leak:calcLeakage(r.rev,r.newScore)});}} style={{flexShrink:0,fontSize:10,padding:"12px 16px",minHeight:44}}>Run Simulation</Btn>)}
          </div>
        ))}
      </div>
    </div></div>
  );
}

function AccountPage({setPage}){
  const{currentPlan,clearAll}=useStore(),{user,signOut}=useAuth(),[showCancel,setShowCancel]=useState(false);
  const handleSignOut=async()=>{clearAll();await signOut();setPage("landing");};
  return(
    <div className="app-content"><div style={{maxWidth:700,margin:"0 auto",padding:"24px 20px"}}>
      <h1 style={{fontFamily:"var(--mono)",fontSize:"clamp(20px,5vw,32px)",fontWeight:700,marginBottom:28}}>Account Settings</h1>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div style={s.card}>
          <div style={{...s.label,marginBottom:14}}>Account</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18,gap:12}}><span style={{color:"var(--muted)",fontSize:13}}>Email</span><span style={{fontSize:13,wordBreak:"break-all",textAlign:"right"}}>{user?.email||"—"}</span></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            <Btn variant="outline" style={{fontSize:10,padding:"10px 16px",minHeight:44}}>Change Password</Btn>
            <Btn onClick={handleSignOut} style={{fontSize:10,padding:"10px 16px",minHeight:44,background:"transparent",border:"1px solid var(--border2)",color:"var(--muted)"}}>Sign Out</Btn>
          </div>
        </div>
        <div style={s.card}>
          <div style={{...s.label,marginBottom:14}}>Plan</div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,gap:12,flexWrap:"wrap"}}><span style={{color:"var(--muted)",fontSize:13}}>Current Plan</span><span style={{fontFamily:"var(--mono)",fontSize:12,color:"var(--purple)"}}>{currentPlan==="containment"?"CONTAINMENT — £99/mo":currentPlan==="exposure"?"EXPOSURE — £49/mo":"None"}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:18,gap:12}}><span style={{color:"var(--muted)",fontSize:13}}>Next billing</span><span style={{fontSize:13}}>{new Date(Date.now()+28*24*60*60*1000).toLocaleDateString()}</span></div>
          {currentPlan==="exposure"&&<Btn onClick={()=>setPage("plan-selection")} style={{width:"100%",fontSize:11}}>Upgrade to Containment</Btn>}
        </div>
        <div style={s.card}>
          <div style={{...s.label,marginBottom:10}}>Billing</div>
          <p style={{fontSize:13,color:"var(--muted)",marginBottom:14,lineHeight:1.6}}>Update your card or download invoices via the Stripe billing portal.</p>
          <Btn variant="outline" style={{fontSize:10,padding:"10px 16px",minHeight:44}}>Manage Billing</Btn>
        </div>
        <div style={{...s.card,border:"1px solid rgba(192,38,211,0.2)"}}>
          <div style={{...s.label,color:"var(--purple-critical)",marginBottom:10}}>Danger Zone</div>
          <p style={{fontSize:13,color:"var(--muted)",marginBottom:14,lineHeight:1.6}}>Cancel your subscription. Access stops immediately. Data deleted after 30 days.</p>
          <Btn onClick={()=>setShowCancel(true)} style={{background:"rgba(192,38,211,0.15)",border:"1px solid var(--purple-critical)",color:"var(--purple-critical)",fontSize:10,padding:"10px 16px",minHeight:44}}>Cancel Subscription</Btn>
        </div>
      </div>
      {showCancel&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:200}}>
          <div style={{...s.card,width:"100%",maxWidth:480,animation:"fadeUp 0.3s ease both",borderBottom:"none"}}>
            <h2 style={{fontFamily:"var(--mono)",fontSize:17,fontWeight:700,marginBottom:12}}>Cancel subscription</h2>
            <p style={{fontSize:14,color:"var(--muted)",marginBottom:24,lineHeight:1.6}}>You'll lose access immediately. Your score history is kept for 30 days then deleted.</p>
            <div style={{display:"flex",gap:10,flexDirection:"column"}}>
              <Btn onClick={()=>{clearAll();setShowCancel(false);setPage("landing");}} style={{width:"100%",background:"var(--purple-critical)",fontSize:12}}>Confirm Cancellation</Btn>
              <Btn variant="outline" onClick={()=>setShowCancel(false)} style={{width:"100%",fontSize:12}}>Keep Active</Btn>
            </div>
          </div>
        </div>
      )}
    </div></div>
  );
}

function LockedPage({feature,setPage}){
  return(
    <div className="app-content" style={{minHeight:"80vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",maxWidth:320,padding:"40px 20px"}}>
        <div style={{fontSize:32,marginBottom:20}}>🔒</div>
        <h2 style={{fontFamily:"var(--mono)",fontSize:17,fontWeight:700,marginBottom:12}}>{feature} Locked</h2>
        <p style={{color:"var(--muted)",fontSize:14,marginBottom:24,lineHeight:1.6}}>This is only available on the Containment plan at £99/mo.</p>
        <Btn onClick={()=>setPage("plan-selection")} style={{width:"100%",fontSize:12}}>Upgrade to Containment →</Btn>
      </div>
    </div>
  );
}

function AppInner(){
  const{user,authLoading}=useAuth();
  const[page,setPage]=useState("landing");
  useEffect(()=>{
    if(!authLoading&&user&&["landing","signup","login"].includes(page))setPage("dashboard");
    if(!authLoading&&!user&&["dashboard","actions","stress-test","account","revenue-input","diagnostic","score-reveal","plan-selection"].includes(page))setPage("landing");
  },[user,authLoading]);
  if(authLoading)return(<div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--black)"}}><div style={{fontFamily:"var(--mono)",fontSize:11,color:"var(--muted)",letterSpacing:"0.15em",animation:"pulse 1.5s ease infinite"}}>LOADING</div></div>);
  return(<>
    <Nav page={page} setPage={setPage}/>
    <div>
      {page==="landing"&&<LandingPage setPage={setPage}/>}
      {page==="signup"&&<AuthPage mode="signup" setPage={setPage}/>}
      {page==="login"&&<AuthPage mode="login" setPage={setPage}/>}
      {page==="revenue-input"&&<RevenueInputPage setPage={setPage}/>}
      {page==="diagnostic"&&<DiagnosticPage setPage={setPage}/>}
      {page==="score-reveal"&&<ScoreRevealPage setPage={setPage}/>}
      {page==="plan-selection"&&<PlanSelectionPage setPage={setPage}/>}
      {page==="dashboard"&&<DashboardPage setPage={setPage}/>}
      {page==="actions"&&<ActionsPage setPage={setPage}/>}
      {page==="stress-test"&&<StressTestPage setPage={setPage}/>}
      {page==="account"&&<AccountPage setPage={setPage}/>}
    </div>
  </>);
}

export default function App(){
  return(
    <AuthProvider>
      <StoreProvider>
        <style>{globalStyles}</style>
        <AppInner/>
      </StoreProvider>
    </AuthProvider>
  );
}
