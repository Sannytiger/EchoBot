/**
 * Voice functionality for the Discord bot
 */

import { 
  Guild, 
  VoiceChannel, 
  GuildBasedChannel, 
  Client,
  ChannelType
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  AudioPlayerStatus,
  entersState,
  VoiceConnectionStatus,
  getVoiceConnection
} from '@discordjs/voice';

/**
 * Map to track the voice connections across different guilds
 */
const voiceConnections = new Map();

/**
 * Find the "general" voice channel or any voice channel in the guild
 * 
 * @param guild The Discord guild to search in
 * @returns The found voice channel or null if none exists
 */
export async function findVoiceChannel(guild: Guild): Promise<VoiceChannel | null> {
  try {
    // Fetch all channels
    await guild.channels.fetch();

    // First, look for a channel named "general"
    let voiceChannel = guild.channels.cache.find(
      (channel: GuildBasedChannel) => 
        channel.type === ChannelType.GuildVoice && 
        (channel.name.toLowerCase() === 'general' || channel.name.toLowerCase() === 'general voice')
    ) as VoiceChannel;

    // If no "general" channel, find the first voice channel
    if (!voiceChannel) {
      voiceChannel = guild.channels.cache.find(
        (channel: GuildBasedChannel) => channel.type === ChannelType.GuildVoice
      ) as VoiceChannel;
    }

    return voiceChannel || null;
  } catch (error) {
    console.error('Error finding voice channel:', error);
    return null;
  }
}

/**
 * Join a voice channel
 * 
 * @param client The Discord client
 * @param guildId The ID of the guild
 * @param channelId The ID of the voice channel to join
 * @returns A result object with success status and information
 */
export async function joinVoice(
  client: Client, 
  guildId: string, 
  channelId: string
): Promise<{ success: boolean; message: string; channelName?: string }> {
  try {
    // Check if already in the voice channel
    const existingConnection = getVoiceConnection(guildId);
    if (existingConnection) {
      return { 
        success: true, 
        message: 'Already connected to a voice channel. Use /leavevoice first if you want to switch channels.',
        channelName: 'Unknown'
      };
    }

    // Get the guild and channel
    const guild = await client.guilds.fetch(guildId);
    const channel = await guild.channels.fetch(channelId) as VoiceChannel;
    
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return { success: false, message: 'Invalid voice channel.' };
    }

    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    // Create an audio player to keep the connection active
    const player = createAudioPlayer();
    connection.subscribe(player);

    // Set up connection handling
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        // Try to reconnect if disconnected
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch (error) {
        // If reconnection fails, destroy the connection
        connection.destroy();
        voiceConnections.delete(guildId);
      }
    });

    // Store the connection
    voiceConnections.set(guildId, connection);

    return { 
      success: true, 
      message: `Successfully joined voice channel.`,
      channelName: channel.name
    };
  } catch (error) {
    console.error('Error joining voice channel:', error);
    return { 
      success: false, 
      message: `Failed to join voice channel: ${error}`
    };
  }
}

/**
 * Leave the current voice channel
 * 
 * @param guildId The ID of the guild
 * @returns A result object with success status and information
 */
export function leaveVoice(guildId: string): { success: boolean; message: string } {
  try {
    // Get the connection
    const connection = getVoiceConnection(guildId);
    
    if (!connection) {
      return { success: false, message: 'Not connected to any voice channel.' };
    }

    // Destroy the connection
    connection.destroy();
    voiceConnections.delete(guildId);

    return { success: true, message: 'Successfully left the voice channel.' };
  } catch (error) {
    console.error('Error leaving voice channel:', error);
    return { success: false, message: `Failed to leave voice channel: ${error}` };
  }
}

/**
 * Check if the bot is in a voice channel in the guild
 * 
 * @param guildId The ID of the guild
 * @returns Whether the bot is in a voice channel
 */
export function isInVoice(guildId: string): boolean {
  const connection = getVoiceConnection(guildId);
  return !!connection;
}
