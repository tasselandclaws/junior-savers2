import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  PiggyBank, ArrowRight, CheckCircle2, Lock, Star, Coins, 
  XCircle, Trophy, Settings, Save, Edit3 as LucideEdit, Delete
} from 'lucide-react';

// --- FIREBASE INITIALIZATION ---
const firebaseConfigString = import.meta.env.VITE_FIREBASE_CONFIG;
const firebaseConfig = firebaseConfigString ? JSON.parse(firebaseConfigString) : {};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Unique App Identifier from Environment Variables
const rawAppId = import.meta.env.VITE_APP_ID || 'junior-savers-production-v3';
const appId = rawAppId.replace(/[^a-zA-Z0-9]/g, '_'); 

// --- HELPER COMPONENTS ---
const PinKeypad = ({ title, subtitle, pinInput, onPinInput, onBackspace, pinError, onCancel, mode = 'verify' }) => (
  <div className="flex flex-col items-center justify-center p-6 space-y-8 h-screen bg-white">
    <div className="text-center">
      <div className="bg-blue-100 p-4 rounded-full inline-block mb-4"><Lock className="text-blue-600" /></div>
      <h2 className="text-2xl font-black text-gray-800">{title}</h2>
      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{subtitle}</p>
    </div>
    <div className="flex gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${pinInput.length > i ? 'bg-blue-600 border-blue-600 scale-125' : 'border-gray-200'} ${pinError ? 'bg-red-500 border-red-500 animate-bounce' : ''}`} />
      ))}
    </div>
    <div className="grid grid-cols-3 gap-4 w-64">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0].map((num, i) => (
        num !== "" ? (
          <button key={i} onClick={() => onPinInput(num.toString())} className="h-16 rounded-2xl bg-gray-50 text-xl font-black active:bg-blue-50 transition-all">{num}</button>
        ) : <div key={i} />
      ))}
      <button onClick={onBackspace} className="h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 font-black"><Delete /></button>
    </div>
    {mode === 'verify' && <button onClick={onCancel} className="text-[10px] font-black text-gray-300">CANCEL</button>}
  </div>
);

