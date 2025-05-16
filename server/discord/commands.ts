import { Message, TextChannel } from 'discord.js';
import { Command } from '@shared/schema';

export type CommandResult = {
  response: string;
  status: string;
};

export async function handleCommand(
  command: Command, 
  args: string, 
  message: Message | null
): Promise<CommandResult> {
  // Each command implementation should be added to this switch
  switch (command.name) {
    case 'repeat':
      return handleRepeatCommand(args, message);
    default:
      return {
        response: `Unknown command: ${command.name}`,
        status: 'Unknown Command'
      };
  }
}

export async function handleRepeatCommand(
  args: string, 
  message: Message | null
): Promise<CommandResult> {
  // Check if args is empty
  if (!args || args.trim() === '') {
    const response = 'You need to provide a message to repeat!';
    
    // If in a real Discord channel, reply to the user
    if (message) {
      try {
        await message.reply(response);
      } catch (error) {
        console.error('Error replying to message:', error);
      }
    }
    
    return {
      response,
      status: 'Missing Args'
    };
  }
  
  // Otherwise, repeat the message
  // If in a real Discord channel, send the message
  if (message) {
    try {
      // Use message.reply as a more compatible method across channel types
      await message.reply(args);
    } catch (error) {
      console.error('Error sending message:', error);
      return {
        response: 'Error sending message to channel',
        status: 'Error'
      };
    }
  }
  
  return {
    response: args,
    status: 'Success'
  };
}

