"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  collection, addDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp, doc, where, getDoc,
} from "firebase/firestore";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

const SHARPS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const FLATS  = ["C","Db","D","Eb","E","F","Gb","G","Ab","A","Bb","B"];

function transposeChord(chord: string, st: number, useFlats: boolean): string {
  if (st === 0) return chord;
  const scale = useFlats ? FLATS : SHARPS;
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return chord;
  const idx = SHARPS.findIndex(n => n.toLowerCase() === m[1].toLowerCase()) !== -1
    ? SHARPS.findIndex(n => n.toLowerCase() === m[1].toLowerCase())
    : FLATS.findIndex(n => n.toLowerCase() === m[1].toLowerCase());
  if (idx === -1) return chord;
  return scale[((idx + st) % 12 + 12) % 12] + m[2];
}

interface Song {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  chords: string;
  key: string;
  youtube?: string;
  createdByUsername?: string;
}

interface Playlist {
  id: string;
  name: string;
}

interface Note {
  id: string;
  content: string;
  songId: string;
}

const CHORD_COLORS: Record<string, string> = {
  m: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  maj: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "7": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  dim: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  sus: "bg-teal-500/20 text-teal-300 border-teal-500/30",
  default: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
};

function getChordColor(chord: string): string {
  if (/dim/.test(chord)) return CHORD_COLORS.dim;
  if (/sus/.test(chord)) return CHORD_COLORS.sus;
  if (/7|9|11|13/.test(chord)) return CHORD_COLORS["7"];
  if (/maj/.test(chord)) return CHORD_COLORS.maj;
  if (/m/.test(chord.slice(1))) return CHORD_COLORS.m;
  return CHORD_COLORS.default;
}

