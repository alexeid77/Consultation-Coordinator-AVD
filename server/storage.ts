import {
  type User, type InsertUser,
  type ConsultationRequest, type InsertConsultationRequest,
  type ConsultationSession, type InsertConsultationSession,
  type BotSettings,
  users, consultationRequests, consultationSessions, botSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getUsersByRoleAndStatus(role: string, status: string): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<void>;
  getAdminUser(): Promise<User | undefined>;

  createRequest(req: InsertConsultationRequest): Promise<ConsultationRequest>;
  getRequest(id: number): Promise<ConsultationRequest | undefined>;
  updateRequest(id: number, data: Partial<ConsultationRequest>): Promise<ConsultationRequest | undefined>;
  getRequestsByClient(clientId: number): Promise<ConsultationRequest[]>;
  getRequestsByStatus(status: string): Promise<ConsultationRequest[]>;
  getRequestsByConsultant(consultantId: number): Promise<ConsultationRequest[]>;
  getAllRequests(): Promise<ConsultationRequest[]>;

  createSession(session: InsertConsultationSession): Promise<ConsultationSession>;
  getSession(id: number): Promise<ConsultationSession | undefined>;
  updateSession(id: number, data: Partial<ConsultationSession>): Promise<ConsultationSession | undefined>;
  getSessionsByClient(clientId: number): Promise<ConsultationSession[]>;
  getSessionsByConsultant(consultantId: number): Promise<ConsultationSession[]>;
  getAllSessions(): Promise<ConsultationSession[]>;

  getSettings(): Promise<BotSettings>;
  updateSettings(data: Partial<BotSettings>): Promise<BotSettings>;

  resetAll(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async getUsersByRoleAndStatus(role: string, status: string): Promise<User[]> {
    return db.select().from(users).where(and(eq(users.role, role), eq(users.status, status)));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.role, role));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getAdminUser(): Promise<User | undefined> {
    const [admin] = await db.select().from(users).where(eq(users.role, "admin"));
    return admin;
  }

  async createRequest(req: InsertConsultationRequest): Promise<ConsultationRequest> {
    const [created] = await db.insert(consultationRequests).values(req).returning();
    return created;
  }

  async getRequest(id: number): Promise<ConsultationRequest | undefined> {
    const [req] = await db.select().from(consultationRequests).where(eq(consultationRequests.id, id));
    return req;
  }

  async updateRequest(id: number, data: Partial<ConsultationRequest>): Promise<ConsultationRequest | undefined> {
    const [updated] = await db.update(consultationRequests).set(data).where(eq(consultationRequests.id, id)).returning();
    return updated;
  }

  async getRequestsByClient(clientId: number): Promise<ConsultationRequest[]> {
    return db.select().from(consultationRequests).where(eq(consultationRequests.clientId, clientId));
  }

  async getRequestsByStatus(status: string): Promise<ConsultationRequest[]> {
    return db.select().from(consultationRequests).where(eq(consultationRequests.status, status));
  }

  async getRequestsByConsultant(consultantId: number): Promise<ConsultationRequest[]> {
    return db.select().from(consultationRequests).where(eq(consultationRequests.consultantId, consultantId));
  }

  async getAllRequests(): Promise<ConsultationRequest[]> {
    return db.select().from(consultationRequests);
  }

  async createSession(session: InsertConsultationSession): Promise<ConsultationSession> {
    const [created] = await db.insert(consultationSessions).values(session).returning();
    return created;
  }

  async getSession(id: number): Promise<ConsultationSession | undefined> {
    const [session] = await db.select().from(consultationSessions).where(eq(consultationSessions.id, id));
    return session;
  }

  async updateSession(id: number, data: Partial<ConsultationSession>): Promise<ConsultationSession | undefined> {
    const [updated] = await db.update(consultationSessions).set(data).where(eq(consultationSessions.id, id)).returning();
    return updated;
  }

  async getSessionsByClient(clientId: number): Promise<ConsultationSession[]> {
    return db.select().from(consultationSessions).where(eq(consultationSessions.clientId, clientId));
  }

  async getSessionsByConsultant(consultantId: number): Promise<ConsultationSession[]> {
    return db.select().from(consultationSessions).where(eq(consultationSessions.consultantId, consultantId));
  }

  async getAllSessions(): Promise<ConsultationSession[]> {
    return db.select().from(consultationSessions);
  }

  async getSettings(): Promise<BotSettings> {
    const [settings] = await db.select().from(botSettings);
    if (!settings) {
      const [created] = await db.insert(botSettings).values({}).returning();
      return created;
    }
    return settings;
  }

  async updateSettings(data: Partial<BotSettings>): Promise<BotSettings> {
    const settings = await this.getSettings();
    const [updated] = await db.update(botSettings).set(data).where(eq(botSettings.id, settings.id)).returning();
    return updated;
  }

  async resetAll(): Promise<void> {
    await db.delete(consultationSessions);
    await db.delete(consultationRequests);
    await db.delete(users);
    await db.delete(botSettings);
  }
}

export const storage = new DatabaseStorage();
