# ConsultBot - Telegram Consultation Booking Bot

## Overview
A Telegram bot for managing consultation sessions between clients and consultants, with admin approval workflow.

## Architecture
- **Backend**: Express.js server with Telegraf Telegram bot
- **Frontend**: React dashboard for monitoring bot status
- **Database**: PostgreSQL with Drizzle ORM

## Key Files
- `shared/schema.ts` - Database schema (users, consultationRequests, consultationSessions, botSettings)
- `server/bot.ts` - Telegram bot logic (registration, consultation flow, admin panel)
- `server/storage.ts` - Database CRUD operations
- `server/db.ts` - Database connection
- `server/routes.ts` - API endpoints for dashboard
- `client/src/pages/dashboard.tsx` - Web monitoring dashboard

## Bot Roles
- **Guest** - Unregistered user
- **Client** - Can create consultation requests (after admin approval)
- **Consultant** - Can take requests and propose times (after admin approval)
- **Admin** - First user to register + send "Я строгий админ и сижу на Эвересте"

## Bot Commands
- `/start` - Registration or welcome
- `/menu` - Main menu for current role
- `/admin` - Admin panel (admin only)

## Environment Variables
- `TELEGRAM_BOT_TOKEN` - Telegram bot API token
- `DATABASE_URL` - PostgreSQL connection string

## Consultation Flow
1. Client creates request (topic, preferred time, details)
2. Consultants see open requests and can take them
3. Consultant proposes time -> Client confirms or counter-proposes
4. Session is scheduled
5. After session: both sides confirm it happened
6. Admin can manage all aspects
