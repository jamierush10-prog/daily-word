'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Mic, 
  Square, 
  Play, 
  Pause, 
  Search, 
  Calendar, 
  Lock, 
  Unlock, 
  Save, 
  Edit2,
  Loader2,
  X
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  getDocs, 
  orderBy 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';

// --- Firebase Configuration ---
// 🔴 PASTE YOUR KEYS HERE ONE LAST TIME 🔴
const firebaseConfig = {
  apiKey: "AIzaSyAu4RBAQesk8ZGfyUkNyoctCr5h4YB_wsA",
  authDomain: "daily-word-a3fa5.firebaseapp.com",
  projectId: "daily-word-a3fa5",
  storageBucket: "daily-word-a3fa5.firebasestorage.app",
  messagingSenderId: "1030286376336",
  appId: "1:1030286376336:web:1aa10b79c11b83b2d78715",
  measurementId: "G-SBW8PPLTQ0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Helper Functions ---
const formatDate = (date) => {
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getDisplayDate = (date) => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};

export default function App() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null); 
  
  // Admin / Edit Mode State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editScripture, setEditScripture] = useState('');

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // --- Auth & Initial Load ---
  useEffect(() => {
    // Silent login
    signInAnonymously(auth).catch(err => console.error("Auth error:", err));

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    if (!user) return;
    fetchDailyData(currentDate);
  }, [currentDate, user]);

  const fetchDailyData = async (date) => {
    setLoading(true);
    const dateStr = formatDate(date);
    
    try {
      const docRef = doc(db, 'readings', dateStr);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const docData = docSnap.data();
        setData(docData);
        setEditScripture(docData.scripture || '');
      } else {
        setData(null);
        setEditScripture('');
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- Navigation Handlers ---
  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
    setIsEditing(false);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
    setIsEditing(false);
  };

  // --- Admin / Login Logic ---
  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === '1234') {
      setIsAdmin(true);
      setShowLogin(false);
      setPasswordInput('');
    } else {
      alert('Incorrect password');
    }
  };

  const handleSaveScripture = async () => {
    if (!user) return;

    const dateStr = formatDate(currentDate);
    const docRef = doc(db, 'readings', dateStr);
    
    const newData = {
      date: dateStr,
      scripture: editScripture,
      audioUrl: data?.audioUrl || null,
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(docRef, newData, { merge: true });
      setData(newData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving scripture:", error);
      alert("Failed to save.");
    }
  };

  // --- Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = handleRecordingStop;

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      // Start Timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please allow permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
  };

  const handleRecordingStop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
    await uploadAudio(audioBlob);
  };

  const uploadAudio = async (blob) => {
    if (!user) return;
    setIsUploading(true);
    const dateStr = formatDate(currentDate);
    const storageRef = ref(storage, `audio/${dateStr}_${Date.now()}.mp3`);

    try {
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const docRef = doc(db, 'readings', dateStr);
      const newData = {
        date: dateStr,
        scripture: data?.scripture || editScripture || '',
        audioUrl: downloadURL,
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, newData, { merge: true });
      setData(newData);

    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
      setRecordingTime(0);
    }
  };

  // --- Search Logic ---
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const q = query(collection(db, 'readings'));
      const querySnapshot = await getDocs(q);
      const results = [];
      querySnapshot.forEach((doc) => {
        const d = doc.data();
        if (d.scripture && d.scripture.toLowerCase().includes(searchQuery.toLowerCase())) {
          results.push(d);
        }
      });
      setSearchResults(results);
    } catch (e) {
      console.error("Search error:", e);
    } finally {
      setSearching(false);
    }
  };

  // --- Render Helper for Bold Text ---
  const renderScripture = (text) => {
    if (!text) return null;
    // Correctly split the text into parts
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove the asterisks and render bold
        return <strong key={index} className="font-bold text-stone-900">{part.slice(2, -2)}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 relative">
      
      {/* --- Header --- */}
      <header className="bg-white border-b border-stone-200 p-4 shadow-sm flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
           <button onClick={() => setShowSearch(true)} className="p-2 rounded-full hover:bg-stone-100 text-stone-600 transition-colors">
             <Search size={24} />
           </button>
        </div>
        
        <h1 className="text-lg font-serif font-bold text-stone-800 tracking-wide">Daily Word</h1>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <button onClick={() => setIsAdmin(false)} className="p-2 rounded-full bg-amber-50 text-amber-600">
              <Unlock size={20} />
            </button>
          ) : (
            <button onClick={() => setShowLogin(true)} className="p-2 rounded-full hover:bg-stone-100 text-stone-400">
              <Lock size={20} />
            </button>
          )}
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <main className="pb-40">
        
        {/* Date Navigation */}
        <div className="flex items-center justify-between p-6 bg-white/50 backdrop-blur-sm">
          <button onClick={handlePrevDay} className="p-2 rounded-full bg-stone-100 text-stone-600 shadow-sm active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <div className="text-center">
            <div className="text-sm text-stone-500 uppercase tracking-widest font-semibold">
              {currentDate.toLocaleDateString('en-US', { weekday: 'long' })}
            </div>
            <div className="text-xl font-serif text-stone-800">
              {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <button onClick={handleNextDay} className="p-2 rounded-full bg-stone-100 text-stone-600 shadow-sm active:scale-95 transition-transform">
            <ChevronRight size={28} />
          </button>
        </div>

        {/* Scripture Card */}
        <div className="px-4 max-w-2xl mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden min-h-[300px] relative flex flex-col">
            {loading ? (
               <div className="flex-1 flex flex-col items-center justify-center text-stone-400 p-10">
                 <Loader2 className="animate-spin mb-2" size={32} />
                 <p>Loading scripture...</p>
               </div>
            ) : (
              <>
                {/* Empty State / Edit Mode */}
                {(!data?.scripture && !isEditing) ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                    <p className="text-stone-400 mb-4 italic">No scripture added for this day.</p>
                    {isAdmin && (
                      <button 
                        onClick={() => setIsEditing(true)} 
                        className="flex items-center gap-2 px-6 py-3 bg-stone-800 text-white rounded-full shadow-lg hover:bg-stone-700 transition-colors"
                      >
                        <Edit2 size={18} />
                        Add Scripture
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-8 flex-1">
                    {isEditing ? (
                      <div className="flex flex-col h-full gap-4">
                        <textarea 
                          className="w-full flex-1 border border-stone-300 rounded-lg p-4 font-serif text-lg resize-none focus:ring-2 focus:ring-stone-500 focus:outline-none bg-stone-50"
                          value={editScripture}
                          onChange={(e) => setEditScripture(e.target.value)}
                          placeholder="Paste scripture here..."
                        />
                        <p className="text-xs text-stone-400">Tip: Wrap headers in **double asterisks** to make them bold.</p>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-stone-500">Cancel</button>
                          <button 
                            onClick={handleSaveScripture} 
                            className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 shadow-md hover:bg-green-700"
                          >
                            <Save size={18} /> Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="prose prose-stone max-w-none">
                         {isAdmin && (
                           <button onClick={() => setIsEditing(true)} className="absolute top-4 right-4 text-stone-300 hover:text-stone-600">
                             <Edit2 size={16} />
                           </button>
                         )}
                         <h3 className="text-sm text-stone-400 font-bold uppercase mb-4 tracking-widest">Scripture Reading</h3>
                         <div className="text-xl md:text-2xl font-serif leading-relaxed text-stone-800 whitespace-pre-wrap">
                           {renderScripture(data?.scripture)}
                         </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </main>

      {/* --- Audio Controller (Sticky Bottom) --- */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-2xl mx-auto">
          
          {/* If there is audio, show player */}
          {data?.audioUrl && !isRecording && (
             <div className="mb-6 bg-stone-50 rounded-xl p-4 border border-stone-100 flex items-center gap-4">
                <div className="bg-indigo-100 text-indigo-600 p-3 rounded-full">
                  <Play size={24} fill="currentColor" />
                </div>
                <div className="flex-1">
                   <p className="text-xs text-stone-500 font-bold uppercase mb-1">Daily Reflection</p>
                   <audio controls src={data.audioUrl} className="w-full h-8" />
                </div>
             </div>
          )}

          {/* Recording Interface (Only for Admin) */}
          {isAdmin && (
             <div className="flex flex-col items-center gap-4">
               {isRecording ? (
                 <div className="w-full bg-red-50 border border-red-100 rounded-2xl p-6 flex flex-col items-center animate-pulse">
                    <div className="text-3xl font-mono text-red-600 mb-4 font-bold">
                      {formatTime(recordingTime)}
                    </div>
                    <p className="text-red-400 text-sm mb-4">Recording in progress...</p>
                    <button 
                      onClick={stopRecording}
                      className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white shadow-red-200 shadow-xl hover:scale-105 transition-transform"
                    >
                      <Square fill="currentColor" size={24} />
                    </button>
                 </div>
               ) : (
                 <>
                  {isUploading ? (
                    <div className="flex items-center gap-3 text-stone-500">
                      <Loader2 className="animate-spin" /> Uploading audio...
                    </div>
                  ) : (
                    <button 
                      onClick={startRecording}
                      disabled={!data?.scripture} // Prevent recording if no text
                      className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-semibold shadow-lg transition-all ${
                        !data?.scripture 
                          ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
                          : 'bg-stone-900 text-white hover:bg-stone-800 active:scale-95'
                      }`}
                    >
                      <Mic size={20} />
                      {data?.audioUrl ? 'Record New Version' : 'Record Reading'}
                    </button>
                  )}
                 </>
               )}
             </div>
          )}

          {!isAdmin && !data?.audioUrl && (
            <div className="text-center text-stone-400 text-sm py-2">
              No recording available for today yet.
            </div>
          )}
        </div>
      </div>

      {/* --- Modals --- */}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Admin Access</h3>
              <button onClick={() => setShowLogin(false)}><X size={20} className="text-stone-400" /></button>
            </div>
            <form onSubmit={handleLogin}>
              <input 
                type="password" 
                placeholder="Enter Password (1234)" 
                className="w-full border border-stone-200 rounded-lg p-3 mb-4 focus:ring-2 focus:ring-stone-800 outline-none"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
              <button type="submit" className="w-full bg-stone-900 text-white py-3 rounded-lg font-semibold">
                Unlock
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
           <div className="p-4 border-b border-stone-200 flex items-center gap-4">
             <button onClick={() => setShowSearch(false)}><ChevronLeft size={28} /></button>
             <input 
               type="text" 
               placeholder="Search past readings..." 
               className="flex-1 text-lg outline-none placeholder:text-stone-300"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               autoFocus
             />
             <button 
               onClick={handleSearch}
               className="bg-stone-900 text-white px-4 py-2 rounded-lg text-sm font-semibold"
             >
               {searching ? <Loader2 className="animate-spin" size={16} /> : 'Find'}
             </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-4">
              {searchResults.length === 0 && searchQuery && !searching && (
                <div className="text-center text-stone-400 mt-10">No results found.</div>
              )}
              
              <div className="space-y-3">
                {searchResults.map((res, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setCurrentDate(new Date(res.date + 'T12:00:00')); // Safety fix for timezone offset
                      setShowSearch(false);
                    }}
                    className="p-4 border border-stone-100 rounded-xl hover:bg-stone-50 cursor-pointer transition-colors"
                  >
                     <div className="text-sm text-stone-500 font-bold mb-1">{getDisplayDate(new Date(res.date))}</div>
                     <div className="text-stone-800 line-clamp-2 font-serif">{res.scripture}</div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}