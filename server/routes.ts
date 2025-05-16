import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getDiscordBot } from "./discord/bot";
import { insertCommandSchema, insertCommandLogSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.get("/api/status", async (req: Request, res: Response) => {
    const discordBot = getDiscordBot();
    const status = discordBot.getStatus();
    
    res.json({
      status: "ok",
      botConnected: status.connected,
      botStats: status
    });
  });

  // Command routes
  app.get("/api/commands", async (req: Request, res: Response) => {
    try {
      const commands = await storage.getCommands();
      res.json(commands);
    } catch (error) {
      console.error("Error getting commands:", error);
      res.status(500).json({ message: "Error fetching commands" });
    }
  });

  app.get("/api/commands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid command ID" });
      }
      
      const command = await storage.getCommand(id);
      if (!command) {
        return res.status(404).json({ message: "Command not found" });
      }
      
      res.json(command);
    } catch (error) {
      console.error("Error getting command:", error);
      res.status(500).json({ message: "Error fetching command" });
    }
  });

  app.post("/api/commands", async (req: Request, res: Response) => {
    try {
      const validatedData = insertCommandSchema.parse(req.body);
      const command = await storage.createCommand(validatedData);
      res.status(201).json(command);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid command data", errors: error.errors });
      }
      console.error("Error creating command:", error);
      res.status(500).json({ message: "Error creating command" });
    }
  });

  app.put("/api/commands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid command ID" });
      }
      
      // Partial validation - allow subset of fields
      const validatedData = insertCommandSchema.partial().parse(req.body);
      
      const command = await storage.updateCommand(id, validatedData);
      if (!command) {
        return res.status(404).json({ message: "Command not found" });
      }
      
      res.json(command);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid command data", errors: error.errors });
      }
      console.error("Error updating command:", error);
      res.status(500).json({ message: "Error updating command" });
    }
  });

  app.delete("/api/commands/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid command ID" });
      }
      
      const success = await storage.deleteCommand(id);
      if (!success) {
        return res.status(404).json({ message: "Command not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting command:", error);
      res.status(500).json({ message: "Error deleting command" });
    }
  });

  // Command logs routes
  app.get("/api/logs", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const logs = await storage.getCommandLogs(limit, offset);
      res.json(logs);
    } catch (error) {
      console.error("Error getting command logs:", error);
      res.status(500).json({ message: "Error fetching command logs" });
    }
  });

  app.post("/api/logs/clear", async (req: Request, res: Response) => {
    try {
      await storage.clearCommandLogs();
      res.status(204).end();
    } catch (error) {
      console.error("Error clearing command logs:", error);
      res.status(500).json({ message: "Error clearing command logs" });
    }
  });

  // Test command route
  app.post("/api/test-command", async (req: Request, res: Response) => {
    try {
      const command = req.body.command;
      if (!command || typeof command !== 'string') {
        return res.status(400).json({ message: "Invalid command" });
      }
      
      const discordBot = getDiscordBot();
      const result = await discordBot.testCommand(command);
      
      res.json(result);
    } catch (error) {
      console.error("Error testing command:", error);
      res.status(500).json({ message: "Error testing command" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
