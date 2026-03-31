"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  collection, addDoc, getDocs, deleteDoc,
  query, orderBy, serverTimestamp, doc, where,
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

export default function Home() {
  const [user, loading] = useAuthState(auth);
  const isAdmin = user?.email === "orhanezgihatice@gmail.com";
  const router = useRouter();

  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [semitones, setSemitones] = useState(0);
  const [showForm, setShowForm] = useState(false);
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
    if (user) {
      loadSongs();
      loadPlaylists();
    }
  }, [user]);

  useEffect(() => {
    if (selectedSong && user) loadNotes(selectedSong.id);
  }, [selectedSong]);

  const loadSongs = async () => {
    const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setSongs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Song)));
  };
  const deleteSong = async (songId: string) => {
  await deleteDoc(doc(db, "songs", songId));
  if (selectedSong?.id === songId) setSelectedSong(null);
  loadSongs();
};

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "songs"), {
      ...form, createdBy: user!.uid, createdAt: serverTimestamp(),
    });
    setForm({ title:"", artist:"", lyrics:"", chords:"", key:"Am", youtube:"" });
    setShowForm(false);
    loadSongs();
  };

  const loadPlaylists = async () => {
    const q = query(collection(db, "playlists"),
      where("createdBy", "==", user!.uid), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() } as Playlist)));
  };
  const deletePlaylist = async (playlistId: string) => {
  await deleteDoc(doc(db, "playlists", playlistId));
  setSelectedPlaylist(null);
  setPlaylistSongs([]);
  loadPlaylists();
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

  const loadPlaylistSongs = async (playlist: Playlist) => {
  setSelectedPlaylist(playlist);
  const q = query(
    collection(db, "playlist_songs"),
    where("playlistId", "==", playlist.id)
  );
  const snap = await getDocs(q);
  const songIds = snap.docs.map(d => (d.data() as any).songId);
  const allSongs = await getDocs(query(collection(db, "songs"), orderBy("createdAt", "desc")));
  const allSongsList = allSongs.docs.map(d => ({ id: d.id, ...d.data() } as Song));
  const filtered = allSongsList.filter(s => songIds.includes(s.id));
  setPlaylistSongs(filtered);
  
};

  const addSongToPlaylist = async (playlistId: string, songId: string) => {
  await addDoc(collection(db, "playlist_songs"), {
    playlistId,
    songId,
    createdAt: serverTimestamp(),
  });
  setShowAddToPlaylist(false);
  alert("Şarkı listeye eklendi!");
};
  const loadNotes = async (songId: string) => {
    const q = query(collection(db, "notes"),
      where("songId", "==", songId), where("userId", "==", user!.uid));
    const snap = await getDocs(q);
    setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Note)));
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !selectedSong) return;
    await addDoc(collection(db, "notes"), {
      content: newNote, songId: selectedSong.id,
      userId: user!.uid, createdAt: serverTimestamp(),
    });
    setNewNote("");
    loadNotes(selectedSong.id);
  };

  const deleteNote = async (noteId: string) => {
    await deleteDoc(doc(db, "notes", noteId));
    if (selectedSong) loadNotes(selectedSong.id);
  };

  const currentChords = selectedSong
    ? selectedSong.chords.split(",").map(c => transposeChord(c.trim(), semitones, false))
    : [];

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-slate-400">Yükleniyor...</div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-indigo-600">🎵 ChordHub</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.email}</span>
          <button onClick={() => signOut(auth)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors">Çıkış</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 flex gap-6">
        {/* Sol panel */}
        <div className="w-72 flex-shrink-0">
          {/* Sekmeler */}
          <div className="flex mb-4 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setActiveTab("songs")}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "songs" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>
              Şarkılar
            </button>
            <button onClick={() => setActiveTab("playlists")}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                activeTab === "playlists" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"}`}>
              Listelerim
            </button>
          </div>

          {activeTab === "songs" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Tüm Şarkılar</span>
                {isAdmin && <button onClick={() => setShowForm(!showForm)} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">+ Ekle</button>}
              </div>
              {showForm && (
                <form onSubmit={addSong} className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col gap-2">
                  <input placeholder="Başlık" required value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input placeholder="Sanatçı" required value={form.artist}
                    onChange={e => setForm({...form, artist: e.target.value})}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <input placeholder="Ton (örn: Am)" value={form.key}
                    onChange={e => setForm({...form, key: e.target.value})}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
<input placeholder="YouTube linki (https://...)" value={form.youtube} onChange={e => setForm({...form, youtube: e.target.value})} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <textarea placeholder="Şarkı sözleri" value={form.lyrics}
                    onChange={e => setForm({...form, lyrics: e.target.value})}
                    rows={3} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                  <button type="submit"
                    className="bg-indigo-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-indigo-700">Kaydet</button>
                </form>
              )}
              <div className="flex flex-col gap-2">
                {songs.map(song => (
                  <button key={song.id}
                    onClick={() => { setSelectedSong(song); setSemitones(0); }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedSong?.id === song.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:border-indigo-200"}`}>
                    <div className="flex items-center justify-between">
  <div>
    <p className="font-medium text-sm text-slate-800">{song.title}</p>
    <p className="text-xs text-slate-400">{song.artist} · {song.key}</p>
  </div>
  <span
    onClick={(e) => { e.stopPropagation(); if(isAdmin) deleteSong(song.id); }}
    className="text-xs text-slate-300 hover:text-red-400 flex-shrink-0 ml-2"
  >✕</span>
</div>
                  </button>
                ))}
                {songs.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Henüz şarkı yok</p>}
              </div>
            </>
          )}

          {activeTab === "playlists" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-slate-600">Çalma Listeleri</span>
                <button onClick={() => setShowPlaylistForm(!showPlaylistForm)}
                  className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700">+ Yeni</button>
              </div>
              {showPlaylistForm && (
                <form onSubmit={addPlaylist} className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col gap-2">
                  <input placeholder="Liste adı" required value={playlistName}
                    onChange={e => setPlaylistName(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="submit"
                    className="bg-indigo-600 text-white rounded-lg py-1.5 text-sm font-medium hover:bg-indigo-700">Oluştur</button>
                </form>
              )}
              <div className="flex flex-col gap-2">
                {playlists.map(pl => (
                  <button key={pl.id} onClick={() => loadPlaylistSongs(pl)}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selectedPlaylist?.id === pl.id ? "bg-indigo-50 border-indigo-200" : "bg-white border-slate-200 hover:border-indigo-200"}`}>
                    <div className="flex items-center justify-between">
  <p className="font-medium text-sm text-slate-800">🎵 {pl.name}</p>
  {isAdmin && <span
  onClick={(e) => { e.stopPropagation(); deletePlaylist(pl.id); }}
  className="text-xs text-slate-300 hover:text-red-400 flex-shrink-0 ml-2"
>✕</span>}
</div>
                  </button>
                ))}
                {playlists.length === 0 && <p className="text-sm text-slate-400 text-center py-8">Henüz liste yok</p>}
              </div>
            </>
          )}
        </div>

        {/* Sağ panel */}
        <div className="flex-1">
          {selectedPlaylist && !selectedSong ? (
  <div className="bg-white rounded-xl border border-slate-200 p-6">
    <h2 className="text-xl font-bold text-slate-800 mb-4">🎵 {selectedPlaylist.name}</h2>
    <div className="flex flex-col gap-2">
      {playlistSongs.length === 0 ? (
        <p className="text-sm text-slate-400">Bu listede henüz şarkı yok</p>
      ) : (
        playlistSongs.map(song => (
          <button key={song.id}
            onClick={() => setSelectedSong(song)}
            className="text-left p-3 rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-200 transition-all">
            <p className="font-medium text-sm text-slate-800">{song.title}</p>
            <p className="text-xs text-slate-400">{song.artist} · {song.key}</p>
          </button>
        ))
      )}
    </div>
  </div>
) : null}
          {selectedSong ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <button
  onClick={() => setSelectedSong(null)}
  className="text-xs text-slate-400 hover:text-indigo-500 mb-4 flex items-center gap-1"
>
  ← Geri
</button>
                  <h2 className="text-2xl font-bold text-slate-800">{selectedSong.title}</h2>
                  <p className="text-slate-500">{selectedSong.artist}</p>
                  {selectedSong.youtube && (
  <a href={selectedSong.youtube} target="_blank" rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 mb-4">
    ▶ YouTube'da Dinle
  </a>
)}
                </div>
                <button onClick={() => setShowAddToPlaylist(!showAddToPlaylist)}
                  className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200">
                  + Listeye Ekle
                </button>
              </div>

              {showAddToPlaylist && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-500 mb-2">Hangi listeye ekleyelim?</p>
                  <div className="flex flex-col gap-1">
                    {playlists.map(pl => (
                      <button key={pl.id}
                        onClick={() => { addSongToPlaylist(pl.id, selectedSong.id); setShowAddToPlaylist(false); }}
                        className="text-left text-sm text-indigo-600 hover:underline px-2 py-1">
                        {pl.name}
                      </button>
                    ))}
                    {playlists.length === 0 && <p className="text-xs text-slate-400">Önce liste oluştur</p>}
                  </div>
                </div>
              )}

              {/* Transpoze */}
              <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3 mb-6">
                <span className="text-sm text-slate-500 font-medium">Transpoze</span>
                <button onClick={() => setSemitones(s => Math.max(s-1, -6))}
                  className="w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-sm font-bold">−</button>
                <span className={`font-mono font-bold w-8 text-center ${semitones === 0 ? "text-slate-400" : "text-indigo-600"}`}>
                  {semitones > 0 ? `+${semitones}` : semitones}
                </span>
                <button onClick={() => setSemitones(s => Math.min(s+1, 6))}
                  className="w-7 h-7 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-sm font-bold">+</button>
                {semitones !== 0 && (
                  <button onClick={() => setSemitones(0)} className="text-xs text-slate-400 hover:text-red-400 ml-auto">Sıfırla</button>
                )}
              </div>

              {/* Akorlar */}
              <div className="flex flex-wrap gap-2 mb-6">
                {currentChords.map((chord, i) => (
                  <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100">
                    {chord}
                  </span>
                ))}
              </div>

              {/* Sözler */}
              <pre className="font-mono text-sm text-slate-700 whitespace-pre-wrap leading-7 mb-8">
                {selectedSong.lyrics}
              </pre>

              {/* Notlar */}
              <div className="border-t border-slate-100 pt-6">
                <h3 className="font-semibold text-slate-700 mb-3">Kişisel Notlarım</h3>
                <form onSubmit={addNote} className="flex gap-2 mb-4">
                  <input placeholder="Not ekle..." value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  <button type="submit"
                    className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700">Ekle</button>
                </form>
                <div className="flex flex-col gap-2">
                  {notes.map(note => (
                    <div key={note.id} className="flex items-start justify-between bg-amber-50 border border-amber-100 rounded-lg p-3">
                      <p className="text-sm text-slate-700">{note.content}</p>
                      <button onClick={() => deleteNote(note.id)}
                        className="text-xs text-slate-300 hover:text-red-400 ml-3 flex-shrink-0">✕</button>
                    </div>
                  ))}
                  {notes.length === 0 && <p className="text-xs text-slate-400">Henüz not yok</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              Soldaki listeden bir şarkı seçin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}