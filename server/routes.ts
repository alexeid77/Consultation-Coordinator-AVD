import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startBot, stopBot, getBot } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  startBot().catch(err => console.error("Bot startup error:", err));

  app.get("/api/stats", async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allRequests = await storage.getAllRequests();
      const allSessions = await storage.getAllSessions();
      const settings = await storage.getSettings();

      const clients = allUsers.filter(u => u.role === "client");
      const consultants = allUsers.filter(u => u.role === "consultant");
      const admin = allUsers.find(u => u.role === "admin");

      res.json({
        botRunning: !!getBot(),
        settings: {
          registrationEnabled: settings.registrationEnabled,
          consultationsEnabled: settings.consultationsEnabled,
        },
        users: {
          totalClients: clients.length,
          activeClients: clients.filter(u => u.status === "active").length,
          pendingClients: clients.filter(u => u.status === "pending").length,
          totalConsultants: consultants.length,
          activeConsultants: consultants.filter(u => u.status === "active").length,
          pendingConsultants: consultants.filter(u => u.status === "pending").length,
          hasAdmin: !!admin,
        },
        requests: {
          total: allRequests.length,
          open: allRequests.filter(r => r.status === "open").length,
          taken: allRequests.filter(r => r.status === "taken").length,
          timeProposed: allRequests.filter(r => r.status === "time_proposed").length,
          scheduled: allRequests.filter(r => r.status === "scheduled").length,
          cancelled: allRequests.filter(r => r.status === "cancelled").length,
        },
        sessions: {
          total: allSessions.length,
          scheduled: allSessions.filter(s => s.status === "scheduled").length,
          completed: allSessions.filter(s => s.status === "completed").length,
          disagreement: allSessions.filter(s => s.status === "disagreement").length,
          notHappened: allSessions.filter(s => s.status === "not_happened").length,
          cancelled: allSessions.filter(s => s.status === "cancelled").length,
        },
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  app.get("/api/users", async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({
        id: u.id,
        fullName: u.fullName,
        username: u.username,
        role: u.role,
        status: u.status,
        competencies: u.competencies,
        createdAt: u.createdAt,
      })));
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/requests", async (_req, res) => {
    try {
      const requests = await storage.getAllRequests();
      res.json(requests);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch requests" });
    }
  });

  app.get("/api/sessions", async (_req, res) => {
    try {
      const sessions = await storage.getAllSessions();
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch sessions" });
    }
  });

  return httpServer;
}