export default function Home() {
  const [user, loading] = useAuthState(auth);
  const isAdmin = user?.email === "orhanezgihatice@gmail.com";
  const router = useRouter();

  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [semitones, setSemitones] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({ title:"", artist:"", lyrics:"", chords:"", key:"Am", youtube:"" });

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [showPlaylistForm, setShowPlaylistForm] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");
  const [activeTab, setActiveTab] = useState<"songs"|"playlists">("songs");

  useEffect(() => {
    if (!loading && !user) router.push("/auth");
  }, [user, loading, router]);

  useEffect(() => {
    if (user) { loadSongs(); loadPlaylists(); }
  }, [user]);

  useEffect(() => {
    if (selectedSong && user) loadNotes(selectedSong.id);
  }, [selectedSong]);

  const loadSongs = async () => {
    const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Song)));
  };

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault();
    const userDoc = await getDoc(doc(db, "users", user!.uid));
    const username = userDoc.data()?.username || user!.email?.split("@")[0];
    await addDoc(collection(db, "songs"), {
      ...form, createdBy: user!.uid, createdByUsername: username, createdAt: serverTimestamp(),
    });
    setForm({ title:"", artist:"", lyrics:"", chords:"", key:"Am", youtube:"" });
    setShowForm(false);
    loadSongs();
  };

  const deleteSong = async (songId: string) => {
    await deleteDoc(doc(db, "songs", songId));
    if (selectedSong?.id === songId) setSelectedSong(null);
    loadSongs();
  };

  const loadPlaylists = async () => {
    const q = query(collection(db, "playlists"), where("createdBy", "==", user!.uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist)));
  };

  const addPlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName.trim()) return;
    await addDoc(collection(db, "playlists"), {
      name: playlistName, createdBy: user!.uid, createdAt: serverTimestamp(), songIds: [],
    });
    setPlaylistName("");
    setShowPlaylistForm(false);
    loadPlaylists();
  };

  const deletePlaylist = async (playlistId: string) => {
    await deleteDoc(doc(db, "playlists", playlistId));
    setSelectedPlaylist(null);
    setPlaylistSongs([]);
    loadPlaylists();
  };

  const loadPlaylistSongs = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    const q = query(collection(db, "playlist_songs"), where("playlistId", "==", playlist.id));
    const snap = await getDocs(q);
    const songIds = snap.docs.map(d => (d.data() as any).songId);
    const allSongs = await getDocs(query(collection(db, "songs"), orderBy("createdAt", "desc")));
    const allSongsList = allSongs.docs.map(d => ({ id: d.id, ...d.data() } as Song));
    setPlaylistSongs(allSongsList.filter(s => songIds.includes(s.id)));
    setSelectedSong(null);
  };

  const addSongToPlaylist = async (playlistId: string, songId: string) => {
    await addDoc(collection(db, "playlist_songs"), { playlistId, songId, createdAt: serverTimestamp() });
    setShowAddToPlaylist(false);
  };

  const loadNotes = async (songId: string) => {
    const q = query(collection(db, "notes"), where("songId", "==", songId), where("userId", "==", user!.uid));
    const snap = await getDocs(q);
    setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedSong) return;
    await addDoc(collection(db, "notes"), { content: newNote, songId: selectedSong.id, userId: user!.uid, createdAt: serverTimestamp() });
    setNewNote("");
    loadNotes(selectedSong.id);
  };

  const deleteNote = async (noteId: string) => {
    await deleteDoc(doc(db, "notes", noteId));
    if (selectedSong) loadNotes(selectedSong.id);
  };

  const filteredSongs = songs.filter(song =>
    song.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    song.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentChords = selectedSong
    ? selectedSong.chords.split(",").map(c => transposeChord(c.trim(), semitones, false))
    : [];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"/>
        <span className="text-sm">Yükleniyor...</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">ChordHub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500">{user?.email}</span>
            <button onClick={() => signOut(auth)}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-500/30">
              Çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex gap-6">

        {/* Sol panel */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 bg-gray-900/50 p-4 rounded-2xl border border-white/5">

          {/* Sekmeler */}
          <div className="flex bg-gray-900 rounded-xl p-1 border border-white/5">
            <button onClick={() => setActiveTab("songs")}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
                activeTab === "songs" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-gray-400 hover:text-gray-200"}`}>
              Şarkılar
            </button>
            <button onClick={() => setActiveTab("playlists")}
              className={`flex-1 text-xs py-2 rounded-lg font-medium transition-all ${
                activeTab === "playlists" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-gray-400 hover:text-gray-200"}`}>
              Listelerim
            </button>
          </div>

          {activeTab === "songs" && (
            <>
              {/* Arama */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">🔍</span>
                <input placeholder="Ara..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 focus:bg-gray-800 transition-all" />
              </div>

              {/* Ekle butonu */}
              <button onClick={() => setShowForm(!showForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 hover:border-indigo-500/50 hover:text-indigo-400 text-sm transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Şarkı Ekle
              </button>

              {/* Form */}
              {showForm && (
                <form onSubmit={addSong} className="bg-gray-900 rounded-xl border border-white/10 p-4 flex flex-col gap-2.5">
                  {[
                    { placeholder: "Başlık", key: "title", required: true },
                    { placeholder: "Sanatçı", key: "artist", required: true },
                    { placeholder: "Ton (Am, G...)", key: "key", required: false },
                    { placeholder: "Akorlar (Am,F,C,G)", key: "chords", required: false },
                    { placeholder: "YouTube linki", key: "youtube", required: false },
                  ].map(f => (
                    <input key={f.key} placeholder={f.placeholder} required={f.required}
                      value={(form as any)[f.key]}
                      onChange={e => setForm({...form, [f.key]: e.target.value})}
                      className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all" />
                  ))}
                  <textarea placeholder="Şarkı sözleri" value={form.lyrics}
                    onChange={e => setForm({...form, lyrics: e.target.value})}
                    rows={3} className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all resize-none" />
                  <button type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20">
                    Kaydet
                  </button>
                </form>
              )}

              {/* Şarkı listesi */}
              <div className="flex flex-col gap-2">
                {filteredSongs.map(song => (
                  <button key={song.id}
                    onClick={() => { setSelectedSong(song); setSemitones(0); setSelectedPlaylist(null); }}
                    className={`text-left p-3.5 rounded-xl border transition-all group ${
                      selectedSong?.id === song.id
                        ? "bg-indigo-600/10 border-indigo-500/30"
                        : "bg-gray-900 border-white/5 hover:border-white/10 hover:bg-gray-800"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm truncate ${selectedSong?.id === song.id ? "text-indigo-300" : "text-gray-200"}`}>
                          {song.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{song.artist}</p>
                        {song.createdByUsername && (
                          <p className="text-xs text-gray-600 mt-0.5">@{song.createdByUsername}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">{song.key}</span>
                        {isAdmin && (
                          <span onClick={(e) => { e.stopPropagation(); deleteSong(song.id); }}
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs">✕</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredSongs.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    <div className="text-3xl mb-2">🎵</div>
                    <p className="text-sm">Şarkı bulunamadı</p>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "playlists" && (
            <>
              <button onClick={() => setShowPlaylistForm(!showPlaylistForm)}
                className="w-full py-2.5 rounded-xl border border-dashed border-white/10 text-gray-500 hover:border-indigo-500/50 hover:text-indigo-400 text-sm transition-all flex items-center justify-center gap-2">
                <span className="text-lg">+</span> Yeni Liste
              </button>
              {showPlaylistForm && (
                <form onSubmit={addPlaylist} className="bg-gray-900 rounded-xl border border-white/10 p-4 flex flex-col gap-2">
                  <input placeholder="Liste adı" required value={playlistName}
                    onChange={e => setPlaylistName(e.target.value)}
                    className="bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50" />
                  <button type="submit"
                    className="bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-500 transition-colors">
                    Oluştur
                  </button>
                </form>
              )}
              <div className="flex flex-col gap-2">
                {playlists.map(pl => (
                  <button key={pl.id} onClick={() => loadPlaylistSongs(pl)}
                    className={`text-left p-3.5 rounded-xl border transition-all group ${
                      selectedPlaylist?.id === pl.id ? "bg-indigo-600/10 border-indigo-500/30" : "bg-gray-900 border-white/5 hover:border-white/10"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🎵</span>
                        <p className={`font-medium text-sm ${selectedPlaylist?.id === pl.id ? "text-indigo-300" : "text-gray-200"}`}>{pl.name}</p>
                      </div>
                      {isAdmin && (
                        <span onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id); }}
                          className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all text-xs">✕</span>
                      )}
                    </div>
                  </button>
                ))}
                {playlists.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    <div className="text-3xl mb-2">📋</div>
                    <p className="text-sm">Henüz liste yok</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sağ panel */}
        <div className="flex-1 min-w-0">
          {selectedPlaylist && !selectedSong ? (
            <div className="bg-gray-900 rounded-2xl border border-white/5 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-indigo-600/20 rounded-xl flex items-center justify-center text-2xl">🎵</div>
                <h2 className="text-2xl font-bold text-gray-100">{selectedPlaylist.name}</h2>
              </div>
              <div className="flex flex-col gap-2">
                {playlistSongs.length === 0 ? (
                  <p className="text-gray-600 text-sm">Bu listede henüz şarkı yok</p>
                ) : (
                  playlistSongs.map(song => (
                    <button key={song.id} onClick={() => setSelectedSong(song)}
                      className="text-left p-4 rounded-xl border border-white/5 bg-gray-800/50 hover:border-indigo-500/30 hover:bg-gray-800 transition-all">
                      <p className="font-medium text-gray-200">{song.title}</p>
                      <p className="text-sm text-gray-500">{song.artist} · {song.key}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : selectedSong ? (
            <div className="bg-gray-900 rounded-2xl border border-white/5 overflow-hidden">
              {/* Şarkı başlık alanı */}
              <div className="bg-gradient-to-br from-indigo-900/40 via-purple-900/20 to-gray-900 p-8 border-b border-white/5">
                <button onClick={() => setSelectedSong(null)}
                  className="text-xs text-gray-500 hover:text-indigo-400 mb-6 flex items-center gap-1.5 transition-colors">
                  ← Geri
                </button>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-100 mb-1">{selectedSong.title}</h2>
                    <p className="text-gray-400 text-lg">{selectedSong.artist}</p>
                    {selectedSong.createdByUsername && (
                      <p className="text-xs text-gray-600 mt-1">@{selectedSong.createdByUsername} tarafından eklendi</p>
                    )}
                  </div>
                  <button onClick={() => setShowAddToPlaylist(!showAddToPlaylist)}
                    className="text-xs bg-white/5 hover:bg-white/10 text-gray-400 hover:text-gray-200 px-4 py-2 rounded-lg border border-white/10 transition-all flex-shrink-0">
                    + Listeye Ekle
                  </button>
                </div>

                {showAddToPlaylist && (
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-xl border border-white/10">
                    <p className="text-xs text-gray-500 mb-2">Hangi listeye ekleyelim?</p>
                    <div className="flex flex-col gap-1">
                      {playlists.map(pl => (
                        <button key={pl.id}
                          onClick={() => { addSongToPlaylist(pl.id, selectedSong.id); setShowAddToPlaylist(false); }}
                          className="text-left text-sm text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors">
                          🎵 {pl.name}
                        </button>
                      ))}
                      {playlists.length === 0 && <p className="text-xs text-gray-600">Önce liste oluştur</p>}
                    </div>
                  </div>
                )}

                {selectedSong.youtube && (
                  <a href={selectedSong.youtube} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 text-sm text-red-400 hover:text-red-300 transition-colors">
                    <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs">▶</span>
                    YouTube'da Dinle
                  </a>
                )}
              </div>

              <div className="p-8">
                {/* Transpoze */}
                <div className="flex items-center gap-3 bg-gray-800/50 rounded-xl px-4 py-3 mb-6 border border-white/5">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Transpoze</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <button onClick={() => setSemitones(s => Math.max(s-1, -6))}
                      className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold transition-colors">−</button>
                    <span className={`font-mono font-bold w-10 text-center text-sm ${semitones === 0 ? "text-gray-500" : "text-indigo-400"}`}>
                      {semitones > 0 ? `+${semitones}` : semitones}
                    </span>
                    <button onClick={() => setSemitones(s => Math.min(s+1, 6))}
                      className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-bold transition-colors">+</button>
                  </div>
                  {semitones !== 0 && (
                    <button onClick={() => setSemitones(0)} className="text-xs text-gray-600 hover:text-red-400 transition-colors">Sıfırla</button>
                  )}
                </div>

                {/* Akorlar */}
                <div className="flex flex-wrap gap-2 mb-8">
                  {currentChords.map((chord, i) => (
                    <span key={i} className={`px-4 py-2 rounded-xl text-base font-bold border ${getChordColor(chord)}`}>
                      {chord}
                    </span>
                  ))}
                </div>

                {/* Sözler */}
                <pre className="font-mono text-sm text-gray-400 whitespace-pre-wrap leading-8 mb-10">
                  {selectedSong.lyrics}
                </pre>

                {/* Notlar */}
                <div className="border-t border-white/5 pt-8">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Kişisel Notlarım</h3>
                  <form onSubmit={addNote} className="flex gap-2 mb-4">
                    <input placeholder="Not ekle..." value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      className="flex-1 bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500/50 transition-all" />
                    <button type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors">
                      Ekle
                    </button>
                  </form>
                  <div className="flex flex-col gap-2">
                    {notes.map(note => (
                      <div key={note.id} className="flex items-start justify-between bg-amber-500/5 border border-amber-500/10 rounded-xl p-3.5">
                        <p className="text-sm text-gray-300">{note.content}</p>
                        <button onClick={() => deleteNote(note.id)}
                          className="text-gray-700 hover:text-red-400 transition-colors ml-3 flex-shrink-0 text-xs">✕</button>
                      </div>
                    ))}
                    {notes.length === 0 && <p className="text-xs text-gray-700">Henüz not yok</p>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <div className="w-20 h-20 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-4xl mb-4">🎸</div>
              <h3 className="text-gray-400 font-medium mb-1">Bir şarkı seçin</h3>
              <p className="text-gray-700 text-sm">Soldan bir şarkıya tıklayarak başlayın</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}