const App = () => {
  // --- CORE STATE ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [grade, setGrade] = useState(null);
  const [adminGrade, setAdminGrade] = useState(1);
  const [activeLesson, setActiveLesson] = useState(null);
  
  const [profile, setProfile] = useState({
    balance: 0,
    xp: 0,
    completedLessons: [],
    parentPin: "",
    parentContact: "",
    grade: null
  });

  const [localCurriculum, setLocalCurriculum] = useState({});
  const [editingModuleId, setEditingModuleId] = useState(null);

  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // --- DATA GENERATOR (40 WEEKS PER GRADE) ---
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
        desc: `Curriculum Module: ${theme}. Complete the weekly action task to earn XP.`,
        reward: 10 + (parseInt(g) * 5)
      }));
    });
    return data;
  };

  const initialData = generateInitialData();

  // --- FIREBASE SYNC ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) { console.error("Auth Failure:", err); }
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
      } else {
        setLocalCurriculum(initialData);
      }
    });

    return () => { unsubProfile(); unsubCur(); };
  }, [user, view]);

  // --- HANDLERS ---
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

  if (!user) return <div className="h-screen flex items-center justify-center font-black animate-pulse bg-white text-green-600">Initializing Junior Savers...</div>;

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto flex flex-col shadow-2xl relative border-x border-gray-100">
      
      {showPinGate && (
        <div className="fixed inset-0 z-[100]">
          <PinKeypad 
            title="Parental Verification" 
            subtitle="Enter your 4-digit PIN to continue" 
            pinInput={pinInput}
            onPinInput={handlePinInput}
            onBackspace={() => setPinInput(p => p.slice(0, -1))}
            pinError={pinError}
            onCancel={() => setShowPinGate(false)}
          />
        </div>
      )}

      {view === 'landing' && (
        <div className="flex flex-col items-center text-center p-6 h-screen justify-center animate-in fade-in">
          <div className="bg-green-100 p-10 rounded-[48px] rotate-3 shadow-inner mb-8"><PiggyBank size={80} className="text-green-600" /></div>
          <h1 className="text-5xl font-black text-green-800 tracking-tighter leading-none">Junior Savers</h1>
          <p className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-2 mb-12">Tassel and Claws</p>
          <button onClick={() => setView('grade-select')} className="w-full bg-green-600 text-white py-6 rounded-[32px] text-xl font-black shadow-xl flex items-center justify-center gap-3">Begin Journey <ArrowRight /></button>
        </div>
      )}

      {view === 'grade-select' && (
        <div className="p-6 space-y-8 h-screen overflow-y-auto bg-white">
          <h2 className="text-4xl font-black text-gray-800 leading-tight">Pick Your Grade</h2>
          <div className="grid grid-cols-3 gap-3">
            {[...Array(12)].map((_, i) => (
              <button key={i} onClick={() => { setGrade(i + 1); setView('consent'); }} className="h-24 bg-white border-2 border-gray-100 rounded-3xl flex flex-col items-center justify-center active:border-green-500 transition-all">
                <span className="text-[10px] font-black text-gray-300 uppercase">Grade</span>
                <span className="text-3xl font-black text-gray-800">{i + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === 'consent' && (
        <div className="p-6 space-y-8 h-screen flex flex-col justify-center bg-white">
          <div className="bg-blue-600 p-10 rounded-[40px] text-white relative overflow-hidden shadow-xl">
            <Lock size={120} className="absolute -right-4 -top-4 opacity-20" />
            <h2 className="text-3xl font-black mb-2 leading-tight">Parental Gate</h2>
            <p className="text-blue-100 font-bold text-sm">Please provide your contact for account monitoring.</p>
          </div>
          <input 
            type="text" 
            placeholder="Guardian Email" 
            className="w-full px-6 py-5 bg-gray-50 border-2 border-gray-100 rounded-[32px] font-bold outline-none focus:border-blue-500"
            value={profile.parentContact}
            onChange={(e) => setProfile(prev => ({...prev, parentContact: e.target.value}))}
          />
          <button onClick={() => setView('consent-pin')} className="w-full bg-blue-600 text-white py-6 rounded-[32px] text-xl font-black shadow-lg">Set Parent PIN</button>
        </div>
      )}

      {view === 'consent-pin' && (
        <PinKeypad 
          title="Create PIN" 
          subtitle="4 digits for adult access only" 
          mode="setup"
          pinInput={pinInput}
          onPinInput={handlePinInput}
          onBackspace={() => setPinInput(p => p.slice(0, -1))}
          pinError={pinError}
        />
      )}

      {view === 'dashboard' && (
        <div className="p-6 space-y-6 h-screen overflow-y-auto pb-24 relative bg-gray-50/20">
          {activeLesson ? (
            <div className="fixed inset-0 z-40 bg-white p-6 space-y-6 flex flex-col animate-in slide-in-from-bottom">
              <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-gray-400">Lesson Mode</span><button onClick={() => setActiveLesson(null)}><XCircle size={28} className="text-gray-300" /></button></div>
              <h2 className="text-3xl font-black text-gray-800 leading-tight">{activeLesson.title}</h2>
              <div className="flex-1 bg-gray-50 rounded-[40px] p-8 space-y-4 overflow-y-auto border border-gray-100 leading-relaxed font-medium text-gray-600">{activeLesson.desc}</div>
              <button onClick={() => {
                if (!profile.completedLessons.includes(activeLesson.id)) {
                  saveProfile({ balance: profile.balance + activeLesson.reward, xp: profile.xp + activeLesson.reward, completedLessons: [...profile.completedLessons, activeLesson.id] });
                }
                setActiveLesson(null);
              }} className="w-full bg-green-600 text-white py-6 rounded-[32px] text-xl font-black shadow-xl">Complete Module</button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <div><h2 className="text-3xl font-black text-gray-800">Grade {profile.grade || grade}</h2><p className="text-[10px] font-black text-green-600 uppercase">Active Learner</p></div>
                <button onClick={() => { setPendingAction(() => () => setView('admin-portal')); setShowPinGate(true); }} className="bg-blue-600 h-14 w-14 rounded-2xl flex items-center justify-center text-white border-b-4 border-blue-800 shadow-lg active:scale-95"><Settings size={24} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm text-center">
                  <Coins className="text-yellow-500 mx-auto mb-2" size={32} /><p className="text-2xl font-black">K{profile.balance}</p><p className="text-[10px] font-bold text-gray-400 uppercase">Wallet</p>
                </div>
                <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm text-center">
                  <Star className="text-purple-500 mx-auto mb-2" size={32} /><p className="text-2xl font-black">{profile.xp}</p><p className="text-[10px] font-bold text-gray-400 uppercase">XP</p>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Roadmap (40 Weeks)</h3>
                {(localCurriculum[profile.grade || grade] || []).map((task, idx) => {
                  const isDone = profile.completedLessons.includes(task.id);
                  return (
                    <div key={task.id} className={`p-6 rounded-[40px] border transition-all ${isDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-1"><span className="text-[9px] font-black text-gray-300 uppercase">Week {idx+1}</span>{isDone && <CheckCircle2 className="text-green-500" size={16} />}</div>
                      <h4 className={`font-black text-lg ${isDone ? 'text-green-800' : 'text-gray-800'}`}>{task.title}</h4>
                      <p className="text-[10px] text-gray-400 font-bold mb-4">Reward: {task.reward} XP</p>
                      {!isDone && <button onClick={() => setActiveLesson(task)} className="w-full bg-green-600 text-white py-3 rounded-full font-black text-xs active:scale-95">Start Lesson</button>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {view === 'admin-portal' && (
        <div className="p-6 h-screen bg-white flex flex-col space-y-8 overflow-y-auto">
          <div className="flex items-center justify-between sticky top-0 bg-white py-2 z-10 border-b border-gray-50">
            <h2 className="text-3xl font-black text-gray-800">Admin Panel</h2>
            <button onClick={() => setView('dashboard')} className="p-3 bg-gray-100 rounded-2xl"><XCircle /></button>
          </div>
          <div className="space-y-4">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-2">Manage Curriculum</p>
            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide px-2">
              {[...Array(12)].map((_, i) => (
                <button key={i} onClick={() => setAdminGrade(i+1)} className={`w-14 h-14 flex-shrink-0 rounded-2xl font-black transition-all border-b-4 ${adminGrade === i+1 ? 'bg-red-600 text-white border-red-800 shadow-lg scale-110' : 'bg-white border-gray-100 text-gray-400'}`}>
                  {i+1}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-4">
              <div className="bg-red-50 p-6 rounded-[32px] border border-red-100 mb-6"><p className="text-red-800 font-bold text-sm leading-tight">Managing Grade {adminGrade}. Click EDIT to change week content.</p></div>
              {(localCurriculum[adminGrade] || []).map((task, idx) => (
                <div key={task.id} className="bg-white p-6 rounded-[40px] border border-gray-100 space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-gray-300 uppercase">Week {idx+1}</span>
                        <button 
                            onClick={() => setEditingModuleId(editingModuleId === task.id ? null : task.id)}
                            className={`flex items-center gap-1 text-[10px] font-black px-3 py-1 rounded-full border ${editingModuleId === task.id ? 'bg-green-600 border-green-600 text-white shadow-lg' : 'text-blue-500 border-blue-100'}`}
                        >
                            {editingModuleId === task.id ? <Save size={12}/> : <LucideEdit size={12}/>} 
                            {editingModuleId === task.id ? 'DONE' : 'EDIT'}
                        </button>
                    </div>
                    {editingModuleId === task.id ? (
                      <div className="space-y-3 animate-in fade-in">
                        <input className="w-full bg-gray-50 p-3 rounded-xl font-black border border-gray-200 outline-none text-sm" value={task.title} onChange={(e) => {
                          const newCur = {...localCurriculum}; newCur[adminGrade][idx].title = e.target.value; setLocalCurriculum(newCur);
                        }} />
                        <textarea className="w-full bg-gray-50 p-3 rounded-xl text-xs font-medium border border-gray-200 outline-none min-h-[100px] leading-relaxed" value={task.desc} onChange={(e) => {
                          const newCur = {...localCurriculum}; newCur[adminGrade][idx].desc = e.target.value; setLocalCurriculum(newCur);
                        }} />
                        <input type="number" className="w-24 bg-gray-50 p-3 rounded-xl font-black text-xs border border-gray-200" value={task.reward} onChange={(e) => {
                          const newCur = {...localCurriculum}; newCur[adminGrade][idx].reward = parseInt(e.target.value) || 0; setLocalCurriculum(newCur);
                        }} />
                      </div>
                    ) : (
                      <>
                        <p className="font-black text-gray-800 text-lg leading-tight">{task.title}</p>
                        <p className="text-xs text-gray-500 font-medium leading-relaxed">{task.desc}</p>
                      </>
                    )}
                </div>
              ))}
          </div>
          <button onClick={deployCurriculum} className="w-full py-5 bg-red-600 text-white rounded-[32px] text-xl font-black shadow-xl active:scale-95 flex items-center justify-center gap-2 mb-10"><Save size={20}/> Push to Production</button>
        </div>
      )}

      {/* FOOTER */}
      <div className="mt-auto py-8 bg-gray-50 flex flex-col items-center border-t border-gray-100">
        <p className="text-[10px] font-black text-gray-200 uppercase tracking-[0.4em] mb-4">Tassel and Claws</p>
        <div onDoubleClick={() => setView('admin-portal')} className="cursor-pointer group px-4 py-2">
          <p className="text-[8px] text-gray-100 group-hover:text-blue-300 font-bold transition-colors uppercase">Admin Access</p>
        </div>
      </div>
    </div>
  );
};

export default App;
