import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  PiggyBank, ArrowRight, CheckCircle2, Lock, Star, Coins, 
  XCircle, Trophy, Settings, Save, Edit3 as LucideEdit, Delete,
  ChevronRight, Wallet, GraduationCap, LayoutDashboard
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
const firebaseConfigString = import.meta.env.VITE_FIREBASE_CONFIG;
const firebaseConfig = firebaseConfigString ? JSON.parse(firebaseConfigString) : {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const rawAppId = import.meta.env.VITE_APP_ID || 'junior-savers-production-v3';
const appId = rawAppId.replace(/[^a-zA-Z0-9]/g, '_'); 

// --- STYLED COMPONENTS ---
const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden ${className}`}>
    {children}
  </div>
);

const PinKeypad = ({ title, subtitle, pinInput, onPinInput, onBackspace, pinError, onCancel, mode = 'verify' }) => (
  <div className="flex flex-col items-center justify-center p-8 space-y-8 min-h-screen bg-slate-50 animate-in fade-in zoom-in duration-300">
    <div className="text-center">
      <div className="bg-indigo-600 p-5 rounded-3xl inline-block mb-4 shadow-lg shadow-indigo-200">
        <Lock className="text-white" size={32} />
      </div>
      <h2 className="text-3xl font-black text-slate-800 tracking-tight">{title}</h2>
      <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] mt-2">{subtitle}</p>
    </div>
    
    <div className="flex gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`w-5 h-5 rounded-full border-4 transition-all duration-300 ${pinInput.length > i ? 'bg-indigo-600 border-indigo-200 scale-125' : 'border-slate-200'} ${pinError ? 'bg-rose-500 border-rose-200 animate-bounce' : ''}`} />
      ))}
    </div>

    <div className="grid grid-cols-3 gap-4 w-full max-w-[320px]">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0].map((num, i) => (
        num !== "" ? (
          <button key={i} onClick={() => onPinInput(num.toString())} className="h-20 rounded-3xl bg-white text-2xl font-black text-slate-700 shadow-sm hover:shadow-md active:scale-95 active:bg-indigo-50 transition-all border border-slate-100">{num}</button>
        ) : <div key={i} />
      ))}
      <button onClick={onBackspace} className="h-20 rounded-3xl bg-slate-100 flex items-center justify-center text-slate-400 active:scale-95"><Delete size={28} /></button>
    </div>
    {mode === 'verify' && <button onClick={onCancel} className="text-sm font-black text-slate-300 hover:text-slate-500 transition-colors uppercase tracking-widest">Cancel Access</button>}
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
    const themes = {
      1: "Meeting the Coins", 2: "Needs vs Wants", 3: "Working to Earn", 4: "The Home Bank",
      5: "Simple Banking", 6: "Mobile Money", 7: "Mini-Entrepreneur", 8: "Master Budget",
      9: "Inflation", 10: "ZRA & Tax", 11: "PACRA & Law", 12: "Investing & LuSE"
    };
    Object.entries(themes).forEach(([g, theme]) => {
      data[g] = [...Array(40)].map((_, i) => ({
        id: `g${g}w${i+1}`,
        title: `${theme} - Week ${i+1}`,
        desc: `Hey Junior Saver! This week we explore "${theme}". Complete your task to earn coins!`,
        reward: 10 + (parseInt(g) * 5)
      }));
    });
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
    <div className="h-screen flex flex-col items-center justify-center bg-indigo-600 text-white space-y-6">
      <div className="relative">
        <PiggyBank size={80} className="animate-bounce" />
        <div className="absolute inset-0 bg-white/20 blur-3xl rounded-full" />
      </div>
      <h2 className="text-2xl font-black tracking-tighter">Preparing Your Vault...</h2>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-0 md:p-8 lg:p-12 font-sans selection:bg-indigo-100">
      <div className="w-full max-w-[500px] md:max-w-4xl lg:max-w-5xl min-h-screen md:min-h-[850px] bg-white md:rounded-[3rem] shadow-2xl shadow-indigo-100 flex flex-col overflow-hidden relative border border-white/50">
        
        {showPinGate && (
          <div className="fixed inset-0 z-[100] md:absolute">
            <PinKeypad 
              title="Parental Lock" 
              subtitle="Enter your secure PIN" 
              pinInput={pinInput}
              onPinInput={handlePinInput}
              onBackspace={() => setPinInput(p => p.slice(0, -1))}
              pinError={pinError}
              onCancel={() => setShowPinGate(false)}
            />
          </div>
        )}

        {view === 'landing' && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-emerald-400 blur-[80px] opacity-30 rounded-full animate-pulse" />
              <div className="bg-gradient-to-br from-emerald-400 to-teal-600 p-12 rounded-[4rem] rotate-6 shadow-2xl relative border-4 border-white">
                <PiggyBank size={100} className="text-white drop-shadow-lg" />
              </div>
            </div>
            <h1 className="text-6xl font-black text-slate-900 tracking-tighter leading-none mb-4">Junior<br/><span className="text-emerald-600">Savers</span></h1>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-[0.4em] mb-12">Powered by Tassel & Claws</p>
            <button onClick={() => setView('grade-select')} className="group w-full max-w-sm bg-slate-900 text-white py-7 rounded-[2.5rem] text-2xl font-black shadow-2xl hover:bg-emerald-600 transition-all duration-300 flex items-center justify-center gap-4 active:scale-95">
              Start Learning <ArrowRight className="group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        )}

        {view === 'grade-select' && (
          <div className="p-10 space-y-10 flex-1 flex flex-col">
            <div className="text-center md:text-left">
              <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-none mb-2">Who are you?</h2>
              <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Select your current grade</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 flex-1">
              {[...Array(12)].map((_, i) => (
                <button key={i} onClick={() => { setGrade(i + 1); setView('consent'); }} className="group aspect-square bg-white border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center justify-center hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-50 transition-all duration-300 active:scale-95">
                  <span className="text-xs font-black text-slate-300 uppercase mb-1 group-hover:text-emerald-400">Grade</span>
                  <span className="text-5xl font-black text-slate-800 group-hover:scale-110 transition-transform">{i + 1}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'consent' && (
          <div className="p-10 space-y-8 flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
            <div className="bg-indigo-600 p-12 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl border-4 border-white">
              <Lock size={160} className="absolute -right-8 -top-8 opacity-10 rotate-12" />
              <h2 className="text-4xl font-black mb-4 leading-tight">Security First</h2>
              <p className="text-indigo-100 font-medium text-lg leading-relaxed opacity-90">Guardian presence is required for account security and monitoring.</p>
            </div>
            <div className="space-y-4">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">Guardian Email / Phone</label>
              <input 
                type="text" 
                placeholder="guardian@email.com" 
                className="w-full px-8 py-6 bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] font-bold text-lg outline-none focus:border-indigo-500 focus:bg-white transition-all"
                value={profile.parentContact}
                onChange={(e) => setProfile(prev => ({...prev, parentContact: e.target.value}))}
              />
            </div>
            <button onClick={() => setView('consent-pin')} className="w-full bg-indigo-600 text-white py-7 rounded-[2.5rem] text-2xl font-black shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Setup Admin PIN</button>
          </div>
        )}

        {view === 'consent-pin' && (
          <div className="flex-1">
            <PinKeypad 
              title="Create PIN" 
              subtitle="Keep this secret from the kids!" 
              mode="setup"
              pinInput={pinInput}
              onPinInput={handlePinInput}
              onBackspace={() => setPinInput(p => p.slice(0, -1))}
              pinError={pinError}
            />
          </div>
        )}

        {view === 'dashboard' && (
          <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-72 bg-slate-900 flex-col p-8 space-y-8">
               <div className="flex items-center gap-3 text-white mb-8">
                 <div className="bg-emerald-500 p-3 rounded-2xl"><PiggyBank size={24}/></div>
                 <span className="font-black text-xl tracking-tighter leading-none">Junior<br/>Savers</span>
               </div>
               <div className="space-y-4 flex-1">
                  <button onClick={() => setView('dashboard')} className="flex items-center gap-4 text-emerald-400 font-black w-full p-4 bg-white/5 rounded-2xl border border-white/10"><LayoutDashboard size={20}/>Dashboard</button>
                  <button className="flex items-center gap-4 text-slate-400 font-black w-full p-4 hover:text-white transition-colors"><GraduationCap size={20}/>Modules</button>
                  <button className="flex items-center gap-4 text-slate-400 font-black w-full p-4 hover:text-white transition-colors"><Wallet size={20}/>My Wallet</button>
               </div>
               <button onClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="flex items-center gap-4 text-slate-500 font-black w-full p-4 hover:text-white transition-colors border-t border-white/5 pt-8"><Settings size={20}/>Admin Settings</button>
            </div>

            {/* Main Dashboard Content */}
            <div className="flex-1 p-8 space-y-8 overflow-y-auto bg-slate-50/50">
              {activeLesson ? (
                <div className="fixed inset-0 z-40 bg-white md:relative md:rounded-[3rem] p-10 space-y-8 flex flex-col animate-in slide-in-from-bottom duration-500 shadow-2xl">
                  <div className="flex justify-between items-center">
                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest">Active Lesson</span>
                    <button onClick={() => setActiveLesson(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all"><XCircle size={28} /></button>
                  </div>
                  <h2 className="text-5xl font-black text-slate-900 leading-[1.1]">{activeLesson.title}</h2>
                  <div className="flex-1 bg-slate-50 rounded-[3rem] p-10 space-y-6 overflow-y-auto border border-slate-200 shadow-inner">
                    <p className="text-xl leading-relaxed font-medium text-slate-600">{activeLesson.desc}</p>
                    <div className="h-40 bg-gradient-to-r from-emerald-100 to-teal-100 rounded-[2rem] flex items-center justify-center border border-emerald-200">
                        <Trophy size={64} className="text-emerald-600 opacity-30" />
                    </div>
                  </div>
                  <button onClick={() => {
                    if (!profile.completedLessons.includes(activeLesson.id)) {
                      saveProfile({ balance: profile.balance + activeLesson.reward, xp: profile.xp + activeLesson.reward, completedLessons: [...profile.completedLessons, activeLesson.id] });
                    }
                    setActiveLesson(null);
                  }} className="w-full bg-emerald-600 text-white py-7 rounded-[2.5rem] text-2xl font-black shadow-2xl hover:bg-emerald-700 transition-all active:scale-95">Mark as Complete! 🎉</button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-4xl font-black text-slate-900 tracking-tight">Grade {profile.grade || grade}</h2>
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-1 italic">Leveling Up Daily</p>
                    </div>
                    {/* Mobile Settings Icon */}
                    <button onClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="md:hidden bg-indigo-600 h-14 w-14 rounded-2xl flex items-center justify-center text-white border-b-4 border-indigo-800 shadow-lg"><Settings size={24} /></button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6 group hover:shadow-xl transition-all duration-300">
                      <div className="bg-amber-100 p-5 rounded-[2rem] group-hover:scale-110 transition-transform"><Coins className="text-amber-600" size={32} /></div>
                      <div><p className="text-3xl font-black text-slate-800 tracking-tighter">K{profile.balance}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vault Balance</p></div>
                    </div>
                    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex items-center gap-6 group hover:shadow-xl transition-all duration-300">
                      <div className="bg-purple-100 p-5 rounded-[2rem] group-hover:scale-110 transition-transform"><Star className="text-purple-600" size={32} /></div>
                      <div><p className="text-3xl font-black text-slate-800 tracking-tighter">{profile.xp}</p><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience Points</p></div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em] px-4 flex items-center gap-4">Curriculum Progress <div className="h-[2px] flex-1 bg-slate-100"/></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(localCurriculum[profile.grade || grade] || []).map((task, idx) => {
                        const isDone = profile.completedLessons.includes(task.id);
                        return (
                          <div key={task.id} className={`p-8 rounded-[3rem] border-2 transition-all duration-300 relative group overflow-hidden ${isDone ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-50 hover:border-emerald-200 shadow-sm hover:shadow-2xl hover:-translate-y-1'}`}>
                            <div className="flex justify-between items-start mb-4">
                              <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${isDone ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>Week {idx+1}</span>
                              {isDone ? <CheckCircle2 className="text-emerald-500" size={24} /> : <div className="w-6 h-6 rounded-full border-2 border-slate-100"/>}
                            </div>
                            <h4 className={`font-black text-2xl tracking-tight mb-2 ${isDone ? 'text-emerald-800' : 'text-slate-800'}`}>{task.title}</h4>
                            <p className="text-xs text-slate-400 font-bold mb-6">Complete for {task.reward} XP</p>
                            {!isDone && (
                              <button onClick={() => setActiveLesson(task)} className="w-full bg-slate-900 text-white py-4 rounded-3xl font-black text-sm flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors">
                                Open Module <ChevronRight size={16} />
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
          <div className="p-10 h-full bg-white flex flex-col space-y-10 overflow-y-auto">
            <div className="flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-xl py-4 z-10 border-b border-slate-50">
              <div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Editor Portal</h2>
                <p className="text-xs font-black text-rose-600 uppercase tracking-widest">Master Controls</p>
              </div>
              <button onClick={() => setView('dashboard')} className="p-4 bg-slate-100 rounded-[2rem] hover:bg-rose-50 hover:text-rose-500 transition-all"><XCircle size={32} /></button>
            </div>

            <div className="space-y-6">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] px-2">Grade Catalog</p>
              <div className="flex gap-3 overflow-x-auto pb-6 px-2 scrollbar-hide">
                {[...Array(12)].map((_, i) => (
                  <button key={i} onClick={() => setAdminGrade(i+1)} className={`w-16 h-16 flex-shrink-0 rounded-[1.5rem] font-black transition-all border-b-8 ${adminGrade === i+1 ? 'bg-rose-600 text-white border-rose-900 shadow-xl scale-110 -translate-y-1' : 'bg-white border-slate-100 text-slate-400'}`}>
                    {i+1}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-6 pb-20">
                <div className="bg-rose-50 p-8 rounded-[3rem] border-2 border-rose-100 flex items-center gap-6">
                  <div className="bg-white p-4 rounded-2xl shadow-sm"><Settings className="text-rose-600 animate-spin-slow" /></div>
                  <p className="text-rose-900 font-bold leading-tight">Editing Curriculum for Grade {adminGrade}. Changes affect all students.</p>
                </div>

                {(localCurriculum[adminGrade] || []).map((task, idx) => (
                  <div key={task.id} className="bg-white p-8 rounded-[3.5rem] border-2 border-slate-100 space-y-6 shadow-sm hover:border-indigo-100 transition-colors relative">
                      <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Module Week {idx+1}</span>
                          <button 
                              onClick={() => setEditingModuleId(editingModuleId === task.id ? null : task.id)}
                              className={`flex items-center gap-2 text-xs font-black px-6 py-2 rounded-full border-2 transition-all ${editingModuleId === task.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl' : 'text-indigo-600 border-indigo-50 hover:bg-indigo-50'}`}
                          >
                              {editingModuleId === task.id ? <><Save size={14}/> Save Changes</> : <><LucideEdit size={14}/> Edit Text</>}
                          </button>
                      </div>
                      
                      {editingModuleId === task.id ? (
                        <div className="space-y-4 animate-in fade-in duration-300">
                          <input className="w-full bg-slate-50 p-5 rounded-2xl font-black border-2 border-slate-100 focus:border-indigo-500 outline-none text-lg" value={task.title} onChange={(e) => {
                            const newCur = {...localCurriculum}; newCur[adminGrade][idx].title = e.target.value; setLocalCurriculum(newCur);
                          }} />
                          <textarea className="w-full bg-slate-50 p-5 rounded-2xl text-sm font-medium border-2 border-slate-100 focus:border-indigo-500 outline-none min-h-[150px] leading-relaxed" value={task.desc} onChange={(e) => {
                            const newCur = {...localCurriculum}; newCur[adminGrade][idx].desc = e.target.value; setLocalCurriculum(newCur);
                          }} />
                          <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-slate-400">XP Reward:</span>
                            <input type="number" className="w-32 bg-slate-50 p-4 rounded-2xl font-black text-center border-2 border-slate-100" value={task.reward} onChange={(e) => {
                              const newCur = {...localCurriculum}; newCur[adminGrade][idx].reward = parseInt(e.target.value) || 0; setLocalCurriculum(newCur);
                            }} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-black text-slate-800 text-3xl tracking-tight leading-none">{task.title}</p>
                          <p className="text-lg text-slate-500 font-medium leading-relaxed italic border-l-4 border-slate-100 pl-6">{task.desc}</p>
                        </>
                      )}
                  </div>
                ))}
            </div>

            <div className="sticky bottom-8 left-0 right-0 px-4">
              <button onClick={deployCurriculum} className="w-full py-8 bg-rose-600 text-white rounded-[2.5rem] text-3xl font-black shadow-2xl hover:bg-rose-700 active:scale-95 transition-all flex items-center justify-center gap-4 group">
                <Save size={32} className="group-hover:scale-125 transition-transform" /> Publish to All Students
              </button>
            </div>
          </div>
        )}

        {/* UNIVERSAL FOOTER */}
        <div className="mt-auto py-10 bg-slate-900 flex flex-col items-center">
          <div className="flex gap-2 items-center mb-4 text-emerald-400">
            <PiggyBank size={20} />
            <span className="text-[10px] font-black uppercase tracking-[0.5em]">Tassel and Claws</span>
          </div>
          <div onDoubleClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="cursor-pointer group px-8 py-3 rounded-full border border-white/5 hover:bg-white/5 transition-all">
            <p className="text-[9px] text-white/20 group-hover:text-indigo-400 font-black transition-colors uppercase tracking-widest">Secure Admin Portal</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
