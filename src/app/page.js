'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Search, 
  Lock, 
  Unlock, 
  Save, 
  Edit2,
  Loader2,
  X,
  Upload,
  Headphones,
  MessageCircle
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

const getDayNumber = (currentDate) => {
  const startDate = new Date('2025-11-21T00:00:00'); // Day 1
  const target = new Date(currentDate);
  target.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  const diffTime = target - startDate;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays + 1;
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
  
  // Content State
  const [editScripture, setEditScripture] = useState('');
  const [editHeader, setEditHeader] = useState('');
  const [editGroup, setEditGroup] = useState(''); 
  const [editVersion, setEditVersion] = useState('');

  // Upload State
  const [isUploadingReading, setIsUploadingReading] = useState(false);
  const [isUploadingReview, setIsUploadingReview] = useState(false);
  
  const readingInputRef = useRef(null);
  const reviewInputRef = useRef(null);

  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // --- Auth & Initial Load ---
  useEffect(() => {
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
        setEditHeader(docData.header || ''); 
        setEditGroup(docData.group || ''); 
        setEditVersion(docData.version || '');
      } else {
        setData(null);
        setEditScripture('');
        setEditHeader('');
        setEditGroup('');
        setEditVersion('');
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
    if (passwordInput === 'dw2025') {
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
      header: editHeader,
      group: editGroup,
      version: editVersion,
      scripture: editScripture,
      audioUrl: data?.audioUrl || null,
      reviewAudioUrl: data?.reviewAudioUrl || null,
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

  // --- Upload Logic ---
  const handleFileSelect = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadAudio(file, type);
  };

  const uploadAudio = async (fileBlob, type) => {
    if (!user) return;
    
    if (type === 'reading') setIsUploadingReading(true);
    else setIsUploadingReview(true);

    const dateStr = formatDate(currentDate);
    const fileType = type === 'reading' ? 'read' : 'rev';
    const storageRef = ref(storage, `audio/${dateStr}_${fileType}_${Date.now()}_${fileBlob.name}`);

    try {
      const snapshot = await uploadBytes(storageRef, fileBlob);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const docRef = doc(db, 'readings', dateStr);
      
      const newData = {
        date: dateStr,
        header: editHeader || data?.header || '', 
        group: editGroup || data?.group || '', 
        version: editVersion || data?.version || '',
        scripture: data?.scripture || editScripture || '',
        audioUrl: type === 'reading' ? downloadURL : (data?.audioUrl || null),
        reviewAudioUrl: type === 'review' ? downloadURL : (data?.reviewAudioUrl || null),
        updatedAt: new Date().toISOString()
      };

      await setDoc(docRef, newData, { merge: true });
      setData(newData);

    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Upload failed.");
    } finally {
      setIsUploadingReading(false);
      setIsUploadingReview(false);
      if (readingInputRef.current) readingInputRef.current.value = '';
      if (reviewInputRef.current) reviewInputRef.current.value = '';
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
        const textToSearch = (d.header + ' ' + d.scripture + ' ' + (d.group || '') + ' ' + (d.version || '')).toLowerCase();
        if (textToSearch.includes(searchQuery.toLowerCase())) {
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

  // --- Render Helper ---
  const renderScripture = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*|::.*?::|_.*?_)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-stone-900">{part.slice(2, -2)}</strong>;
      } else if (part.startsWith('::') && part.endsWith('::')) {
        return <span key={index} className="text-red-600">{part.slice(2, -2)}</span>;
      } else if (part.startsWith('_') && part.endsWith('_')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const dayNumber = getDayNumber(currentDate);

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
      <main className="p-4 pb-20">
        
        {/* Date Navigation */}
        <div className="flex items-center justify-between p-6 bg-white/50 backdrop-blur-sm max-w-2xl mx-auto mb-4">
          <button onClick={handlePrevDay} className="p-2 rounded-full bg-stone-100 text-stone-600 shadow-sm active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <div className="text-center flex flex-col items-center">
             {dayNumber > 0 && (
               <span className="text-xs font-bold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full mb-1">
                 Day {dayNumber}
               </span>
             )}
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
        <div className="max-w-2xl mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden min-h-[300px] flex flex-col relative">
            {loading ? (
               <div className="flex-1 flex flex-col items-center justify-center text-stone-400 p-10 min-h-[300px]">
                 <Loader2 className="animate-spin mb-2" size={32} />
                 <p>Loading scripture...</p>
               </div>
            ) : (
              <>
                {/* Edit Button */}
                {isAdmin && !isEditing && (
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="absolute top-6 right-6 p-2 text-stone-300 hover:text-stone-600 z-10 bg-white/80 rounded-full backdrop-blur-sm"
                  >
                    <Edit2 size={20} />
                  </button>
                )}

                {/* Empty State / Edit Mode */}
                {(!data?.scripture && !isEditing && !data?.header) ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-10 text-center min-h-[300px]">
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
                  <div className="p-8 flex-1 flex flex-col">
                    {isEditing ? (
                      <div className="flex flex-col h-full gap-4">
                        {/* Header Input (Top) */}
                        <input
                          type="text"
                          className="w-full border border-stone-300 rounded-lg p-4 font-serif text-xl font-bold placeholder:font-normal focus:ring-2 focus:ring-stone-500 focus:outline-none bg-stone-50"
                          value={editHeader}
                          onChange={(e) => setEditHeader(e.target.value)}
                          placeholder="Title (e.g., John 1: 1-19)"
                        />
                        
                        {/* Controls (Middle) */}
                        <div className="flex items-center gap-3 pt-2">
                           <input
                              type="text"
                              className="flex-1 border border-stone-300 rounded-lg p-2 font-serif text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-500"
                              value={editGroup}
                              onChange={(e) => setEditGroup(e.target.value)}
                              placeholder="Group (e.g. Group 1)"
                           />
                           <input
                              type="text"
                              className="flex-1 border border-stone-300 rounded-lg p-2 font-serif text-sm bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-500"
                              value={editVersion}
                              onChange={(e) => setEditVersion(e.target.value)}
                              placeholder="Version (e.g. NIV)"
                           />
                           <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-stone-500">Cancel</button>
                           <button 
                             onClick={handleSaveScripture} 
                             className="px-6 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 shadow-md hover:bg-green-700"
                           >
                             <Save size={18} /> Save
                           </button>
                        </div>

                        {/* Scripture Input (Bottom) */}
                        <textarea 
                          className="w-full flex-1 border border-stone-300 rounded-lg p-4 font-serif text-lg resize-none focus:ring-2 focus:ring-stone-500 focus:outline-none bg-stone-50 min-h-[200px]"
                          value={editScripture}
                          onChange={(e) => setEditScripture(e.target.value)}
                          placeholder="Paste scripture here..."
                        />
                        <p className="text-xs text-stone-400">Tip: **bold**, ::red::, or _italic_</p>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full">
                        {/* --- TOP SECTION: Header, Audio, Meta --- */}
                        
                        {/* 1. Header */}
                        <div className="mb-4 pr-10"> 
                           <h3 className="text-sm text-stone-400 font-bold uppercase mb-4 tracking-widest">Scripture Reading</h3>
                           {data?.header && (
                             <h2 className="text-2xl md:text-3xl font-serif font-bold text-stone-900 leading-tight">
                               {data.header}
                             </h2>
                           )}
                        </div>

                        {/* 2. Reading Audio */}
                        {(data?.audioUrl || isAdmin) && (
                          <div className="mb-6 bg-stone-50 rounded-xl p-4 border border-stone-100">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-full">
                                <Headphones size={16} />
                              </div>
                              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Listen</span>
                            </div>
                            
                            {data?.audioUrl ? (
                              <audio controls src={data.audioUrl} className="w-full h-10" />
                            ) : (
                              <div className="text-xs text-stone-400 italic py-2 text-center">No reading audio.</div>
                            )}

                            {/* Upload Button */}
                            {isAdmin && (
                              <div className="mt-3 pt-3 border-t border-stone-200/50">
                                <input 
                                  type="file" 
                                  accept="audio/*" 
                                  className="hidden" 
                                  ref={readingInputRef}
                                  onChange={(e) => handleFileSelect(e, 'reading')}
                                />
                                <button 
                                  onClick={() => readingInputRef.current?.click()}
                                  disabled={isUploadingReading}
                                  className="w-full py-2 text-sm bg-stone-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors"
                                >
                                  {isUploadingReading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                  {data?.audioUrl ? 'Replace Audio' : 'Upload Audio'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 3. Group & Version */}
                        {(data?.group || data?.version) && (
                          <div className="flex gap-4 mb-6 pb-4 border-b border-stone-100">
                             {data?.group && <p className="font-bold text-stone-900">{data.group}</p>}
                             {data?.version && <p className="font-bold text-stone-500">{data.version}</p>}
                          </div>
                        )}

                        {/* 4. Scripture Text */}
                        <div className="prose prose-stone max-w-none flex-1 mb-8">
                           <div className="text-xl md:text-2xl font-serif leading-relaxed text-stone-800 whitespace-pre-wrap">
                             {renderScripture(data?.scripture)}
                           </div>
                        </div>

                        {/* 5. Review Audio (Bottom) */}
                        {(data?.reviewAudioUrl || isAdmin) && (
                          <div className="mt-auto bg-stone-50 rounded-xl p-4 border border-stone-100">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="p-2 bg-rose-100 text-rose-600 rounded-full">
                                <MessageCircle size={16} />
                              </div>
                              <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Chapter Review</span>
                            </div>
                            
                            {data?.reviewAudioUrl ? (
                              <audio controls src={data.reviewAudioUrl} className="w-full h-10" />
                            ) : (
                              <div className="text-xs text-stone-400 italic py-2 text-center">No review audio.</div>
                            )}

                            {/* Upload Button */}
                            {isAdmin && (
                              <div className="mt-3 pt-3 border-t border-stone-200/50">
                                <input 
                                  type="file" 
                                  accept="audio/*" 
                                  className="hidden" 
                                  ref={reviewInputRef}
                                  onChange={(e) => handleFileSelect(e, 'review')}
                                />
                                <button 
                                  onClick={() => reviewInputRef.current?.click()}
                                  disabled={isUploadingReview}
                                  className="w-full py-2 text-sm bg-stone-900 text-white rounded-lg flex items-center justify-center gap-2 hover:bg-stone-800 transition-colors"
                                >
                                  {isUploadingReview ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                  {data?.reviewAudioUrl ? 'Replace Review' : 'Upload Review'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </main>

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
                placeholder="Enter Password" 
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
                     <div className="text-stone-800 line-clamp-2 font-serif font-bold">{res.header}</div>
                     <div className="text-stone-600 line-clamp-2 font-serif">{res.scripture}</div>
                     <div className="flex gap-2 mt-1">
                        {res.group && <div className="text-xs font-bold text-stone-400">{res.group}</div>}
                        {res.version && <div className="text-xs font-bold text-stone-300 border-l border-stone-200 pl-2">{res.version}</div>}
                     </div>
                  </div>
                ))}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}