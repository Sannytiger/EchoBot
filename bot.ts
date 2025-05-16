import { 
  Client, 
  Events, 
  GatewayIntentBits, 
  REST, 
  Routes,
  SlashCommandBuilder,
  ChannelType,
  ChatInputCommandInteraction,
  ApplicationCommandOptionType,
  TextChannel,
  Message
} from 'discord.js';
import { handleCommand } from './commands';
import { getRandomJoke, getFallbackJoke } from './jokes';
import { calculate, formatCalculationResult } from './calculator';
import { findUserByUsername, sendDirectMessage, sendDirectMessageToAllMembers } from './dm';
import { findVoiceChannel, joinVoice, leaveVoice, isInVoice } from './voice';
import { storage } from '../storage';

class DiscordBot {
  private client: Client;
  private token: string;
  private isReady: boolean = false;
  private commandCooldowns: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.client = new Client({
      // Using all necessary intents including voice support
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates  // Required for voice functionality
      ]
    });
    
    this.token = process.env.DISCORD_TOKEN || '';
    this.setupEventHandlers();
  }
  
  private async registerSlashCommands() {
    if (!this.client.user) return;
    
    try {
      const commands = await storage.getCommands();
      const rest = new REST({ version: '10' }).setToken(this.token);
      
      // Format commands for Discord API
      const slashCommands = commands.map(cmd => {
        const commandBuilder = new SlashCommandBuilder()
          .setName(cmd.name)
          .setDescription(cmd.description);
          
        // Add options based on command type
        if (cmd.name === 'repeat') {
          commandBuilder.addStringOption(option => 
            option.setName('message')
              .setDescription('The message to repeat')
              .setRequired(true));
        }
        
        return commandBuilder.toJSON();
      });
      
      // Add joke command
      const jokeCommand = new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Get a random joke')
        .toJSON();
        
      // Add calculator command
      const calculateCommand = new SlashCommandBuilder()
        .setName('calculate')
        .setDescription('Calculate a mathematical expression')
        .addStringOption(option => 
          option.setName('expression')
                .setDescription('The mathematical expression to calculate (e.g., 2 + 2 or 10 * 5)')
                .setRequired(true))
        .toJSON();
        
      // Add DM command
      const dmCommand = new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message to a user or all users')
        .addStringOption(option => 
          option.setName('message')
                .setDescription('The message to send')
                .setRequired(true))
        .addStringOption(option => 
          option.setName('username')
                .setDescription('The username to send a message to (leave empty to message all users)')
                .setRequired(false))
        .toJSON();
        
      // Add join voice command
      const joinVoiceCommand = new SlashCommandBuilder()
        .setName('joinvoice')
        .setDescription('Join a voice channel (defaults to "general")')
        .toJSON();
        
      // Add leave voice command
      const leaveVoiceCommand = new SlashCommandBuilder()
        .setName('leavevoice')
        .setDescription('Leave the current voice channel')
        .toJSON();
      
      slashCommands.push(jokeCommand);
      slashCommands.push(calculateCommand);
      slashCommands.push(dmCommand);
      slashCommands.push(joinVoiceCommand);
      slashCommands.push(leaveVoiceCommand);
      
      console.log('Registering slash commands...');
      
      if (this.client.user) {
        // Register commands globally
        await rest.put(
          Routes.applicationCommands(this.client.user.id),
          { body: slashCommands }
        );
        
        console.log('Slash commands registered successfully!');
      }
    } catch (error) {
      console.error('Error registering slash commands:', error);
    }
  }

  private setupEventHandlers() {
    this.client.on(Events.ClientReady, async () => {
      console.log(`Logged in as ${this.client.user?.tag}!`);
      this.isReady = true;
      
      // Register slash commands when the bot is ready
      await this.registerSlashCommands();
    });

    this.client.on(Events.MessageCreate, async (message) => {
      // Log that we received a message
      console.log(`Received a message from ${message.author.username}: "${message.content}"`);
      
      // Ignore bot messages
      if (message.author.bot) {
        console.log('Ignoring message from bot');
        return;
      }

      try {
        // Process text commands
        const content = message.content.trim();
        
        // Check for joke command
        if (content === '/joke') {
          console.log('Processing joke command from text message');
          
          // Show typing indicator
          await message.channel.sendTyping();
          
          try {
            // Fetch a random joke
            const joke = await getRandomJoke();
            
            // Reply with the joke
            await message.reply(joke);
            
            // Log the joke command
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: '/joke',
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'Success'
            });
          } catch (jokeError) {
            console.error('Error fetching joke:', jokeError);
            
            // Use fallback joke if API fails
            const fallbackJoke = await getFallbackJoke();
            await message.reply(fallbackJoke);
            
            // Log the error
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: '/joke',
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'API Error - Using Fallback'
            });
          }
          return;
        }
        
        // Check for repeat command
        if (content.startsWith('/repeat ')) {
          console.log('Processing repeat command from text message');
          
          const textToRepeat = content.substring('/repeat '.length).trim();
          
          if (textToRepeat) {
            await message.reply(textToRepeat);
            
            // Log the command
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'Success'
            });
          } else {
            await message.reply('Please provide a message to repeat after the /repeat command.');
          }
          return;
        }
        
        // Check for calculate command
        if (content.startsWith('/calculate ')) {
          console.log('Processing calculate command from text message');
          
          const expression = content.substring('/calculate '.length).trim();
          
          if (expression) {
            console.log(`Calculating expression: "${expression}"`);
            
            // Calculate the result
            const { result, error } = calculate(expression);
            
            // Format the response
            const response = formatCalculationResult(expression, result, error);
            
            // Reply with the result
            await message.reply(response);
            
            // Log the command
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: error ? 'Error' : 'Success'
            });
          } else {
            await message.reply('Please provide a mathematical expression to calculate after the /calculate command (e.g., `/calculate 2 + 2`).');
          }
          return;
        }
        
        // Check for join voice command
        if (content === '/joinvoice') {
          console.log('Processing joinvoice command from text message');
          
          if (!message.guild) {
            await message.reply('This command can only be used in a server.');
            return;
          }
          
          const processingMsg = await message.reply('Looking for a voice channel to join...');
          
          try {
            // Find a voice channel (preferably "general")
            const voiceChannel = await findVoiceChannel(message.guild);
            
            if (!voiceChannel) {
              await processingMsg.edit('No voice channels found in this server.');
              return;
            }
            
            // Join the voice channel
            const result = await joinVoice(
              this.client,
              message.guild.id,
              voiceChannel.id
            );
            
            if (result.success) {
              await processingMsg.edit(`🎙️ Successfully joined the **${result.channelName}** voice channel.`);
            } else {
              await processingMsg.edit(`❌ ${result.message}`);
            }
            
            // Log the command
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild.id,
              serverName: message.guild.name,
              status: result.success ? 'Success' : 'Error'
            });
          } catch (error) {
            console.error('Error joining voice channel:', error);
            await processingMsg.edit(`An error occurred: ${error}`);
            
            // Log the error
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'Error'
            });
          }
          
          return;
        }
        
        // Check for leave voice command
        if (content === '/leavevoice') {
          console.log('Processing leavevoice command from text message');
          
          if (!message.guild) {
            await message.reply('This command can only be used in a server.');
            return;
          }
          
          try {
            // Leave the voice channel
            const result = leaveVoice(message.guild.id);
            
            if (result.success) {
              await message.reply(`🎙️ ${result.message}`);
            } else {
              await message.reply(`❌ ${result.message}`);
            }
            
            // Log the command
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild.id,
              serverName: message.guild.name,
              status: result.success ? 'Success' : 'Error'
            });
          } catch (error) {
            console.error('Error leaving voice channel:', error);
            await message.reply(`An error occurred: ${error}`);
            
            // Log the error
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'Error'
            });
          }
          
          return;
        }
        
        // Check for DM command
        if (content.startsWith('/dm ')) {
          console.log('Processing DM command from text message');
          
          // Check if user has permission
          if (!message.member?.permissions.has('ManageMessages')) {
            await message.reply('You need the "Manage Messages" permission to use this command.');
            return;
          }
          
          // Parse the command
          const args = content.substring('/dm '.length).trim();
          let username = null;
          let messageContent = args;
          
          // Look for a username
          const firstSpace = args.indexOf(' ');
          if (firstSpace !== -1) {
            username = args.substring(0, firstSpace).trim();
            messageContent = args.substring(firstSpace + 1).trim();
          }
          
          if (!messageContent) {
            await message.reply('Please provide a message to send.');
            return;
          }
          
          // Let the user know we're processing
          const processingMsg = await message.reply('Processing DM command...');
          
          try {
            if (username && username !== 'all') {
              // Send to specific user
              console.log(`Attempting to DM user: ${username}`);
              
              if (!message.guild) {
                await processingMsg.edit('This command must be used in a server.');
                return;
              }
              
              const member = await findUserByUsername(message.guild, username);
              
              if (!member) {
                await processingMsg.edit(`Could not find user "${username}" in this server.`);
                return;
              }
              
              const result = await sendDirectMessage(
                this.client, 
                member.user.id, 
                messageContent
              );
              
              if (result.success) {
                await processingMsg.edit(`✅ Successfully sent a direct message to ${member.user.tag}.`);
              } else {
                await processingMsg.edit(`❌ Failed to send a direct message to ${member.user.tag}: ${result.error}`);
              }
            } else {
              // Send to all users
              if (!message.guild) {
                await processingMsg.edit('This command must be used in a server.');
                return;
              }
              
              // Ask for confirmation
              await processingMsg.edit(
                `⚠️ You are about to send a direct message to ALL members of this server.\n` +
                `Message: "${messageContent}"\n\n` +
                `This cannot be undone. Type \`/confirm-dm\` in the next 30 seconds to confirm.`
              );
              
              // Set up a collector to wait for confirmation
              const channel = message.channel;
              
              const filter = (m: any) => 
                m.author.id === message.author.id && 
                m.content.toLowerCase() === '/confirm-dm';
              
              // Set up an event-based confirmation mechanism
              let confirmed = false;
              const timeoutId = setTimeout(() => {
                if (!confirmed) {
                  channel.send('Confirmation timed out. No messages were sent.');
                }
              }, 30000);
              
              // Function to process the bulk DM operation
              const processBulkDm = async () => {
                await channel.send('Confirmation received. Sending DMs to all members...');
                
                const stats = await sendDirectMessageToAllMembers(
                  message.guild!,
                  messageContent,
                  channel as TextChannel
                );
                
                await channel.send(
                  `📊 DM operation completed:\n` +
                  `- Total members: ${stats.total}\n` +
                  `- Successfully sent: ${stats.sent}\n` +
                  `- Failed: ${stats.failed}`
                );
              };
              
              // Create an event handler for the confirmation message
              const confirmHandler = async (confirmMsg: Message) => {
                if (filter(confirmMsg)) {
                  confirmed = true;
                  clearTimeout(timeoutId);
                  
                  // Remove the listener to avoid processing the command multiple times
                  this.client.off(Events.MessageCreate, confirmHandler);
                  
                  await processBulkDm();
                }
              };
              
              // Listen for the confirmation message
              this.client.on(Events.MessageCreate, confirmHandler);
              
              // Clean up the listener after the timeout period
              setTimeout(() => {
                this.client.off(Events.MessageCreate, confirmHandler);
              }, 31000);
            }
            
            // Log the command
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'Success'
            });
          } catch (error) {
            console.error('Error processing DM command:', error);
            await processingMsg.edit(`An error occurred: ${error}`);
            
            // Log the error
            await storage.createCommandLog({
              userId: message.author.id,
              username: message.author.username,
              command: content,
              serverId: message.guild?.id,
              serverName: message.guild?.name,
              status: 'Error'
            });
          }
          
          return;
        }
        
        // For other messages, don't auto-reply
        console.log('No command found in message. Not replying.');
      } catch (error) {
        console.error('Error processing message command:', error);
      }
    });

    this.client.on(Events.Error, (error) => {
      console.error('Discord client error:', error);
    });
    
    // Handle slash commands
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      
      console.log(`Received interaction: ${interaction.commandName}`);
      
      try {
        // Special handling for joke command
        if (interaction.commandName === 'joke') {
          console.log('Processing joke command');
          
          // Show "thinking" state while fetching the joke
          await interaction.deferReply();
          
          try {
            // Fetch a random joke
            const joke = await getRandomJoke();
            
            // Reply with the joke
            await interaction.editReply({
              content: joke
            });
            
            // Log the joke command
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/joke`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: 'Success'
            });
          } catch (jokeError) {
            console.error('Error fetching joke:', jokeError);
            // Use fallback joke if API fails
            const fallbackJoke = await getFallbackJoke();
            await interaction.editReply({
              content: fallbackJoke
            });
            
            // Log the error
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/joke`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: 'API Error - Using Fallback'
            });
          }
          
          return;
        }
        
        // Special handling for calculate command
        if (interaction.commandName === 'calculate') {
          console.log('Processing calculate command');
          
          // Get the expression from options
          const expression = interaction.options.getString('expression');
          
          if (!expression) {
            await interaction.reply({ 
              content: 'Please provide a mathematical expression to calculate.',
              ephemeral: true 
            });
            return;
          }
          
          console.log(`Calculating expression: "${expression}"`);
          
          // Calculate the result
          const { result, error } = calculate(expression);
          
          // Format the response
          const response = formatCalculationResult(expression, result, error);
          
          // Reply with the result
          await interaction.reply({
            content: response
          });
          
          // Log the command
          await storage.createCommandLog({
            userId: interaction.user.id,
            username: interaction.user.username,
            command: `/calculate ${expression}`,
            serverId: interaction.guildId,
            serverName: interaction.guild?.name,
            status: error ? 'Error' : 'Success'
          });
          
          return;
        }
        
        // Special handling for join voice command
        if (interaction.commandName === 'joinvoice') {
          console.log('Processing joinvoice command');
          
          // Check if we're in a guild
          if (!interaction.guild) {
            await interaction.reply({
              content: 'This command can only be used in a server.',
              ephemeral: true
            });
            return;
          }
          
          await interaction.deferReply();
          
          try {
            // Find a voice channel (preferably "general")
            const voiceChannel = await findVoiceChannel(interaction.guild);
            
            if (!voiceChannel) {
              await interaction.editReply('No voice channels found in this server.');
              return;
            }
            
            // Join the voice channel
            const result = await joinVoice(
              this.client,
              interaction.guild.id,
              voiceChannel.id
            );
            
            if (result.success) {
              await interaction.editReply(`🎙️ Successfully joined the **${result.channelName}** voice channel.`);
            } else {
              await interaction.editReply(`❌ ${result.message}`);
            }
            
            // Log the command
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/joinvoice`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: result.success ? 'Success' : 'Error'
            });
          } catch (error) {
            console.error('Error joining voice channel:', error);
            await interaction.editReply(`An error occurred: ${error}`);
            
            // Log the error
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/joinvoice`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: 'Error'
            });
          }
          
          return;
        }
        
        // Special handling for leave voice command
        if (interaction.commandName === 'leavevoice') {
          console.log('Processing leavevoice command');
          
          // Check if we're in a guild
          if (!interaction.guild) {
            await interaction.reply({
              content: 'This command can only be used in a server.',
              ephemeral: true
            });
            return;
          }
          
          try {
            // Leave the voice channel
            const result = leaveVoice(interaction.guild.id);
            
            if (result.success) {
              await interaction.reply(`🎙️ ${result.message}`);
            } else {
              await interaction.reply(`❌ ${result.message}`);
            }
            
            // Log the command
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/leavevoice`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: result.success ? 'Success' : 'Error'
            });
          } catch (error) {
            console.error('Error leaving voice channel:', error);
            await interaction.reply(`An error occurred: ${error}`);
            
            // Log the error
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/leavevoice`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: 'Error'
            });
          }
          
          return;
        }
        
        // Special handling for DM command
        if (interaction.commandName === 'dm') {
          console.log('Processing DM command');
          
          // Check for required permissions
          if (!interaction.memberPermissions?.has('ManageMessages')) {
            await interaction.reply({
              content: 'You need the "Manage Messages" permission to use this command.',
              ephemeral: true
            });
            return;
          }
          
          // Get the message and username from options
          const messageContent = interaction.options.getString('message');
          const username = interaction.options.getString('username');
          
          if (!messageContent) {
            await interaction.reply({
              content: 'Please provide a message to send.',
              ephemeral: true
            });
            return;
          }
          
          // Let the user know we're processing
          await interaction.deferReply();
          
          try {
            if (username) {
              // Send to specific user
              console.log(`Attempting to DM user: ${username}`);
              
              if (!interaction.guild) {
                await interaction.editReply('This command must be used in a server.');
                return;
              }
              
              const member = await findUserByUsername(interaction.guild, username);
              
              if (!member) {
                await interaction.editReply(`Could not find user "${username}" in this server.`);
                return;
              }
              
              const result = await sendDirectMessage(
                this.client, 
                member.user.id, 
                messageContent
              );
              
              if (result.success) {
                await interaction.editReply(`✅ Successfully sent a direct message to ${member.user.tag}.`);
              } else {
                await interaction.editReply(`❌ Failed to send a direct message to ${member.user.tag}: ${result.error}`);
              }
            } else {
              // Send to all users
              if (!interaction.guild) {
                await interaction.editReply('This command must be used in a server.');
                return;
              }
              
              // Ask for confirmation
              await interaction.editReply(
                `⚠️ You are about to send a direct message to ALL members of this server.\n` +
                `Message: "${messageContent}"\n\n` +
                `This cannot be undone. Type \`/confirm-dm\` in the next 30 seconds to confirm.`
              );
              
              // Set up a collector to wait for confirmation
              const channel = interaction.channel;
              if (!channel) return;
              
              const filter = (m: any) => 
                m.author.id === interaction.user.id && 
                m.content.toLowerCase() === '/confirm-dm';
              
              // Set up an event-based confirmation mechanism
              let confirmed = false;
              const timeoutId = setTimeout(() => {
                if (!confirmed) {
                  interaction.followUp('Confirmation timed out. No messages were sent.');
                }
              }, 30000);
              
              // Function to process the bulk DM operation
              const processBulkDm = async () => {
                await interaction.followUp('Confirmation received. Sending DMs to all members...');
                
                const stats = await sendDirectMessageToAllMembers(
                  interaction.guild!,
                  messageContent,
                  channel as TextChannel
                );
                
                await interaction.followUp(
                  `📊 DM operation completed:\n` +
                  `- Total members: ${stats.total}\n` +
                  `- Successfully sent: ${stats.sent}\n` +
                  `- Failed: ${stats.failed}`
                );
              };
              
              // Create an event handler for the confirmation message
              const confirmHandler = async (confirmMsg: Message) => {
                if (filter(confirmMsg)) {
                  confirmed = true;
                  clearTimeout(timeoutId);
                  
                  // Remove the listener to avoid processing the command multiple times
                  this.client.off(Events.MessageCreate, confirmHandler);
                  
                  await processBulkDm();
                }
              };
              
              // Listen for the confirmation message
              this.client.on(Events.MessageCreate, confirmHandler);
              
              // Clean up the listener after the timeout period
              setTimeout(() => {
                this.client.off(Events.MessageCreate, confirmHandler);
              }, 31000);
            }
            
            // Log the command
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/dm ${username || 'all'} ${messageContent.substring(0, 20)}...`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: 'Success'
            });
          } catch (error) {
            console.error('Error processing DM command:', error);
            await interaction.editReply(`An error occurred: ${error}`);
            
            // Log the error
            await storage.createCommandLog({
              userId: interaction.user.id,
              username: interaction.user.username,
              command: `/dm ${username || 'all'}`,
              serverId: interaction.guildId,
              serverName: interaction.guild?.name,
              status: 'Error'
            });
          }
          
          return;
        }
        
        // Handle other commands from the database
        const command = await storage.getCommandByName(interaction.commandName);
        
        if (!command) {
          console.log(`Command not found: ${interaction.commandName}`);
          await interaction.reply({ content: 'Unknown command!', ephemeral: true });
          return;
        }
        
        // Check cooldown
        if (this.isOnCooldown(interaction.user.id, command.name, command.cooldown)) {
          const remainingCooldown = this.getRemainingCooldown(interaction.user.id, command.name);
          console.log(`Command on cooldown. ${remainingCooldown}s remaining`);
          
          await interaction.reply({ 
            content: `Please wait ${remainingCooldown} more second(s) before using this command again.`, 
            ephemeral: true 
          });
          
          // Log the cooldown event
          await storage.createCommandLog({
            userId: interaction.user.id,
            username: interaction.user.username,
            command: `/${command.name}`,
            serverId: interaction.guildId,
            serverName: interaction.guild?.name,
            status: 'Cooldown'
          });
          
          return;
        }
        
        // Get message option for repeat command
        const message = interaction.options.getString('message');
        
        if (command.name === 'repeat' && !message) {
          await interaction.reply({ content: 'You need to provide a message!', ephemeral: true });
          
          // Log missing args
          await storage.createCommandLog({
            userId: interaction.user.id,
            username: interaction.user.username,
            command: `/${command.name}`,
            serverId: interaction.guildId,
            serverName: interaction.guild?.name,
            status: 'Missing Args'
          });
          
          return;
        }
        
        // Process command - for the repeat command, simply echo back the message
        if (command.name === 'repeat' && message) {
          console.log(`Processing repeat command with message: "${message}"`);
          await interaction.reply({
            content: message,
            allowedMentions: { repliedUser: false }
          });
          
          // Set cooldown
          this.setCooldown(interaction.user.id, command.name, command.cooldown);
          
          // Increment command usage
          await storage.incrementCommandUsage(command.id);
          
          // Log the command
          await storage.createCommandLog({
            userId: interaction.user.id,
            username: interaction.user.username,
            command: `/${command.name} ${message}`,
            serverId: interaction.guildId,
            serverName: interaction.guild?.name,
            status: 'Success'
          });
        }
      } catch (error) {
        console.error('Error handling interaction:', error);
        
        try {
          // Try to respond if we haven't already
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ 
              content: 'There was an error processing your command!', 
              ephemeral: true 
            });
          } else {
            await interaction.reply({ 
              content: 'There was an error processing your command!', 
              ephemeral: true 
            });
          }
          
          // Log error
          await storage.createCommandLog({
            userId: interaction.user.id,
            username: interaction.user.username,
            command: `/${interaction.commandName}`,
            serverId: interaction.guildId,
            serverName: interaction.guild?.name,
            status: 'Error'
          });
        } catch (replyError) {
          console.error('Error sending error response:', replyError);
        }
      }
    });
  }

  private isOnCooldown(userId: string, commandName: string, cooldownTime: number): boolean {
    if (!this.commandCooldowns.has(commandName)) {
      this.commandCooldowns.set(commandName, new Map());
      return false;
    }
    
    const timestamps = this.commandCooldowns.get(commandName)!;
    if (!timestamps.has(userId)) return false;
    
    const expirationTime = timestamps.get(userId)! + (cooldownTime * 1000);
    return Date.now() < expirationTime;
  }
  
  private getRemainingCooldown(userId: string, commandName: string): number {
    const timestamps = this.commandCooldowns.get(commandName);
    if (!timestamps) return 0;
    
    const expirationTime = timestamps.get(userId)! + 3000; // Default 3s
    return Math.ceil((expirationTime - Date.now()) / 1000);
  }
  
  private setCooldown(userId: string, commandName: string, cooldownTime: number): void {
    if (!this.commandCooldowns.has(commandName)) {
      this.commandCooldowns.set(commandName, new Map());
    }
    
    const timestamps = this.commandCooldowns.get(commandName)!;
    timestamps.set(userId, Date.now());
  }

  public async start(): Promise<boolean> {
    if (!this.token) {
      console.error('No Discord token provided in environment variables');
      return false;
    }

    try {
      await this.client.login(this.token);
      return true;
    } catch (error) {
      console.error('Failed to log in to Discord:', error);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.isReady && this.client.isReady();
  }

  public getStatus(): { 
    connected: boolean;
    uptime: string | null;
    servers: number;
    memoryUsage: string;
  } {
    const connected = this.isConnected();
    let uptime = null;
    
    if (connected && this.client.uptime) {
      const uptimeMs = this.client.uptime;
      const seconds = Math.floor(uptimeMs / 1000) % 60;
      const minutes = Math.floor(uptimeMs / (1000 * 60)) % 60;
      const hours = Math.floor(uptimeMs / (1000 * 60 * 60)) % 24;
      const days = Math.floor(uptimeMs / (1000 * 60 * 60 * 24));
      
      uptime = `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
    }
    
    // Get memory usage in MB
    const memoryUsageMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    
    return {
      connected,
      uptime,
      servers: this.client.guilds.cache.size,
      memoryUsage: `${memoryUsageMB} MB`,
    };
  }

  public async testCommand(command: string): Promise<{
    command: string;
    response: string;
    status: string;
    timestamp: Date;
  }> {
    try {
      // Extract the command name from the input
      const parts = command.trim().split(' ');
      const commandName = parts[0].startsWith('/') ? parts[0].substring(1) : parts[0];
      
      // Special handling for joke command
      if (commandName === 'joke') {
        try {
          const joke = await getRandomJoke();
          return {
            command,
            response: joke,
            status: 'Success',
            timestamp: new Date()
          };
        } catch (jokeError) {
          console.error('Error testing joke command:', jokeError);
          const fallbackJoke = await getFallbackJoke();
          return {
            command,
            response: fallbackJoke,
            status: 'API Error - Using Fallback',
            timestamp: new Date()
          };
        }
      }
      
      // Special handling for calculate command
      if (commandName === 'calculate') {
        try {
          // Extract the expression from the command
          const expression = parts.slice(1).join(' ').trim();
          
          if (!expression) {
            return {
              command,
              response: 'Please provide a mathematical expression to calculate.',
              status: 'Missing Expression',
              timestamp: new Date()
            };
          }
          
          // Calculate the result
          const { result, error } = calculate(expression);
          
          // Format the response
          const response = formatCalculationResult(expression, result, error);
          
          return {
            command,
            response,
            status: error ? 'Error' : 'Success',
            timestamp: new Date()
          };
        } catch (calcError) {
          console.error('Error testing calculate command:', calcError);
          return {
            command,
            response: 'An error occurred while calculating the expression.',
            status: 'Error',
            timestamp: new Date()
          };
        }
      }
      
      // Special handling for DM command
      if (commandName === 'dm') {
        // For safety in testing, always return a simulation message
        const args = parts.slice(1).join(' ').trim();
        
        if (!args) {
          return {
            command,
            response: 'Please provide either a username and message, or just a message to send to everyone.',
            status: 'Missing Arguments',
            timestamp: new Date()
          };
        }
        
        // Check if we're targeting a specific user
        const firstSpace = args.indexOf(' ');
        if (firstSpace === -1) {
          return {
            command,
            response: 'Please provide a message to send.',
            status: 'Missing Message',
            timestamp: new Date()
          };
        }
        
        const username = args.substring(0, firstSpace).trim();
        const message = args.substring(firstSpace + 1).trim();
        
        if (username === 'all') {
          return {
            command,
            response: `This would send a DM to ALL server members with the message: "${message}"\n\nThis is a simulated response - actual messages will not be sent in test mode.`,
            status: 'Simulated',
            timestamp: new Date()
          };
        } else {
          return {
            command,
            response: `This would send a DM to user "${username}" with the message: "${message}"\n\nThis is a simulated response - actual messages will not be sent in test mode.`,
            status: 'Simulated',
            timestamp: new Date()
          };
        }
      }
      
      // Find the command in database
      const cmd = await storage.getCommandByName(commandName);
      
      if (!cmd) {
        return {
          command,
          response: `Unknown command: ${parts[0]}`,
          status: 'Unknown Command',
          timestamp: new Date()
        };
      }
      
      // Get the arguments
      const args = parts.slice(1).join(' ');
      
      // Simulate the command execution
      const result = await handleCommand(cmd, args, null);
      
      return {
        command,
        response: result.response,
        status: result.status,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error testing command:', error);
      return {
        command,
        response: 'An error occurred while testing the command',
        status: 'Error',
        timestamp: new Date()
      };
    }
  }
}

let botInstance: DiscordBot | null = null;

export function getDiscordBot(): DiscordBot {
  if (!botInstance) {
    botInstance = new DiscordBot();
  }
  return botInstance;
}
