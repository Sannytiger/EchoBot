import { 
  users, type User, type InsertUser,
  commands, type Command, type InsertCommand,
  commandLogs, type CommandLog, type InsertCommandLog
} from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Bot commands
  getCommands(): Promise<Command[]>;
  getCommand(id: number): Promise<Command | undefined>;
  getCommandByName(name: string): Promise<Command | undefined>;
  createCommand(command: InsertCommand): Promise<Command>;
  updateCommand(id: number, command: Partial<InsertCommand>): Promise<Command | undefined>;
  deleteCommand(id: number): Promise<boolean>;
  incrementCommandUsage(id: number): Promise<void>;

  // Command logs
  getCommandLogs(limit?: number, offset?: number): Promise<CommandLog[]>;
  createCommandLog(log: InsertCommandLog): Promise<CommandLog>;
  clearCommandLogs(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private botCommands: Map<number, Command>;
  private botCommandLogs: Map<number, CommandLog>;
  private currentUserId: number;
  private currentCommandId: number;
  private currentLogId: number;

  constructor() {
    this.users = new Map();
    this.botCommands = new Map();
    this.botCommandLogs = new Map();
    this.currentUserId = 1;
    this.currentCommandId = 1;
    this.currentLogId = 1;

    // Initialize with the repeat command
    this.createCommand({
      name: "repeat",
      description: "Repeats whatever message the user sends",
      prefix: "/",
      cooldown: 3,
      permissionLevel: "None",
      isActive: true
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Bot commands
  async getCommands(): Promise<Command[]> {
    return Array.from(this.botCommands.values());
  }

  async getCommand(id: number): Promise<Command | undefined> {
    return this.botCommands.get(id);
  }

  async getCommandByName(name: string): Promise<Command | undefined> {
    return Array.from(this.botCommands.values()).find(
      (cmd) => cmd.name === name
    );
  }

  async createCommand(insertCommand: InsertCommand): Promise<Command> {
    const id = this.currentCommandId++;
    const command: Command = { 
      ...insertCommand, 
      id,
      usageCount: 0,
      // Ensure required properties have default values
      cooldown: insertCommand.cooldown ?? 3,
      permissionLevel: insertCommand.permissionLevel ?? 'None',
      isActive: insertCommand.isActive ?? true
    };
    this.botCommands.set(id, command);
    return command;
  }

  async updateCommand(id: number, partialCommand: Partial<InsertCommand>): Promise<Command | undefined> {
    const existing = this.botCommands.get(id);
    if (!existing) return undefined;

    const updated: Command = {
      ...existing,
      ...partialCommand
    };
    this.botCommands.set(id, updated);
    return updated;
  }

  async deleteCommand(id: number): Promise<boolean> {
    return this.botCommands.delete(id);
  }

  async incrementCommandUsage(id: number): Promise<void> {
    const command = this.botCommands.get(id);
    if (command) {
      command.usageCount += 1;
      this.botCommands.set(id, command);
    }
  }

  // Command logs
  async getCommandLogs(limit = 100, offset = 0): Promise<CommandLog[]> {
    const logs = Array.from(this.botCommandLogs.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return logs.slice(offset, offset + limit);
  }

  async createCommandLog(insertLog: InsertCommandLog): Promise<CommandLog> {
    const id = this.currentLogId++;
    const log: CommandLog = {
      ...insertLog,
      id,
      timestamp: new Date(),
      // Ensure serverId and serverName are never undefined
      serverId: insertLog.serverId ?? null,
      serverName: insertLog.serverName ?? null
    };
    this.botCommandLogs.set(id, log);
    return log;
  }

  async clearCommandLogs(): Promise<void> {
    this.botCommandLogs.clear();
  }
}

export const storage = new MemStorage();
