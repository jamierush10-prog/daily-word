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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    // UPDATED: Removed "overflow-hidden" and "flex-col" to allow native body scrolling
    <div className="min-h-screen bg-stone-50 font-sans text-stone-900 relative">
      
      {/* --- Header --- */}
      <header className="bg-white border-b border-stone-200 p-4 shadow-sm flex items-center justify-between sticky top-0 z-30">
{/* ... existing code ... */}
      </header>

      {/* --- Main Content Area --- */}
      {/* UPDATED: Increased padding-bottom to pb-40 so content isn't hidden behind footer */}
      <main className="pb-40">
        
        {/* Date Navigation */}
        <div className="flex items-center justify-between p-6 bg-white/50 backdrop-blur-sm">
{/* ... existing code ... */}
        {/* Scripture Card */}
        <div className="px-4 max-w-2xl mx-auto w-full">
          <div className="bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden min-h-[300px] relative flex flex-col">
            {loading ? (
{/* ... existing code ... */}
            )}
          </div>
        </div>

      </main>

      {/* --- Audio Controller (Sticky Bottom) --- */}
      {/* UPDATED: Added "fixed bottom-0 left-0 right-0" to make it stationary */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 pb-8 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
        <div className="max-w-2xl mx-auto">
          
          {/* If there is audio, show player */}
          {data?.audioUrl && !isRecording && (
{/* ... existing code ... */}