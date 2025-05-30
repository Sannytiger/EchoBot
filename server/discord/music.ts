/**
 * Music functionality for the Discord bot using YouTube
 */

import fetch from 'node-fetch';
import ytdl from '@distube/ytdl-core';
import { YouTube } from 'youtube-sr';
import { 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  VoiceConnection,
  getVoiceConnection
} from '@discordjs/voice';

interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: string;
  thumbnail: string;
}

/**
 * Search for a track on YouTube
 */
export async function searchYouTubeTrack(query: string): Promise<Track | null> {
  try {
    const results = await YouTube.search(query, { 
      limit: 1, 
      type: 'video' 
    });
    
    if (results.length === 0) {
      return null;
    }

    const video = results[0];
    
    return {
      id: video.id || '',
      title: video.title || 'Unknown Title',
      artist: video.channel?.name || 'Unknown Artist',
      url: video.url || '',
      duration: video.duration?.toString() || 'Unknown',
      thumbnail: video.thumbnail?.displayThumbnailURL('maxresdefault') || ''
    };
  } catch (error) {
    console.error('Error searching YouTube:', error);
    return null;
  }
}

/**
 * Play a track in a voice channel
 */
export async function playTrack(
  guildId: string, 
  track: Track
): Promise<{ success: boolean; message: string }> {
  try {
    // Get the voice connection for this guild
    const connection = getVoiceConnection(guildId);
    
    if (!connection) {
      return {
        success: false,
        message: 'Bot is not connected to a voice channel. Use /joinvoice first.'
      };
    }

    // Get the audio stream from YouTube
    const stream = ytdl(track.url, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25
    });

    // Create audio resource from the stream
    const resource = createAudioResource(stream);
    
    // Create or get the audio player
    const player = createAudioPlayer();
    
    // Subscribe the connection to the player
    connection.subscribe(player);
    
    // Play the resource
    player.play(resource);
    
    // Handle player events
    player.on(AudioPlayerStatus.Playing, () => {
      console.log(`Now playing: ${track.title} by ${track.artist}`);
    });
    
    player.on(AudioPlayerStatus.Idle, () => {
      console.log('Track finished playing');
    });
    
    player.on('error', (error) => {
      console.error('Audio player error:', error);
    });
    
    return {
      success: true,
      message: `🎵 Now playing: **${track.title}** by **${track.artist}** (${track.duration})\n[Watch on YouTube](${track.url})`
    };
  } catch (error) {
    console.error('Error playing track:', error);
    return {
      success: false,
      message: `Failed to play track: ${error}`
    };
  }
}

/**
 * Stop the current track
 */
export function stopTrack(guildId: string): { success: boolean; message: string } {
  try {
    const connection = getVoiceConnection(guildId);
    
    if (!connection) {
      return {
        success: false,
        message: 'Bot is not connected to a voice channel.'
      };
    }

    // Try to stop any audio players associated with the connection
    try {
      // Create a new player and stop it to clear any playing audio
      const player = createAudioPlayer();
      connection.subscribe(player);
      player.stop();
      
      return {
        success: true,
        message: '⏹️ Stopped playing music.'
      };
    } catch (stopError) {
      return {
        success: false,
        message: 'No music is currently playing.'
      };
    }
  } catch (error) {
    console.error('Error stopping track:', error);
    return {
      success: false,
      message: `Failed to stop track: ${error}`
    };
  }
}
