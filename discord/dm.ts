/**
 * Direct messaging functionality for the Discord bot
 */

import { Client, Guild, GuildMember, User, TextChannel } from 'discord.js';

/**
 * Send a direct message to a specific user
 * 
 * @param client The Discord client
 * @param userId The ID of the user to message
 * @param message The message to send
 * @returns A result object with success status and any error message
 */
export async function sendDirectMessage(
  client: Client,
  userId: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the user
    const user = await client.users.fetch(userId);
    
    if (!user) {
      return { success: false, error: 'User not found' };
    }
    
    // Send the DM
    const dmChannel = await user.createDM();
    await dmChannel.send(message);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to send DM:', error);
    return { 
      success: false, 
      error: 'Failed to send direct message. The user may have DMs disabled or the bot is blocked.' 
    };
  }
}

/**
 * Find a user by their username in a guild
 * 
 * @param guild The guild to search in
 * @param username The username to search for
 * @returns The guild member or null if not found
 */
export async function findUserByUsername(
  guild: Guild,
  username: string
): Promise<GuildMember | null> {
  try {
    // Fetch all guild members
    await guild.members.fetch();
    
    // Find the member with the matching username
    const member = guild.members.cache.find(
      (member) => 
        member.user.username.toLowerCase() === username.toLowerCase() || 
        member.displayName.toLowerCase() === username.toLowerCase()
    );
    
    return member || null;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

/**
 * Send a direct message to all members of a guild
 * 
 * @param guild The guild whose members should receive the message
 * @param message The message to send
 * @param progressChannel An optional channel to send progress updates to
 * @returns Stats about the DM operation
 */
export async function sendDirectMessageToAllMembers(
  guild: Guild,
  message: string,
  progressChannel?: TextChannel
): Promise<{ 
  total: number; 
  sent: number; 
  failed: number; 
  errors: string[] 
}> {
  const stats = {
    total: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  try {
    // Fetch all guild members
    await guild.members.fetch();
    
    // Get all members excluding bots
    const members = guild.members.cache.filter(member => !member.user.bot);
    stats.total = members.size;
    
    if (progressChannel) {
      await progressChannel.send(`Starting to send DMs to ${stats.total} members...`);
    }
    
    // Send DMs to each member
    const membersArray = Array.from(members.values());
    for (const member of membersArray) {
      try {
        const user = member.user;
        const dmChannel = await user.createDM();
        await dmChannel.send(message);
        
        stats.sent++;
        
        // Send progress update every 5 members
        if (progressChannel && stats.sent % 5 === 0) {
          await progressChannel.send(`Progress: ${stats.sent}/${stats.total} messages sent.`);
        }
      } catch (error) {
        console.error(`Failed to send DM to ${member.user.tag}:`, error);
        stats.failed++;
        stats.errors.push(`Could not message ${member.user.tag}: ${error}`);
      }
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (progressChannel) {
      await progressChannel.send(`Finished sending DMs. Sent: ${stats.sent}, Failed: ${stats.failed}`);
    }
    
    return stats;
  } catch (error) {
    console.error('Error sending DMs to all members:', error);
    if (progressChannel) {
      await progressChannel.send(`Error sending DMs: ${error}`);
    }
    
    stats.failed = stats.total - stats.sent;
    stats.errors.push(`Global error: ${error}`);
    return stats;
  }
}
