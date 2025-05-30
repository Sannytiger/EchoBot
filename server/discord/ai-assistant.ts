/**
 * AI Assistant functionality for natural language command processing
 */

import { Client, Message, Guild, TextChannel } from 'discord.js';
import { handleCommand } from './commands';
import { getRandomJoke } from './jokes';
import { calculate, formatCalculationResult } from './calculator';
import { findUserByUsername, sendDirectMessage, sendDirectMessageToAllMembers } from './dm';
import { findVoiceChannel, joinVoice, leaveVoice } from './voice';
import { searchYouTubeTrack, playTrack, stopTrack } from './music';
import { storage } from '../storage';

interface CommandAction {
  type: 'calculate' | 'joke' | 'repeat' | 'joinvoice' | 'leavevoice' | 'play' | 'stop' | 'dm';
  parameters?: string[];
}

/**
 * Parse natural language text to extract commands and parameters
 */
export function parseNaturalLanguage(text: string): CommandAction[] {
  const commands: CommandAction[] = [];
  const lowerText = text.toLowerCase();

  // Clean up the text
  const cleanText = lowerText
    .replace(/[^\w\s+\-*/().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Math calculation patterns
  const mathPatterns = [
    /calculate\s+(.+?)(?=\s+and|$)/,
    /compute\s+(.+?)(?=\s+and|$)/,
    /solve\s+(.+?)(?=\s+and|$)/,
    /what\s+is\s+(.+?)(?=\s+and|$)/,
    /(\d+[\+\-\*\/\(\)\s]+\d+)/
  ];

  for (const pattern of mathPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      commands.push({
        type: 'calculate',
        parameters: [match[1].trim()]
      });
    }
  }

  // Joke patterns
  const jokePatterns = [
    /tell\s+.*joke/,
    /give\s+.*joke/,
    /make\s+me\s+laugh/,
    /something\s+funny/,
    /joke/
  ];

  if (jokePatterns.some(pattern => pattern.test(cleanText))) {
    commands.push({ type: 'joke' });
  }

  // Voice channel patterns
  const joinVoicePatterns = [
    /join\s+voice/,
    /join\s+the\s+voice\s+channel/,
    /connect\s+to\s+voice/,
    /come\s+to\s+voice/,
    /get\s+in\s+voice/
  ];

  if (joinVoicePatterns.some(pattern => pattern.test(cleanText))) {
    commands.push({ type: 'joinvoice' });
  }

  const leaveVoicePatterns = [
    /leave\s+voice/,
    /disconnect\s+from\s+voice/,
    /exit\s+voice/,
    /get\s+out\s+of\s+voice/
  ];

  if (leaveVoicePatterns.some(pattern => pattern.test(cleanText))) {
    commands.push({ type: 'leavevoice' });
  }

  // Music patterns
  const playPatterns = [
    /play\s+(.+?)(?=\s+and|$)/,
    /play\s+the\s+song\s+(.+?)(?=\s+and|$)/,
    /play\s+music\s+(.+?)(?=\s+and|$)/,
    /put\s+on\s+(.+?)(?=\s+and|$)/
  ];

  for (const pattern of playPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      commands.push({
        type: 'play',
        parameters: [match[1].trim()]
      });
    }
  }

  const stopPatterns = [
    /stop\s+music/,
    /stop\s+playing/,
    /stop\s+the\s+song/,
    /pause/,
    /stop/
  ];

  if (stopPatterns.some(pattern => pattern.test(cleanText))) {
    commands.push({ type: 'stop' });
  }

  // Repeat patterns
  const repeatPatterns = [
    /repeat\s+(.+?)(?=\s+and|$)/,
    /say\s+(.+?)(?=\s+and|$)/,
    /echo\s+(.+?)(?=\s+and|$)/
  ];

  for (const pattern of repeatPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      commands.push({
        type: 'repeat',
        parameters: [match[1].trim()]
      });
    }
  }

  // DM patterns
  const dmPatterns = [
    /send\s+.*message\s+(.+?)(?=\s+and|$)/,
    /dm\s+(.+?)(?=\s+and|$)/,
    /message\s+(.+?)(?=\s+and|$)/
  ];

  for (const pattern of dmPatterns) {
    const match = cleanText.match(pattern);
    if (match) {
      const parts = match[1].split(' ');
      commands.push({
        type: 'dm',
        parameters: parts
      });
    }
  }

  return commands;
}

