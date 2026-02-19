import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  PiggyBank, ArrowRight, CheckCircle2, Lock, Star, Coins, 
  XCircle, Trophy, Settings, Save, Edit3 as LucideEdit, Delete,
  ChevronRight, Wallet, GraduationCap, LayoutDashboard,
  Sparkles, ShieldCheck, Zap, Globe, Rocket
} from 'lucide-react';

// --- ROBUST ENVIRONMENT ACCESS ---
// We avoid using "typeof import" which causes syntax errors in some parsers
const getEnvVar = (key, defaultValue = "") => {
  try {
    // Vite replaces import.meta.env during build. 
    // We use a optional chaining and a direct check to stay compatible.
    const env = import.meta.env;
    if (env && env[key]) {
      return env[key];
    }
  } catch (e) {
    // Fallback if import.meta is not supported by the environment
  }
  return defaultValue;
};

// --- FIREBASE INITIALIZATION ---
const firebaseConfigString = getEnvVar('VITE_FIREBASE_CONFIG');
const firebaseConfig = firebaseConfigString ? JSON.parse(firebaseConfigString) : {
  apiKey: "AIzaSyA1KB6IV86yS1rdzOTlZ_j8THl6MvaR7Uk",
  authDomain: "juniorsavers2026.firebaseapp.com",
  projectId: "juniorsavers2026",
  storageBucket: "juniorsavers2026.firebasestorage.app",
  messagingSenderId: "361890411853",
  appId: "1:361890411853:web:4128a6ee6314129443f304",
  measurementId: "G-V60WSD8XJF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rawAppId = getEnvVar('VITE_APP_ID', 'junior-savers-production-v3');
const appId = rawAppId.replace(/[^a-zA-Z0-9]/g, '_'); 

// --- STYLED COMPONENTS ---
const PinKeypad = ({ title, subtitle, pinInput, onPinInput, onBackspace, pinError, onCancel, mode = 'verify' }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-8 min-h-screen bg-slate-900 text-white animate-in fade-in zoom-in duration-500">
    <div className="text-center">
      <div className="bg-indigo-500 p-6 rounded-3xl inline-block mb-6 shadow-2xl shadow-indigo-500/40">
        <Lock className="text-white" size={40} />
      </div>
      <h2 className="text-4xl font-black tracking-tight">{title}</h2>
      <p className="text-xs text-indigo-300 font-bold uppercase tracking-[0.3em] mt-3 opacity-80">{subtitle}</p>
    </div>
    
    <div className="flex gap-5">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`w-6 h-6 rounded-full border-4 transition-all duration-300 ${pinInput.length > i ? 'bg-indigo-400 border-indigo-200 scale-125 shadow-[0_0_15px_rgba(129,140,248,0.8)]' : 'border-slate-700'} ${pinError ? 'bg-rose-500 border-rose-300 animate-bounce' : ''}`} />
      ))}
    </div>

    <div className="grid grid-cols-3 gap-5 w-full max-w-[360px]">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0].map((num, i) => (
        num !== "" ? (
          <button key={i} onClick={() => onPinInput(num.toString())} className="h-24 rounded-[2rem] bg-slate-800 text-3xl font-black text-white shadow-xl hover:bg-indigo-600 active:scale-95 transition-all border border-slate-700/50">{num}</button>
        ) : <div key={i} />
      ))}
      <button onClick={onBackspace} className="h-24 rounded-[2rem] bg-slate-800 flex items-center justify-center text-slate-500 hover:text-rose-400 active:scale-95 transition-colors border border-slate-700/50"><Delete size={32} /></button>
    </div>
    {mode === 'verify' && <button onClick={onCancel} className="text-sm font-black text-slate-500 hover:text-white transition-colors uppercase tracking-[0.4em] mt-6">Exit Safe Mode</button>}
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [grade, setGrade] = useState(null);
  const [adminGrade, setAdminGrade] = useState(1);
  const [activeLesson, setActiveLesson] = useState(null);
  const [profile, setProfile] = useState({ balance: 0, xp: 0, completedLessons: [], parentPin: "", parentContact: "", grade: null });
  const [localCurriculum, setLocalCurriculum] = useState({});
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  const generateInitialData = () => {
    const data = {};
    const gradeThemes = {
      1: { theme: "My First Kwacha", lessons: [
        { title: "What is money?", desc: "Money is a tool used to buy things we need and want. We earn it by helping others." },
        { title: "Meeting the Ngwee", desc: "Learn about the shiny coins! 5n, 10n, and 50n are part of our Kwacha." },
        { title: "The Fish Eagle (K1)", desc: "The K1 coin has a beautiful Fish Eagle. It's our national bird!" },
        { title: "The Leopard (K2)", desc: "Identify the spotted leopard on the K2 coin." },
        { title: "The Lion (K5)", desc: "The biggest coin has the King of the Jungle!" }
      ]},
      2: { theme: "Needs vs Wants", lessons: [
        { title: "The Must-Haves", desc: "Needs are things we MUST have to live, like water, food, and a home." },
        { title: "The Fun-Haves", desc: "Wants are things we like but don't need to survive, like sweets or new toys." },
        { title: "Mealie Meal vs Snacks", desc: "Why we buy the basics before the treats." },
        { title: "Choosing Shelter", desc: "A roof over our heads is one of our most important needs." }
      ]},
      3: { theme: "Working to Earn", lessons: [
        { title: "Adult Careers", desc: "Explore jobs in Zambia like Farmers, Teachers, and Miners." },
        { title: "Mining Copper", desc: "Zambia is famous for copper! Miners work hard to dig it up." },
        { title: "Market Traders", desc: "Traders earn by selling goods at the market." }
      ]}
    };

    for (let g = 1; g <= 12; g++) {
      const themeInfo = gradeThemes[g] || { theme: `Financial Mastery G${g}`, lessons: [] };
      data[g] = [...Array(40)].map((_, i) => {
        const specificLesson = themeInfo.lessons[i];
        return {
          id: `g${g}w${i+1}`,
          title: specificLesson ? specificLesson.title : `${themeInfo.theme} - Week ${i+1}`,
          desc: specificLesson ? specificLesson.desc : `Deep dive into ${themeInfo.theme}. Complete this week's challenge to grow your vault!`,
          reward: 10 + (g * 5)
        };
      });
    }
    return data;
  };

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error("Auth Failure:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const profileDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    const unsubProfile = onSnapshot(profileDoc, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setProfile(prev => ({ ...prev, ...data }));
        if (data.grade) setGrade(data.grade);
        if (data.parentPin && view === 'landing') setView('dashboard');
      }
    });
    const curDoc = doc(db, 'artifacts', appId, 'public', 'data', 'curriculum', 'master');
    const unsubCur = onSnapshot(curDoc, (docSnap) => {
      if (docSnap.exists()) {
        const cloudData = docSnap.data().data;
        if (cloudData) setLocalCurriculum(cloudData);
      } else { setLocalCurriculum(generateInitialData()); }
    });
    return () => { unsubProfile(); unsubCur(); };
  }, [user, view]);

  const saveProfile = async (updates) => {
    if (!user) return;
    const profileDoc = doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'main');
    await setDoc(profileDoc, updates, { merge: true });
  };

  const deployCurriculum = async () => {
    if (!user) return;
    const curDoc = doc(db, 'artifacts', appId, 'public', 'data', 'curriculum', 'master');
    await setDoc(curDoc, { data: localCurriculum });
    setView('dashboard');
  };

  const handlePinInput = (num) => {
    if (pinInput.length < 4) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      if (newPin.length === 4) {
        if (view === 'consent-pin') {
          saveProfile({ parentPin: newPin, parentContact: profile.parentContact, grade });
          setView('dashboard');
          setPinInput("");
        } else if (newPin === profile.parentPin) {
          setShowPinGate(false);
          setPinInput("");
          if (typeof pendingAction === 'function') { pendingAction(); setPendingAction(null); }
        } else {
          setPinError(true);
          setTimeout(() => { setPinInput(""); setPinError(false); }, 1000);
        }
      }
    }
  };

  if (!user) return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-indigo-700 text-white space-y-8 overflow-hidden">
      <div className="relative">
        <div className="absolute inset-0 bg-white/30 blur-[100px] animate-pulse rounded-full" />
        <PiggyBank size={120} className="animate-bounce relative z-10" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-4xl font-black tracking-tighter uppercase italic">Opening Vault</h2>
        <div className="flex justify-center gap-1">
          <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#0F172A] flex items-center justify-center p-0 md:p-8 lg:p-12 font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      {/* Container that acts as "Full Screen" for Laptop but is responsive */}
      <div className="w-full h-full md:max-w-7xl md:min-h-[90vh] bg-white md:rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden relative border-8 border-slate-900/5">
        
        {showPinGate && (
          <div className="fixed inset-0 z-[100] md:absolute">
            <PinKeypad 
              title="Parental Security" 
              subtitle="Enter PIN to unlock admin controls" 
              pinInput={pinInput}
              onPinInput={handlePinInput}
              onBackspace={() => setPinInput(p => p.slice(0, -1))}
              pinError={pinError}
              onCancel={() => setShowPinGate(false)}
            />
          </div>
        )}

        {view === 'landing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in zoom-in duration-1000 bg-gradient-to-b from-white to-slate-50">
            <div className="relative mb-16">
              <div className="absolute inset-0 bg-emerald-400 blur-[120px] opacity-30 rounded-full animate-pulse" />
              <div className="bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-700 p-16 rounded-[5rem] rotate-6 shadow-[0_30px_60px_-15px_rgba(16,185,129,0.5)] relative border-8 border-white group hover:rotate-0 transition-all duration-700 ease-out">
                <PiggyBank size={140} className="text-white drop-shadow-2xl" />
                <div className="absolute -top-4 -right-4 bg-yellow-400 p-4 rounded-full shadow-lg animate-bounce border-4 border-white">
                    <Sparkles size={32} className="text-yellow-800" />
                </div>
              </div>
            </div>
            <h1 className="text-7xl md:text-9xl font-black text-slate-900 tracking-tighter leading-[0.85] mb-8">Junior<br/><span className="text-emerald-600">Savers</span></h1>
            <p className="text-slate-400 font-black uppercase text-sm tracking-[0.8em] mb-16 flex items-center gap-4">
               <span className="h-[2px] w-8 bg-slate-200"/> Tassel & Claws <span className="h-[2px] w-8 bg-slate-200"/>
            </p>
            <button onClick={() => setView('grade-select')} className="group w-full max-w-lg bg-slate-900 text-white py-10 rounded-[3.5rem] text-4xl font-black shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] hover:bg-emerald-600 transition-all duration-500 flex items-center justify-center gap-6 active:scale-95 border-b-8 border-slate-950 hover:border-emerald-800">
              Launch Journey <Rocket size={40} className="group-hover:translate-x-3 group-hover:-translate-y-3 transition-transform" />
            </button>
          </div>
        )}

        {view === 'grade-select' && (
          <div className="p-12 md:p-24 space-y-16 flex-1 flex flex-col animate-in fade-in slide-in-from-right-12 duration-700 bg-white">
            <div className="text-center">
              <h2 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tight leading-none mb-6">Which Grade?</h2>
              <div className="h-2 w-32 bg-emerald-500 mx-auto rounded-full mb-4" />
              <p className="text-slate-400 font-bold uppercase text-sm tracking-[0.4em]">Select your current school year</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-8 flex-1">
              {[...Array(12)].map((_, i) => (
                <button key={i} onClick={() => { setGrade(i + 1); setView('consent'); }} className="group aspect-square bg-slate-50 border-4 border-transparent rounded-[3.5rem] flex flex-col items-center justify-center hover:bg-emerald-500 hover:border-emerald-200 hover:shadow-[0_20px_40px_rgba(16,185,129,0.3)] transition-all duration-300 active:scale-90">
                  <span className="text-xs font-black text-slate-300 uppercase mb-2 group-hover:text-emerald-100 tracking-widest">Grade</span>
                  <span className="text-7xl font-black text-slate-800 group-hover:text-white group-hover:scale-110 transition-all">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'consent' && (
          <div className="p-12 md:p-24 space-y-12 flex-1 flex flex-col justify-center max-w-3xl mx-auto w-full animate-in zoom-in duration-700">
            <div className="bg-indigo-600 p-16 rounded-[5rem] text-white relative overflow-hidden shadow-[0_40px_80px_-15px_rgba(79,70,229,0.4)] border-b-[16px] border-indigo-900">
              <ShieldCheck size={260} className="absolute -right-16 -top-16 opacity-10 rotate-12" />
              <h2 className="text-6xl font-black mb-6 leading-tight tracking-tighter">Security Pass</h2>
              <p className="text-indigo-100 font-bold text-2xl leading-relaxed opacity-90 italic underline decoration-indigo-400 underline-offset-8">A guardian is required to link this account for safety.</p>
            </div>
            <div className="space-y-6">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.5em] ml-12">Parent Email / Phone Number</label>
              <input 
                type="text" 
                placeholder="guardian@example.com" 
                className="w-full px-12 py-10 bg-slate-100 border-8 border-slate-50 rounded-[4rem] font-black text-3xl outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner placeholder:text-slate-300"
                value={profile.parentContact}
                onChange={(e) => setProfile(prev => ({...prev, parentContact: e.target.value}))}
              />
            </div>
            <button onClick={() => setView('consent-pin')} className="w-full bg-indigo-600 text-white py-10 rounded-[4rem] text-4xl font-black shadow-2xl hover:bg-indigo-700 active:scale-95 transition-all border-b-8 border-indigo-950">Create Admin PIN</button>
          </div>
        )}

        {view === 'consent-pin' && <div className="flex-1"><PinKeypad title="Secure Access" subtitle="4 Digits for Parents Only" mode="setup" pinInput={pinInput} onPinInput={handlePinInput} onBackspace={() => setPinInput(p => p.slice(0, -1))} pinError={pinError} /></div>}

        {view === 'dashboard' && (
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden animate-in fade-in duration-1000">
            {/* Sidebar (Full Screen Height Sidebar) */}
            <div className="hidden md:flex w-96 bg-slate-900 flex-col p-12 space-y-12 border-r border-white/5">
               <div className="flex items-center gap-6 text-white mb-16">
                 <div className="bg-emerald-500 p-5 rounded-[2rem] shadow-[0_15px_30px_rgba(16,185,129,0.4)] rotate-6"><PiggyBank size={48}/></div>
                 <div className="font-black text-3xl tracking-tighter leading-[0.8] italic">Junior<br/><span className="text-emerald-500">Savers</span></div>
               </div>
               <div className="space-y-6 flex-1">
                  <button onClick={() => setView('dashboard')} className="flex items-center gap-6 text-emerald-400 font-black text-2xl w-full p-6 bg-white/5 rounded-[2.5rem] border border-white/10 shadow-2xl"><LayoutDashboard size={32}/>Home</button>
                  <button className="flex items-center gap-6 text-slate-500 font-black text-2xl w-full p-6 hover:text-white transition-all hover:translate-x-4"><GraduationCap size={32}/>Lessons</button>
                  <button className="flex items-center gap-6 text-slate-500 font-black text-2xl w-full p-6 hover:text-white transition-all hover:translate-x-4"><Wallet size={32}/>My Vault</button>
                  <button className="flex items-center gap-6 text-slate-500 font-black text-2xl w-full p-6 hover:text-white transition-all hover:translate-x-4"><Trophy size={32}/>Leaderboard</button>
               </div>
               <button onClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="flex items-center gap-6 text-slate-600 font-black text-2xl w-full p-6 hover:text-rose-400 transition-colors border-t border-white/5 pt-12"><Settings size={32}/>Settings</button>
            </div>

            {/* Mobile Nav Bar */}
            <div className="md:hidden p-8 bg-white border-b-4 border-slate-50 flex justify-between items-center sticky top-0 z-50">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-600 p-4 rounded-3xl text-white shadow-lg shadow-emerald-600/30"><PiggyBank size={32} /></div>
                <div>
                   <h2 className="text-2xl font-black leading-none">Grade {profile.grade || grade}</h2>
                   <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Active Saver</p>
                </div>
              </div>
              <button onClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="p-4 bg-slate-100 rounded-[1.5rem] text-slate-400 shadow-sm"><Settings size={28} /></button>
            </div>

            {/* Main Content Area (Full Layout) */}
            <div className="flex-1 p-8 md:p-20 space-y-16 overflow-y-auto bg-slate-50/50">
              {activeLesson ? (
                <div className="fixed inset-0 z-[110] bg-white md:relative md:rounded-[5rem] p-12 md:p-20 space-y-12 flex flex-col animate-in slide-in-from-bottom duration-700 shadow-2xl border-4 border-slate-50">
                  <div className="flex justify-between items-center">
                    <span className="bg-indigo-600 text-white text-xs font-black px-8 py-3 rounded-full uppercase tracking-[0.3em] shadow-xl flex items-center gap-3"><Sparkles size={20} className="animate-spin-slow"/> Current Module</span>
                    <button onClick={() => setActiveLesson(null)} className="p-5 bg-slate-100 rounded-[2rem] hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm"><XCircle size={48} /></button>
                  </div>
                  <h2 className="text-6xl md:text-8xl font-black text-slate-900 leading-[0.9] tracking-tighter">{activeLesson.title}</h2>
                  <div className="flex-1 bg-white rounded-[4rem] p-12 md:p-16 space-y-10 overflow-y-auto border-8 border-slate-50 shadow-inner">
                    <p className="text-3xl md:text-4xl leading-relaxed font-bold text-slate-600 selection:bg-yellow-200">{activeLesson.desc}</p>
                    <div className="h-64 bg-gradient-to-br from-indigo-100 via-white to-emerald-100 rounded-[4rem] flex items-center justify-center border-4 border-indigo-50 relative overflow-hidden group">
                        <Trophy size={140} className="text-emerald-500 opacity-20 group-hover:scale-125 transition-transform duration-1000" />
                        <div className="absolute inset-0 bg-white/10 blur-xl group-hover:bg-white/0 transition-all"/>
                    </div>
                  </div>
                  <button onClick={() => {
                    if (!profile.completedLessons.includes(activeLesson.id)) {
                      saveProfile({ balance: profile.balance + activeLesson.reward, xp: profile.xp + activeLesson.reward, completedLessons: [...profile.completedLessons, activeLesson.id] });
                    }
                    setActiveLesson(null);
                  }} className="w-full bg-emerald-600 text-white py-10 rounded-[4rem] text-4xl font-black shadow-[0_25px_50px_rgba(16,185,129,0.4)] hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-6 border-b-[12px] border-emerald-900">
                    Mission Complete! <Zap size={40} className="fill-current" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <h2 className="text-7xl font-black text-slate-900 tracking-tighter leading-none mb-4">Hello, Saver! 👋</h2>
                    <p className="text-indigo-600 font-black uppercase text-lg tracking-[0.4em] px-2 italic">Ready for Grade {profile.grade || grade} Excellence?</p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-white p-12 rounded-[4.5rem] border-8 border-slate-50 shadow-2xl flex items-center gap-10 group hover:-translate-y-2 transition-all duration-500 overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"/>
                      <div className="bg-amber-100 p-8 rounded-[2.5rem] group-hover:bg-amber-500 transition-colors shadow-lg"><Coins className="text-amber-600 group-hover:text-white" size={56} /></div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">Savings Vault</p>
                         <p className="text-5xl font-black text-slate-900 tracking-tighter">K{profile.balance}</p>
                      </div>
                    </div>
                    <div className="bg-white p-12 rounded-[4.5rem] border-8 border-slate-50 shadow-2xl flex items-center gap-10 group hover:-translate-y-2 transition-all duration-500 overflow-hidden relative">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50"/>
                      <div className="bg-indigo-100 p-8 rounded-[2.5rem] group-hover:bg-indigo-500 transition-colors shadow-lg"><Star className="text-indigo-600 group-hover:text-white" size={56} /></div>
                      <div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-1">XP Level</p>
                         <p className="text-5xl font-black text-slate-900 tracking-tighter">{profile.xp}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-12">
                    <div className="flex items-center gap-10 px-6">
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.6em] flex-shrink-0">Weekly Roadmap</h3>
                      <div className="h-2 flex-1 bg-slate-100 rounded-full shadow-inner" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      {(localCurriculum[profile.grade || grade] || []).slice(0, 10).map((task, idx) => {
                        const isDone = profile.completedLessons.includes(task.id);
                        return (
                          <div key={task.id} className={`p-12 rounded-[5rem] border-8 transition-all duration-500 relative group overflow-hidden ${isDone ? 'bg-emerald-50 border-emerald-100 shadow-inner' : 'bg-white border-slate-50 hover:border-emerald-300 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] hover:shadow-[0_30px_60px_-15px_rgba(16,185,129,0.2)] hover:-translate-y-4'}`}>
                            <div className="flex justify-between items-start mb-8">
                              <span className={`text-[11px] font-black px-6 py-2 rounded-full uppercase tracking-tighter shadow-sm ${isDone ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-600'}`}>Week {idx+1}</span>
                              {isDone ? <CheckCircle2 className="text-emerald-500" size={48} /> : <div className="w-12 h-12 rounded-full border-8 border-slate-50 group-hover:border-emerald-100 transition-colors"/>}
                            </div>
                            <h4 className={`font-black text-4xl tracking-tight mb-4 leading-none ${isDone ? 'text-emerald-900' : 'text-slate-800 group-hover:text-emerald-900 transition-colors'}`}>{task.title}</h4>
                            <p className="text-xs text-slate-400 font-bold mb-10 tracking-widest uppercase opacity-60">Unlock {task.reward} Experience Points</p>
                            {!isDone && (
                              <button onClick={() => setActiveLesson(task)} className="w-full bg-slate-900 text-white py-6 rounded-[2.5rem] font-black text-xl flex items-center justify-center gap-4 hover:bg-emerald-600 transition-all shadow-xl active:scale-95">
                                Start Module <ChevronRight size={24} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {view === 'admin-portal' && (
          <div className="p-12 md:p-24 h-full bg-white flex flex-col space-y-16 overflow-y-auto animate-in fade-in duration-500">
            <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-2xl py-8 z-20 border-b-8 border-slate-50">
              <div>
                <h2 className="text-7xl font-black text-slate-900 tracking-tighter leading-none">Curriculum Editor</h2>
                <p className="text-sm font-black text-rose-600 uppercase tracking-[0.5em] mt-3 italic underline decoration-rose-200 underline-offset-4">Tassel & Claws Management</p>
              </div>
              <button onClick={() => setView('dashboard')} className="p-8 bg-slate-100 rounded-[3rem] hover:bg-rose-50 hover:text-rose-500 transition-all shadow-xl group"><XCircle size={56} className="group-hover:rotate-90 transition-transform duration-500" /></button>
            </div>

            <div className="space-y-10">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.5em] px-8">Select Grade Library</p>
              <div className="flex gap-6 overflow-x-auto pb-10 px-8 scrollbar-hide">
                {[...Array(12)].map((_, i) => (
                  <button key={i} onClick={() => setAdminGrade(i+1)} className={`w-28 h-28 flex-shrink-0 rounded-[2.5rem] font-black text-4xl transition-all border-b-[16px] ${adminGrade === i+1 ? 'bg-rose-600 text-white border-rose-950 shadow-[0_25px_50px_rgba(225,29,72,0.4)] scale-110 -translate-y-4' : 'bg-slate-50 border-slate-200 text-slate-300 hover:text-rose-400 hover:border-rose-100'}`}>
                    {i+1}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-12 pb-48">
                <div className="bg-gradient-to-br from-rose-50 to-white p-14 rounded-[5rem] border-8 border-rose-100 flex items-center gap-12 shadow-2xl relative overflow-hidden">
                  <div className="absolute right-0 bottom-0 opacity-10 rotate-12 -mr-10 -mb-10 text-rose-500"><Settings size={300} className="animate-spin-slow" /></div>
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-rose-200/50 relative z-10"><Settings className="text-rose-600 animate-spin-slow" size={64} /></div>
                  <div className="relative z-10">
                    <h3 className="text-4xl font-black text-rose-900 tracking-tighter mb-2">Grade {adminGrade} Sandbox</h3>
                    <p className="text-2xl font-bold text-rose-800/60 leading-tight italic">Content changes here will update every student's roadmap globally.</p>
                  </div>
                </div>

                {(localCurriculum[adminGrade] || []).map((task, idx) => (
                  <div key={task.id} className="bg-white p-14 rounded-[5rem] border-8 border-slate-50 space-y-10 shadow-2xl hover:border-rose-200 transition-all relative group">
                      <div className="flex justify-between items-center">
                          <span className="text-sm font-black text-slate-300 uppercase tracking-[0.3em]">Week {idx+1} Content Module</span>
                          <button 
                              onClick={() => setEditingModuleId(editingModuleId === task.id ? null : task.id)}
                              className={`flex items-center gap-4 text-lg font-black px-12 py-5 rounded-full border-4 transition-all ${editingModuleId === task.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xl scale-110 ring-8 ring-emerald-100' : 'text-indigo-600 border-indigo-50 hover:bg-indigo-50 shadow-sm'}`}
                          >
                              {editingModuleId === task.id ? <><Save size={24}/> Update Hub</> : <><LucideEdit size={24}/> Edit Module</>}
                          </button>
                      </div>
                      
                      {editingModuleId === task.id ? (
                        <div className="space-y-8 animate-in fade-in duration-500">
                          <div className="space-y-4">
                             <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-8">Module Headline</label>
                             <input className="w-full bg-slate-50 p-10 rounded-[3rem] font-black border-4 border-slate-100 focus:border-indigo-500 outline-none text-4xl tracking-tighter" value={task.title} onChange={(e) => {
                               const newCur = {...localCurriculum}; newCur[adminGrade][idx].title = e.target.value; setLocalCurriculum(newCur);
                             }} />
                          </div>
                          <div className="space-y-4">
                             <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-8">Module Detailed Lesson</label>
                             <textarea className="w-full bg-slate-50 p-12 rounded-[3.5rem] text-2xl font-bold text-slate-600 border-4 border-slate-100 focus:border-indigo-500 outline-none min-h-[250px] leading-relaxed" value={task.desc} onChange={(e) => {
                               const newCur = {...localCurriculum}; newCur[adminGrade][idx].desc = e.target.value; setLocalCurriculum(newCur);
                             }} />
                          </div>
                          <div className="flex items-center gap-10 bg-slate-50 p-8 rounded-[3rem] border-4 border-slate-100 w-fit">
                            <span className="text-lg font-black text-slate-500 uppercase tracking-widest">XP Reward:</span>
                            <input type="number" className="w-48 bg-white p-6 rounded-[2rem] font-black text-center border-4 border-indigo-100 text-4xl text-indigo-600 shadow-inner" value={task.reward} onChange={(e) => {
                              const newCur = {...localCurriculum}; newCur[adminGrade][idx].reward = parseInt(e.target.value) || 0; setLocalCurriculum(newCur);
                            }} />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <p className="font-black text-slate-800 text-6xl tracking-tighter leading-[0.9]">{task.title}</p>
                          <p className="text-3xl text-slate-500 font-bold leading-relaxed border-l-[12px] border-slate-100 pl-12 italic opacity-80">{task.desc}</p>
                        </div>
                      )}
                  </div>
                ))}
            </div>

            {/* Sticky Admin Controls */}
            <div className="fixed md:absolute bottom-0 left-0 right-0 p-12 bg-gradient-to-t from-white via-white to-transparent backdrop-blur-md z-30">
              <button onClick={deployCurriculum} className="w-full py-12 bg-rose-600 text-white rounded-[4.5rem] text-5xl font-black shadow-[0_40px_80px_-15px_rgba(225,29,72,0.5)] hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-8 group border-b-[20px] border-rose-950">
                <Globe size={56} className="group-hover:rotate-12 transition-transform duration-700" /> SYNC CURRICULUM
              </button>
            </div>
          </div>
        )}

        {/* PREMIUM FOOTER */}
        <div className="mt-auto py-16 bg-slate-900 flex flex-col items-center border-t border-white/10 relative">
          <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full"/>
          <div className="flex gap-6 items-center mb-8 text-emerald-400 relative z-10">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md"><PiggyBank size={32} /></div>
            <span className="text-sm font-black uppercase tracking-[1em] text-white">Tassel & Claws</span>
          </div>
          <div onDoubleClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="cursor-pointer group px-12 py-5 rounded-[2rem] border-4 border-white/5 hover:bg-white/10 hover:border-indigo-500/50 transition-all relative z-10 bg-black/20">
            <p className="text-[11px] text-white/40 group-hover:text-indigo-400 font-black transition-colors uppercase tracking-[0.6em] flex items-center gap-3">
               <Lock size={14}/> Secure Admin Terminal Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
