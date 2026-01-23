import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Track {
  id: string;
  title: string;
  artistName?: string;
  albumName?: string;
  albumImage?: string;
  duration?: number;
  audioUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  coverImage?: string;
  tracks: Track[];
}

interface MusicState {
  // Current state
  currentTrack: Track | null;
  currentPlaylist: Playlist | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  isShuffled: boolean;
  repeatMode: "off" | "all" | "one";
  queue: Track[];
  queueIndex: number;
  
  // Mini player visibility
  isPlayerVisible: boolean;
  isPlayerExpanded: boolean;
  
  // Actions
  setTrack: (track: Track, playlist?: Playlist) => void;
  setPlaylist: (playlist: Playlist, startIndex?: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  clearQueue: () => void;
  showPlayer: () => void;
  hidePlayer: () => void;
  toggleExpanded: () => void;
}

export const useMusicStore = create<MusicState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentTrack: null,
      currentPlaylist: null,
      isPlaying: false,
      volume: 0.8,
      progress: 0,
      duration: 0,
      isShuffled: false,
      repeatMode: "off",
      queue: [],
      queueIndex: 0,
      isPlayerVisible: false,
      isPlayerExpanded: false,

      // Actions
      setTrack: (track, playlist) => {
        set({
          currentTrack: track,
          currentPlaylist: playlist || null,
          isPlaying: true,
          progress: 0,
          isPlayerVisible: true,
        });
        
        if (playlist) {
          const index = playlist.tracks.findIndex(t => t.id === track.id);
          set({
            queue: playlist.tracks,
            queueIndex: index >= 0 ? index : 0,
          });
        }
      },

      setPlaylist: (playlist, startIndex = 0) => {
        const track = playlist.tracks[startIndex];
        if (!track) return;
        
        set({
          currentTrack: track,
          currentPlaylist: playlist,
          queue: get().isShuffled ? shuffleArray(playlist.tracks, startIndex) : playlist.tracks,
          queueIndex: startIndex,
          isPlaying: true,
          progress: 0,
          isPlayerVisible: true,
        });
      },

      play: () => set({ isPlaying: true }),
      
      pause: () => set({ isPlaying: false }),
      
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

      next: () => {
        const { queue, queueIndex, repeatMode, isShuffled, currentPlaylist } = get();
        
        if (queue.length === 0) return;
        
        let nextIndex = queueIndex + 1;
        
        if (nextIndex >= queue.length) {
          if (repeatMode === "all") {
            nextIndex = 0;
          } else {
            // End of queue
            set({ isPlaying: false });
            return;
          }
        }
        
        const nextTrack = queue[nextIndex];
        if (nextTrack) {
          set({
            currentTrack: nextTrack,
            queueIndex: nextIndex,
            progress: 0,
            isPlaying: true,
          });
        }
      },

      previous: () => {
        const { queue, queueIndex, progress } = get();
        
        // If more than 3 seconds in, restart current track
        if (progress > 3) {
          set({ progress: 0 });
          return;
        }
        
        if (queue.length === 0) return;
        
        let prevIndex = queueIndex - 1;
        if (prevIndex < 0) {
          prevIndex = queue.length - 1;
        }
        
        const prevTrack = queue[prevIndex];
        if (prevTrack) {
          set({
            currentTrack: prevTrack,
            queueIndex: prevIndex,
            progress: 0,
            isPlaying: true,
          });
        }
      },

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      
      setProgress: (progress) => set({ progress }),
      
      setDuration: (duration) => set({ duration }),

      toggleShuffle: () => {
        const { isShuffled, currentPlaylist, queueIndex, queue, currentTrack } = get();
        
        if (!currentPlaylist) return;
        
        if (!isShuffled) {
          // Enable shuffle
          const shuffled = shuffleArray(currentPlaylist.tracks, queueIndex);
          set({
            isShuffled: true,
            queue: shuffled,
            queueIndex: 0, // Current track is now first
          });
        } else {
          // Disable shuffle - restore original order
          const originalIndex = currentTrack 
            ? currentPlaylist.tracks.findIndex(t => t.id === currentTrack.id)
            : 0;
          set({
            isShuffled: false,
            queue: currentPlaylist.tracks,
            queueIndex: originalIndex >= 0 ? originalIndex : 0,
          });
        }
      },

      toggleRepeat: () => {
        const { repeatMode } = get();
        const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
        const currentIndex = modes.indexOf(repeatMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        set({ repeatMode: nextMode });
      },

      addToQueue: (track) => {
        set((state) => ({
          queue: [...state.queue, track],
        }));
      },

      clearQueue: () => set({ queue: [], queueIndex: 0 }),

      showPlayer: () => set({ isPlayerVisible: true }),
      
      hidePlayer: () => set({ isPlayerVisible: false, isPlaying: false }),
      
      toggleExpanded: () => set((state) => ({ isPlayerExpanded: !state.isPlayerExpanded })),
    }),
    {
      name: "music-player-storage",
      partialize: (state) => ({
        volume: state.volume,
        isShuffled: state.isShuffled,
        repeatMode: state.repeatMode,
      }),
    }
  )
);

// Helper function to shuffle array keeping current track first
function shuffleArray(array: Track[], currentIndex: number): Track[] {
  const currentTrack = array[currentIndex];
  const otherTracks = array.filter((_, i) => i !== currentIndex);
  
  // Fisher-Yates shuffle
  for (let i = otherTracks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherTracks[i], otherTracks[j]] = [otherTracks[j], otherTracks[i]];
  }
  
  return currentTrack ? [currentTrack, ...otherTracks] : otherTracks;
}