/**
 * Execute a sequence of commands based on AI parsing
 */
export async function executeAICommands(
  client: Client,
  message: Message,
  commands: CommandAction[]
): Promise<void> {
  if (commands.length === 0) {
    await message.reply("I understand you want me to help, but I couldn't identify any specific commands in your message. Try asking me to:\n" +
      "• Calculate something (e.g., 'calculate 2+2')\n" +
      "• Tell a joke\n" +
      "• Join or leave voice channel\n" +
      "• Play music (e.g., 'play despacito')\n" +
      "• Repeat a message");
    return;
  }

  let responseMessage = `🤖 AI Assistant executing ${commands.length} command(s):\n\n`;
  
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    let result = '';

    try {
      switch (command.type) {
        case 'calculate':
          if (command.parameters && command.parameters[0]) {
            const calculation = calculate(command.parameters[0]);
            result = formatCalculationResult(command.parameters[0], calculation.result, calculation.error);
          }
          break;

        case 'joke':
          try {
            result = await getRandomJoke();
          } catch (error) {
            result = 'Sorry, I couldn\'t get a joke right now.';
          }
          break;

        case 'repeat':
          if (command.parameters && command.parameters[0]) {
            result = command.parameters[0];
          }
          break;

        case 'joinvoice':
          if (message.guild) {
            const voiceChannel = await findVoiceChannel(message.guild);
            if (voiceChannel) {
              const joinResult = await joinVoice(client, message.guild.id, voiceChannel.id);
              result = joinResult.success ? `✅ ${joinResult.message}` : `❌ ${joinResult.message}`;
            } else {
              result = '❌ No voice channels found in this server.';
            }
          }
          break;

        case 'leavevoice':
          if (message.guild) {
            const leaveResult = leaveVoice(message.guild.id);
            result = leaveResult.success ? `✅ ${leaveResult.message}` : `❌ ${leaveResult.message}`;
          }
          break;

        case 'play':
          if (command.parameters && command.parameters[0] && message.guild) {
            const track = await searchYouTubeTrack(command.parameters[0]);
            if (track) {
              const playResult = await playTrack(message.guild.id, track);
              result = playResult.success ? `✅ ${playResult.message}` : `❌ ${playResult.message}`;
            } else {
              result = `❌ Couldn't find "${command.parameters[0]}" on YouTube.`;
            }
          }
          break;

        case 'stop':
          if (message.guild) {
            const stopResult = stopTrack(message.guild.id);
            result = stopResult.success ? `✅ ${stopResult.message}` : `❌ ${stopResult.message}`;
          }
          break;

        case 'dm':
          result = 'DM commands require manual confirmation for security reasons.';
          break;

        default:
          result = 'Unknown command type.';
      }

      if (result) {
        responseMessage += `${i + 1}. **${command.type.toUpperCase()}**: ${result}\n`;
      }

      // Log the command
      if (message.guild) {
        await storage.createCommandLog({
          userId: message.author.id,
          username: message.author.username,
          command: `AI: ${command.type} ${command.parameters?.join(' ') || ''}`,
          serverId: message.guild.id,
          serverName: message.guild.name,
          status: result.includes('❌') ? 'Error' : 'Success'
        });
      }

      // Add delay between commands to avoid rate limits
      if (i < commands.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`Error executing AI command ${command.type}:`, error);
      responseMessage += `${i + 1}. **${command.type.toUpperCase()}**: ❌ Error occurred\n`;
    }
  }

  responseMessage += '\n✨ All commands completed!';
  await message.reply(responseMessage);
}

/**
 * Check if a message is mentioning the bot and contains an AI request
 */
export function isAIRequest(message: Message, botId: string): boolean {
  return message.mentions.users.has(botId) && 
         !message.content.startsWith('/') &&
         message.content.length > 10; // Avoid very short messages
}
