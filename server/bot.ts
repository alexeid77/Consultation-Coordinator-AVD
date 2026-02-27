import { Telegraf, Markup } from "telegraf";
import type { Context } from "telegraf";
import { storage } from "./storage";
import type { User } from "@shared/schema";

function log(message: string, source = "bot") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

const ADMIN_PHRASE = "Я строгий админ и сижу на Эвересте";

interface BotContext extends Context {
  dbUser?: User;
}

let bot: Telegraf<BotContext> | null = null;

export function getBot() {
  return bot;
}

export async function startBot() {
  if (process.env.NODE_ENV !== "production") {
    log("Bot disabled in development mode (preview). Only runs in production.", "bot");
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log("TELEGRAM_BOT_TOKEN not set, bot will not start", "bot");
    return;
  }

  bot = new Telegraf<BotContext>(token);

  bot.use(async (ctx, next) => {
    if (ctx.from) {
      const telegramId = ctx.from.id.toString();
      ctx.dbUser = await storage.getUserByTelegramId(telegramId);
    }
    return next();
  });

  bot.command("start", handleStart);
  bot.command("menu", handleMenu);
  bot.command("admin", handleAdmin);

  bot.hears(ADMIN_PHRASE, handleAdminPhrase);

  bot.on("callback_query", handleCallback);
  bot.on("text", handleText);

  try {
    await bot.launch({ dropPendingUpdates: true });
    log("Telegram bot started successfully", "bot");
  } catch (err: any) {
    log(`Failed to start bot: ${err.message}`, "bot");
  }
}

export function stopBot() {
  if (bot) {
    bot.stop("SIGTERM");
    bot = null;
  }
}

const userStates = new Map<string, any>();

function setState(telegramId: string, state: any) {
  userStates.set(telegramId, state);
}

function getState(telegramId: string): any {
  return userStates.get(telegramId);
}

function clearState(telegramId: string) {
  userStates.delete(telegramId);
}

async function handleStart(ctx: BotContext) {
  const user = ctx.dbUser;
  if (user) {
    if (user.role === "admin") {
      await ctx.reply(
        `Добро пожаловать, администратор ${user.fullName}!\n\nИспользуйте /admin для управления ботом или /menu для главного меню.`
      );
    } else if (user.status === "pending") {
      await ctx.reply(
        `Здравствуйте, ${user.fullName}!\n\nВаша регистрация ожидает подтверждения администратором. Пожалуйста, подождите.`
      );
    } else if (user.status === "rejected") {
      await ctx.reply(
        `Здравствуйте, ${user.fullName}.\n\nВаша регистрация была отклонена администратором.`
      );
    } else if (user.status === "blocked") {
      await ctx.reply("Ваш аккаунт заблокирован администратором.");
    } else {
      await handleMenu(ctx);
    }
    return;
  }

  const settings = await storage.getSettings();
  if (!settings.registrationEnabled) {
    await ctx.reply("Добро пожаловать!\n\nК сожалению, регистрация в данный момент закрыта. Попробуйте позже.");
    return;
  }

  await ctx.reply(
    "Добро пожаловать в систему консультационных сессий!\n\n" +
    "Этот бот помогает клиентам найти консультантов, договориться о консультации и подтвердить её проведение.\n\n" +
    "Выберите роль для регистрации:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Зарегистрироваться как клиент", "register_client")],
      [Markup.button.callback("Зарегистрироваться как консультант", "register_consultant")],
      [Markup.button.callback("Что умеет бот?", "bot_help")],
    ])
  );
}

async function handleMenu(ctx: BotContext) {
  const user = ctx.dbUser;
  if (!user || user.status !== "active") {
    await ctx.reply("Пожалуйста, сначала зарегистрируйтесь командой /start");
    return;
  }

  if (user.role === "admin") {
    await handleAdmin(ctx);
    return;
  }

  if (user.role === "client") {
    await ctx.reply(
      `Меню клиента (${user.fullName}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Создать запрос на консультацию", "create_request")],
        [Markup.button.callback("Мои запросы", "my_requests")],
        [Markup.button.callback("Мои консультации", "my_sessions_client")],
        [Markup.button.callback("Профиль", "my_profile")],
      ])
    );
  } else if (user.role === "consultant") {
    await ctx.reply(
      `Меню консультанта (${user.fullName}):`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Доступные клиентские запросы", "available_requests")],
        [Markup.button.callback("Мои выбранные запросы", "my_taken_requests")],
        [Markup.button.callback("Мои консультации", "my_sessions_consultant")],
        [Markup.button.callback("Профиль", "my_profile")],
      ])
    );
  }
}

async function handleAdmin(ctx: BotContext) {
  const user = ctx.dbUser;
  if (!user || user.role !== "admin") {
    await ctx.reply("Эта команда доступна только администратору.");
    return;
  }

  await ctx.reply(
    "Панель администратора:",
    Markup.inlineKeyboard([
      [Markup.button.callback("Подтверждение регистраций", "admin_pending")],
      [Markup.button.callback("Список клиентов", "admin_clients")],
      [Markup.button.callback("Список консультантов", "admin_consultants")],
      [Markup.button.callback("Заявки на консультации", "admin_requests")],
      [Markup.button.callback("Согласованные консультации", "admin_sessions")],
      [Markup.button.callback("Управление режимом записи", "admin_settings")],
      [Markup.button.callback("Сбросить бота (обнулить всё)", "admin_reset")],
    ])
  );
}

async function handleAdminPhrase(ctx: BotContext) {
  const user = ctx.dbUser;
  if (!user) {
    await ctx.reply("Сначала зарегистрируйтесь с помощью команды /start");
    return;
  }

  const existingAdmin = await storage.getAdminUser();
  if (existingAdmin) {
    await ctx.reply("Администратор уже назначен.");
    return;
  }

  await storage.updateUser(user.id, { role: "admin", status: "active" });
  ctx.dbUser = { ...user, role: "admin", status: "active" };
  await ctx.reply(
    "Вы назначены администратором бота. Теперь вы можете управлять регистрациями, консультантами, клиентами и консультациями.\n\nИспользуйте /admin для доступа к панели управления."
  );
}

async function handleCallback(ctx: BotContext) {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;
  const data = ctx.callbackQuery.data;
  const user = ctx.dbUser;
  const telegramId = ctx.from?.id.toString() || "";

  try {
    await ctx.answerCbQuery();
  } catch (e) {}

  if (data === "bot_help") {
    await ctx.reply(
      "Что умеет этот бот:\n\n" +
      "1. Клиенты могут создавать запросы на консультацию по интересующим темам\n" +
      "2. Консультанты просматривают запросы и берут их в работу\n" +
      "3. Консультант предлагает время, клиент подтверждает\n" +
      "4. После консультации обе стороны подтверждают факт её проведения\n" +
      "5. Администратор управляет всем процессом\n\n" +
      "Используйте /start для регистрации."
    );
    return;
  }

  if (data === "register_client") {
    const settings = await storage.getSettings();
    if (!settings.registrationEnabled) {
      await ctx.reply("Регистрация в данный момент закрыта.");
      return;
    }
    setState(telegramId, { step: "reg_client_name" });
    await ctx.reply("Введите ваше ФИО:");
    return;
  }

  if (data === "register_consultant") {
    const settings = await storage.getSettings();
    if (!settings.registrationEnabled) {
      await ctx.reply("Регистрация в данный момент закрыта.");
      return;
    }
    setState(telegramId, { step: "reg_consultant_name" });
    await ctx.reply("Введите ваше ФИО:");
    return;
  }

  if (!user) {
    await ctx.reply("Пожалуйста, зарегистрируйтесь с помощью /start");
    return;
  }

  if (data === "my_profile") {
    await showProfile(ctx, user);
    return;
  }

  if (data === "create_request") {
    await startCreateRequest(ctx, user, telegramId);
    return;
  }

  if (data === "my_requests") {
    await showMyRequests(ctx, user);
    return;
  }

  if (data.startsWith("view_request_")) {
    const reqId = parseInt(data.replace("view_request_", ""));
    await showRequestDetail(ctx, user, reqId);
    return;
  }

  if (data.startsWith("cancel_request_")) {
    const reqId = parseInt(data.replace("cancel_request_", ""));
    await cancelRequest(ctx, user, reqId);
    return;
  }

  if (data === "my_sessions_client") {
    await showMySessions(ctx, user, "client");
    return;
  }

  if (data === "my_sessions_consultant") {
    await showMySessions(ctx, user, "consultant");
    return;
  }

  if (data.startsWith("confirm_session_yes_")) {
    const sessionId = parseInt(data.replace("confirm_session_yes_", ""));
    await confirmSession(ctx, user, sessionId, true);
    return;
  }

  if (data.startsWith("confirm_session_no_")) {
    const sessionId = parseInt(data.replace("confirm_session_no_", ""));
    await confirmSession(ctx, user, sessionId, false);
    return;
  }

  if (data === "available_requests") {
    await showAvailableRequests(ctx, user);
    return;
  }

  if (data.startsWith("take_request_")) {
    const reqId = parseInt(data.replace("take_request_", ""));
    await takeRequest(ctx, user, reqId);
    return;
  }

  if (data === "my_taken_requests") {
    await showTakenRequests(ctx, user);
    return;
  }

  if (data.startsWith("propose_time_")) {
    const reqId = parseInt(data.replace("propose_time_", ""));
    setState(telegramId, { step: "propose_time", requestId: reqId });
    await ctx.reply("Введите предлагаемую дату и время консультации (например: 15.03.2026 14:00):");
    return;
  }

  if (data.startsWith("return_request_")) {
    const reqId = parseInt(data.replace("return_request_", ""));
    await returnRequest(ctx, user, reqId);
    return;
  }

  if (data.startsWith("accept_time_")) {
    const reqId = parseInt(data.replace("accept_time_", ""));
    await acceptProposedTime(ctx, user, reqId);
    return;
  }

  if (data.startsWith("reject_time_")) {
    const reqId = parseInt(data.replace("reject_time_", ""));
    setState(telegramId, { step: "counter_time", requestId: reqId });
    await ctx.reply("Введите удобную для вас дату и время (например: 15.03.2026 14:00):");
    return;
  }

  if (data.startsWith("accept_client_time_")) {
    const reqId = parseInt(data.replace("accept_client_time_", ""));
    await acceptClientTime(ctx, user, reqId);
    return;
  }

  if (data.startsWith("ask_confirm_")) {
    const sessionId = parseInt(data.replace("ask_confirm_", ""));
    await askSessionConfirmation(ctx, sessionId);
    return;
  }

  // Admin callbacks
  if (user.role === "admin") {
    await handleAdminCallback(ctx, user, data, telegramId);
  }
}

async function handleAdminCallback(ctx: BotContext, user: User, data: string, telegramId: string) {
  if (data === "admin_pending") {
    const pendingClients = await storage.getUsersByRoleAndStatus("client", "pending");
    const pendingConsultants = await storage.getUsersByRoleAndStatus("consultant", "pending");
    await ctx.reply(
      `Ожидают подтверждения:\nКлиенты: ${pendingClients.length}\nКонсультанты: ${pendingConsultants.length}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Просмотреть клиентов", "admin_pending_clients")],
        [Markup.button.callback("Просмотреть консультантов", "admin_pending_consultants")],
        [Markup.button.callback("Назад", "admin_back")],
      ])
    );
    return;
  }

  if (data === "admin_back") {
    await handleAdmin(ctx);
    return;
  }

  if (data === "admin_pending_clients") {
    const pending = await storage.getUsersByRoleAndStatus("client", "pending");
    if (pending.length === 0) {
      await ctx.reply("Нет ожидающих клиентов.", Markup.inlineKeyboard([[Markup.button.callback("Назад", "admin_pending")]]));
      return;
    }
    for (const p of pending) {
      const info = `Клиент: ${p.fullName}\nUsername: @${p.username || "нет"}\nОписание: ${p.description || "нет"}\nКонтакт: ${p.contact || "нет"}`;
      await ctx.reply(info, Markup.inlineKeyboard([
        [Markup.button.callback("Подтвердить", `approve_user_${p.id}`)],
        [Markup.button.callback("Отклонить", `reject_user_${p.id}`)],
      ]));
    }
    return;
  }

  if (data === "admin_pending_consultants") {
    const pending = await storage.getUsersByRoleAndStatus("consultant", "pending");
    if (pending.length === 0) {
      await ctx.reply("Нет ожидающих консультантов.", Markup.inlineKeyboard([[Markup.button.callback("Назад", "admin_pending")]]));
      return;
    }
    for (const p of pending) {
      const info = `Консультант: ${p.fullName}\nUsername: @${p.username || "нет"}\nКомпетенции: ${p.competencies || "нет"}\nОпыт: ${p.experience || "нет"}\nЧасовой пояс: ${p.timezone || "нет"}`;
      await ctx.reply(info, Markup.inlineKeyboard([
        [Markup.button.callback("Подтвердить", `approve_user_${p.id}`)],
        [Markup.button.callback("Отклонить", `reject_user_${p.id}`)],
      ]));
    }
    return;
  }

  if (data.startsWith("approve_user_")) {
    const userId = parseInt(data.replace("approve_user_", ""));
    const target = await storage.getUser(userId);
    if (!target) { await ctx.reply("Пользователь не найден."); return; }
    await storage.updateUser(userId, { status: "active" });
    await ctx.reply(`${target.fullName} подтверждён.`);
    try {
      await bot?.telegram.sendMessage(target.telegramId,
        target.role === "client"
          ? "Ваша регистрация подтверждена! Вы можете создавать запросы на консультацию. Используйте /menu"
          : "Ваша регистрация подтверждена! Вы можете просматривать запросы клиентов и выбирать консультации. Используйте /menu"
      );
    } catch (e) {}
    return;
  }

  if (data.startsWith("reject_user_")) {
    const userId = parseInt(data.replace("reject_user_", ""));
    const target = await storage.getUser(userId);
    if (!target) { await ctx.reply("Пользователь не найден."); return; }
    await storage.updateUser(userId, { status: "rejected" });
    await ctx.reply(`${target.fullName} отклонён.`);
    try {
      await bot?.telegram.sendMessage(target.telegramId, "Ваша регистрация отклонена администратором.");
    } catch (e) {}
    return;
  }

  if (data === "admin_clients") {
    const clients = await storage.getUsersByRole("client");
    if (clients.length === 0) {
      await ctx.reply("Нет зарегистрированных клиентов.", Markup.inlineKeyboard([[Markup.button.callback("Назад", "admin_back")]]));
      return;
    }
    let msg = "Список клиентов:\n\n";
    const buttons: any[] = [];
    for (const c of clients) {
      msg += `[${c.id}] ${c.fullName} (@${c.username || "нет"}) — ${c.status}\n`;
      if (c.status === "active") {
        buttons.push([Markup.button.callback(`Сменить роль на консультанта: ${c.fullName}`, `changerole_consultant_${c.id}`)]);
        buttons.push([Markup.button.callback(`Заблокировать ${c.fullName}`, `block_user_${c.id}`)]);
      } else if (c.status === "blocked") {
        buttons.push([Markup.button.callback(`Разблокировать ${c.fullName}`, `unblock_user_${c.id}`)]);
      }
    }
    buttons.push([Markup.button.callback("Назад", "admin_back")]);
    await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    return;
  }

  if (data === "admin_consultants") {
    const consultants = await storage.getUsersByRole("consultant");
    if (consultants.length === 0) {
      await ctx.reply("Нет зарегистрированных консультантов.", Markup.inlineKeyboard([[Markup.button.callback("Назад", "admin_back")]]));
      return;
    }
    let msg = "Список консультантов:\n\n";
    const buttons: any[] = [];
    for (const c of consultants) {
      msg += `[${c.id}] ${c.fullName} (@${c.username || "нет"}) — ${c.status}\n`;
      if (c.status === "active") {
        buttons.push([Markup.button.callback(`Сменить роль на клиента: ${c.fullName}`, `changerole_client_${c.id}`)]);
        buttons.push([Markup.button.callback(`Заблокировать ${c.fullName}`, `block_user_${c.id}`)]);
      } else if (c.status === "blocked") {
        buttons.push([Markup.button.callback(`Разблокировать ${c.fullName}`, `unblock_user_${c.id}`)]);
      }
    }
    buttons.push([Markup.button.callback("Назад", "admin_back")]);
    await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    return;
  }

  if (data.startsWith("block_user_")) {
    const userId = parseInt(data.replace("block_user_", ""));
    await storage.updateUser(userId, { status: "blocked" });
    await ctx.reply("Пользователь заблокирован.");
    return;
  }

  if (data.startsWith("unblock_user_")) {
    const userId = parseInt(data.replace("unblock_user_", ""));
    await storage.updateUser(userId, { status: "active" });
    await ctx.reply("Пользователь разблокирован.");
    return;
  }

  if (data.startsWith("changerole_")) {
    const parts = data.replace("changerole_", "").split("_");
    const newRole = parts[0] as "client" | "consultant";
    const userId = parseInt(parts[1]);
    const target = await storage.getUser(userId);
    if (!target) { await ctx.reply("Пользователь не найден."); return; }
    if (target.role === newRole) { await ctx.reply("Пользователь уже имеет эту роль."); return; }
    const oldRole = target.role === "client" ? "клиент" : "консультант";
    const newRoleLabel = newRole === "client" ? "клиент" : "консультант";
    await storage.updateUser(userId, { role: newRole });
    await ctx.reply(`Роль пользователя ${target.fullName} изменена: ${oldRole} → ${newRoleLabel}.`);
    try {
      await bot?.telegram.sendMessage(target.telegramId,
        `Ваша роль была изменена администратором.\nНовая роль: ${newRoleLabel}.\nИспользуйте /menu для доступа к новому функционалу.`
      );
    } catch (e) {}
    return;
  }

  if (data === "admin_requests") {
    const allReqs = await storage.getAllRequests();
    const open = allReqs.filter(r => r.status === "open");
    const taken = allReqs.filter(r => r.status === "taken");
    const timeProp = allReqs.filter(r => r.status === "time_proposed");
    const scheduled = allReqs.filter(r => r.status === "scheduled");
    const cancelled = allReqs.filter(r => r.status === "cancelled");
    await ctx.reply(
      `Заявки на консультации:\n\nОткрытые: ${open.length}\nВ работе: ${taken.length}\nОжидают подтверждения времени: ${timeProp.length}\nЗапланированные: ${scheduled.length}\nОтменённые: ${cancelled.length}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Открытые", "admin_reqs_open")],
        [Markup.button.callback("В работе", "admin_reqs_taken")],
        [Markup.button.callback("Запланированные", "admin_reqs_scheduled")],
        [Markup.button.callback("Назад", "admin_back")],
      ])
    );
    return;
  }

  if (data.startsWith("admin_reqs_")) {
    const status = data.replace("admin_reqs_", "");
    const reqs = await storage.getRequestsByStatus(status);
    if (reqs.length === 0) {
      await ctx.reply(`Нет заявок со статусом "${status}".`, Markup.inlineKeyboard([[Markup.button.callback("Назад", "admin_requests")]]));
      return;
    }
    for (const r of reqs) {
      const client = await storage.getUser(r.clientId);
      const consultant = r.consultantId ? await storage.getUser(r.consultantId) : null;
      let msg = `Заявка #${r.id}\nТема: ${r.topic}\nКлиент: ${client?.fullName || "неизвестен"}\nСтатус: ${r.status}`;
      if (consultant) msg += `\nКонсультант: ${consultant.fullName}`;
      if (r.preferredTime) msg += `\nЖелаемое время: ${r.preferredTime}`;

      const buttons: any[] = [];
      if (r.status !== "cancelled") {
        buttons.push([Markup.button.callback("Отменить заявку", `admin_cancel_req_${r.id}`)]);
      }
      buttons.push([Markup.button.callback("Назад", "admin_requests")]);
      await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    }
    return;
  }

  if (data.startsWith("admin_cancel_req_")) {
    const reqId = parseInt(data.replace("admin_cancel_req_", ""));
    await storage.updateRequest(reqId, { status: "cancelled" });
    await ctx.reply("Заявка отменена.");
    return;
  }

  if (data === "admin_sessions") {
    const sessions = await storage.getAllSessions();
    if (sessions.length === 0) {
      await ctx.reply("Нет согласованных консультаций.", Markup.inlineKeyboard([[Markup.button.callback("Назад", "admin_back")]]));
      return;
    }
    for (const s of sessions) {
      const client = await storage.getUser(s.clientId);
      const consultant = await storage.getUser(s.consultantId);
      let statusText = s.status;
      if (s.status === "scheduled") statusText = "Запланирована";
      else if (s.status === "completed") statusText = "Проведена (обе стороны подтвердили)";
      else if (s.status === "disagreement") statusText = "Расхождение в подтверждениях";
      else if (s.status === "not_happened") statusText = "Не состоялась";
      else if (s.status === "cancelled") statusText = "Отменена";

      let confirmInfo = "";
      if (s.clientConfirmed !== null) confirmInfo += `\nКлиент: ${s.clientConfirmed ? "Да" : "Нет"}`;
      if (s.consultantConfirmed !== null) confirmInfo += `\nКонсультант: ${s.consultantConfirmed ? "Да" : "Нет"}`;

      const msg = `Консультация #${s.id}\nТема: ${s.topic}\nКлиент: ${client?.fullName || "?"}\nКонсультант: ${consultant?.fullName || "?"}\nДата/время: ${s.scheduledAt}\nСтатус: ${statusText}${confirmInfo}`;

      const buttons: any[] = [];
      if (s.status === "scheduled") {
        buttons.push([Markup.button.callback("Запросить подтверждение", `ask_confirm_${s.id}`)]);
        buttons.push([Markup.button.callback("Отменить", `admin_cancel_session_${s.id}`)]);
      }
      buttons.push([Markup.button.callback("Назад", "admin_back")]);
      await ctx.reply(msg, Markup.inlineKeyboard(buttons));
    }
    return;
  }

  if (data.startsWith("admin_cancel_session_")) {
    const sessionId = parseInt(data.replace("admin_cancel_session_", ""));
    await storage.updateSession(sessionId, { status: "cancelled" });
    await ctx.reply("Консультация отменена.");
    return;
  }

  if (data === "admin_settings") {
    const settings = await storage.getSettings();
    await ctx.reply(
      `Текущие настройки:\n\nРегистрация пользователей: ${settings.registrationEnabled ? "включена" : "выключена"}\nЗапись на консультации: ${settings.consultationsEnabled ? "включена" : "приостановлена"}`,
      Markup.inlineKeyboard([
        [Markup.button.callback(
          settings.registrationEnabled ? "Выключить регистрацию" : "Включить регистрацию",
          "toggle_registration"
        )],
        [Markup.button.callback(
          settings.consultationsEnabled ? "Приостановить запись" : "Включить запись",
          "toggle_consultations"
        )],
        [Markup.button.callback("Назад", "admin_back")],
      ])
    );
    return;
  }

  if (data === "toggle_registration") {
    const settings = await storage.getSettings();
    await storage.updateSettings({ registrationEnabled: !settings.registrationEnabled });
    await ctx.reply(`Регистрация ${!settings.registrationEnabled ? "включена" : "выключена"}.`);
    return;
  }

  if (data === "toggle_consultations") {
    const settings = await storage.getSettings();
    await storage.updateSettings({ consultationsEnabled: !settings.consultationsEnabled });
    await ctx.reply(`Запись на консультации ${!settings.consultationsEnabled ? "включена" : "приостановлена"}.`);
    return;
  }

  if (data === "admin_reset") {
    await ctx.reply(
      "ВНИМАНИЕ: будут удалены все пользователи, консультанты, заявки и консультации. Бот вернётся в начальное состояние. Действие необратимо.",
      Markup.inlineKeyboard([
        [Markup.button.callback("Подтвердить сброс", "admin_reset_confirm")],
        [Markup.button.callback("Отменить", "admin_back")],
      ])
    );
    return;
  }

  if (data === "admin_reset_confirm") {
    await storage.resetAll();
    userStates.clear();
    await ctx.reply("Бот полностью сброшен. Все данные удалены. Следующий зарегистрированный пользователь может стать администратором.");
    return;
  }
}

async function showProfile(ctx: BotContext, user: User) {
  let msg = `Ваш профиль:\n\nИмя: ${user.fullName}\nРоль: ${user.role}\nСтатус: ${user.status}`;
  if (user.username) msg += `\nUsername: @${user.username}`;
  if (user.description) msg += `\nОписание: ${user.description}`;
  if (user.competencies) msg += `\nКомпетенции: ${user.competencies}`;
  if (user.contact) msg += `\nКонтакт: ${user.contact}`;
  if (user.timezone) msg += `\nЧасовой пояс: ${user.timezone}`;
  await ctx.reply(msg);
}

async function startCreateRequest(ctx: BotContext, user: User, telegramId: string) {
  if (user.role !== "client" || user.status !== "active") {
    await ctx.reply("Только подтверждённые клиенты могут создавать запросы.");
    return;
  }
  const settings = await storage.getSettings();
  if (!settings.consultationsEnabled) {
    await ctx.reply("Запись на консультации временно приостановлена администратором.");
    return;
  }
  setState(telegramId, { step: "req_topic" });
  await ctx.reply("Введите тему консультации:");
}

async function showMyRequests(ctx: BotContext, user: User) {
  const requests = await storage.getRequestsByClient(user.id);
  if (requests.length === 0) {
    await ctx.reply("У вас нет запросов на консультацию.", Markup.inlineKeyboard([[Markup.button.callback("Меню", "back_to_menu")]]));
    return;
  }

  for (const r of requests) {
    let statusText = r.status;
    if (r.status === "open") statusText = "Открыт";
    else if (r.status === "taken") statusText = "В работе";
    else if (r.status === "time_proposed") statusText = "Ожидает подтверждения времени";
    else if (r.status === "scheduled") statusText = "Консультация назначена";
    else if (r.status === "cancelled") statusText = "Отменён";

    const msg = `Запрос #${r.id}\nТема: ${r.topic}\nСтатус: ${statusText}`;
    const buttons: any[] = [[Markup.button.callback("Подробнее", `view_request_${r.id}`)]];
    if (r.status === "open" || r.status === "taken") {
      buttons.push([Markup.button.callback("Отменить", `cancel_request_${r.id}`)]);
    }
    await ctx.reply(msg, Markup.inlineKeyboard(buttons));
  }
}

async function showRequestDetail(ctx: BotContext, user: User, reqId: number) {
  const req = await storage.getRequest(reqId);
  if (!req) { await ctx.reply("Запрос не найден."); return; }

  let msg = `Запрос #${req.id}\n\nТема: ${req.topic}\nПредпочтительное время: ${req.preferredTime || "не указано"}\nДетали: ${req.details || "нет"}\nСтатус: ${req.status}`;

  if (req.consultantId) {
    const consultant = await storage.getUser(req.consultantId);
    if (consultant) msg += `\nКонсультант: ${consultant.fullName}`;
  }

  await ctx.reply(msg);
}

async function cancelRequest(ctx: BotContext, user: User, reqId: number) {
  const req = await storage.getRequest(reqId);
  if (!req || req.clientId !== user.id) { await ctx.reply("Запрос не найден."); return; }
  await storage.updateRequest(reqId, { status: "cancelled" });
  await ctx.reply("Запрос отменён.");
}

async function showMySessions(ctx: BotContext, user: User, role: "client" | "consultant") {
  const sessions = role === "client"
    ? await storage.getSessionsByClient(user.id)
    : await storage.getSessionsByConsultant(user.id);

  if (sessions.length === 0) {
    await ctx.reply("У вас нет консультаций.");
    return;
  }

  for (const s of sessions) {
    const otherUser = role === "client"
      ? await storage.getUser(s.consultantId)
      : await storage.getUser(s.clientId);

    let statusText = s.status;
    if (s.status === "scheduled") statusText = "Запланирована";
    else if (s.status === "completed") statusText = "Проведена";
    else if (s.status === "disagreement") statusText = "Расхождение";
    else if (s.status === "not_happened") statusText = "Не состоялась";
    else if (s.status === "cancelled") statusText = "Отменена";

    const otherRole = role === "client" ? "Консультант" : "Клиент";
    const msg = `Консультация #${s.id}\nТема: ${s.topic}\n${otherRole}: ${otherUser?.fullName || "?"}\nДата/время: ${s.scheduledAt}\nСтатус: ${statusText}`;

    const buttons: any[] = [];
    if (s.status === "scheduled") {
      const myConfirm = role === "client" ? s.clientConfirmed : s.consultantConfirmed;
      if (myConfirm === null) {
        buttons.push([Markup.button.callback("Да, состоялась", `confirm_session_yes_${s.id}`)]);
        buttons.push([Markup.button.callback("Нет, не состоялась", `confirm_session_no_${s.id}`)]);
      }
    }
    await ctx.reply(msg, buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined);
  }
}

async function confirmSession(ctx: BotContext, user: User, sessionId: number, confirmed: boolean) {
  const session = await storage.getSession(sessionId);
  if (!session) { await ctx.reply("Консультация не найдена."); return; }

  const isClient = session.clientId === user.id;
  const isConsultant = session.consultantId === user.id;

  if (!isClient && !isConsultant) {
    await ctx.reply("Вы не участвуете в этой консультации.");
    return;
  }

  const updateData: any = {};
  if (isClient) updateData.clientConfirmed = confirmed;
  if (isConsultant) updateData.consultantConfirmed = confirmed;

  const updated = await storage.updateSession(sessionId, updateData);
  if (!updated) return;

  const cc = isClient ? confirmed : updated.clientConfirmed;
  const ccons = isConsultant ? confirmed : updated.consultantConfirmed;

  if (cc !== null && ccons !== null) {
    if (cc && ccons) {
      await storage.updateSession(sessionId, { status: "completed" });
      await ctx.reply("Спасибо! Обе стороны подтвердили проведение консультации.");
    } else if (!cc && !ccons) {
      await storage.updateSession(sessionId, { status: "not_happened" });
      await ctx.reply("Обе стороны указали, что консультация не состоялась.");
    } else {
      await storage.updateSession(sessionId, { status: "disagreement" });
      await ctx.reply("Записано. Есть расхождение в подтверждениях — администратор будет уведомлён.");
    }
  } else {
    await ctx.reply(`Ваш ответ записан: ${confirmed ? "состоялась" : "не состоялась"}. Ожидаем подтверждение второй стороны.`);
  }
}

async function showAvailableRequests(ctx: BotContext, user: User) {
  if (user.role !== "consultant" || user.status !== "active") {
    await ctx.reply("Только подтверждённые консультанты могут просматривать запросы.");
    return;
  }

  const openRequests = await storage.getRequestsByStatus("open");
  if (openRequests.length === 0) {
    await ctx.reply("Нет доступных запросов на консультацию.");
    return;
  }

  for (const r of openRequests) {
    const client = await storage.getUser(r.clientId);
    const msg = `Запрос #${r.id}\nТема: ${r.topic}\nКлиент: ${client?.fullName || "неизвестен"}\nЖелаемое время: ${r.preferredTime || "не указано"}`;
    await ctx.reply(msg, Markup.inlineKeyboard([
      [Markup.button.callback("Взять запрос", `take_request_${r.id}`)],
    ]));
  }
}

async function takeRequest(ctx: BotContext, user: User, reqId: number) {
  if (user.role !== "consultant" || user.status !== "active") {
    await ctx.reply("Действие недоступно.");
    return;
  }
  const req = await storage.getRequest(reqId);
  if (!req || req.status !== "open") {
    await ctx.reply("Запрос недоступен.");
    return;
  }

  await storage.updateRequest(reqId, { status: "taken", consultantId: user.id });
  await ctx.reply(
    `Вы взяли запрос #${reqId}. Теперь предложите время консультации.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("Предложить время", `propose_time_${reqId}`)],
      [Markup.button.callback("Вернуть в общий список", `return_request_${reqId}`)],
    ])
  );

  const client = await storage.getUser(req.clientId);
  if (client) {
    try {
      await bot?.telegram.sendMessage(client.telegramId,
        `Ваш запрос "${req.topic}" взял консультант ${user.fullName}. Он предложит время консультации.`
      );
    } catch (e) {}
  }
}

async function returnRequest(ctx: BotContext, user: User, reqId: number) {
  const req = await storage.getRequest(reqId);
  if (!req || req.consultantId !== user.id) {
    await ctx.reply("Запрос не найден.");
    return;
  }
  await storage.updateRequest(reqId, { status: "open", consultantId: null });
  await ctx.reply("Запрос возвращён в общий список.");
}

async function showTakenRequests(ctx: BotContext, user: User) {
  const taken = (await storage.getRequestsByConsultant(user.id)).filter(
    r => r.status === "taken" || r.status === "time_proposed" || r.status === "counter_proposed"
  );

  if (taken.length === 0) {
    await ctx.reply("У вас нет взятых запросов.");
    return;
  }

  for (const r of taken) {
    const client = await storage.getUser(r.clientId);
    let statusText = r.status === "taken" ? "В работе" : r.status === "time_proposed" ? "Ожидает подтверждения времени" : "Клиент предложил время";
    const msg = `Запрос #${r.id}\nТема: ${r.topic}\nКлиент: ${client?.fullName || "?"}\nСтатус: ${statusText}`;

    const buttons: any[] = [];
    if (r.status === "taken") {
      buttons.push([Markup.button.callback("Предложить время", `propose_time_${r.id}`)]);
    }
    buttons.push([Markup.button.callback("Вернуть в общий список", `return_request_${r.id}`)]);
    await ctx.reply(msg, Markup.inlineKeyboard(buttons));
  }
}

async function acceptProposedTime(ctx: BotContext, user: User, reqId: number) {
  const req = await storage.getRequest(reqId);
  if (!req || req.status !== "time_proposed" || req.clientId !== user.id) {
    await ctx.reply("Запрос не найден.");
    return;
  }

  await storage.updateRequest(reqId, { status: "scheduled" });

  const session = await storage.createSession({
    requestId: reqId,
    clientId: req.clientId,
    consultantId: req.consultantId!,
    scheduledAt: req.preferredTime || "по договорённости",
    topic: req.topic,
    status: "scheduled",
    clientConfirmed: null,
    consultantConfirmed: null,
  });

  await ctx.reply(`Консультация назначена на ${req.preferredTime || "согласованное время"}!`);

  const consultant = await storage.getUser(req.consultantId!);
  if (consultant) {
    try {
      await bot?.telegram.sendMessage(consultant.telegramId,
        `Клиент подтвердил время консультации "${req.topic}" на ${req.preferredTime || "согласованное время"}.`
      );
    } catch (e) {}
  }
}

async function acceptClientTime(ctx: BotContext, user: User, reqId: number) {
  if (user.role !== "consultant" || user.status !== "active") {
    await ctx.reply("Действие недоступно.");
    return;
  }
  const req = await storage.getRequest(reqId);
  if (!req || req.consultantId !== user.id) {
    await ctx.reply("Запрос не найден.");
    return;
  }

  await storage.updateRequest(reqId, { status: "scheduled" });

  const session = await storage.createSession({
    requestId: reqId,
    clientId: req.clientId,
    consultantId: req.consultantId!,
    scheduledAt: req.preferredTime || "по договорённости",
    topic: req.topic,
    status: "scheduled",
    clientConfirmed: null,
    consultantConfirmed: null,
  });

  await ctx.reply(`Консультация назначена на ${req.preferredTime || "согласованное время"}!`);

  const client = await storage.getUser(req.clientId);
  if (client) {
    try {
      await bot?.telegram.sendMessage(client.telegramId,
        `Консультант ${user.fullName} принял ваше время. Консультация "${req.topic}" назначена на ${req.preferredTime || "согласованное время"}.`
      );
    } catch (e) {}
  }
}

async function askSessionConfirmation(ctx: BotContext, sessionId: number) {
  const session = await storage.getSession(sessionId);
  if (!session) { await ctx.reply("Консультация не найдена."); return; }

  const client = await storage.getUser(session.clientId);
  const consultant = await storage.getUser(session.consultantId);

  if (client) {
    try {
      await bot?.telegram.sendMessage(client.telegramId,
        `Консультация с ${consultant?.fullName || "консультантом"} по теме "${session.topic}" (${session.scheduledAt}) состоялась?`,
        Markup.inlineKeyboard([
          [Markup.button.callback("Да, состоялась", `confirm_session_yes_${session.id}`)],
          [Markup.button.callback("Нет, не состоялась", `confirm_session_no_${session.id}`)],
        ]) as any
      );
    } catch (e) {}
  }

  if (consultant) {
    try {
      await bot?.telegram.sendMessage(consultant.telegramId,
        `Консультация с клиентом ${client?.fullName || ""} по теме "${session.topic}" (${session.scheduledAt}) состоялась?`,
        Markup.inlineKeyboard([
          [Markup.button.callback("Да, состоялась", `confirm_session_yes_${session.id}`)],
          [Markup.button.callback("Нет, не состоялась", `confirm_session_no_${session.id}`)],
        ]) as any
      );
    } catch (e) {}
  }

  await ctx.reply("Запросы на подтверждение отправлены обеим сторонам.");
}

async function handleText(ctx: BotContext) {
  if (!ctx.message || !("text" in ctx.message)) return;
  const text = ctx.message.text;
  const telegramId = ctx.from?.id.toString() || "";

  if (text.startsWith("/")) return;
  if (text === ADMIN_PHRASE) return;

  const state = getState(telegramId);
  if (!state) {
    if (ctx.dbUser) {
      await ctx.reply("Используйте /menu для навигации.");
    } else {
      await ctx.reply("Используйте /start для начала работы.");
    }
    return;
  }

  // Registration flows
  if (state.step === "reg_client_name") {
    setState(telegramId, { ...state, step: "reg_client_description", fullName: text });
    await ctx.reply("Кратко опишите тематику интересующих вас консультаций (или отправьте '-' чтобы пропустить):");
    return;
  }

  if (state.step === "reg_client_description") {
    setState(telegramId, { ...state, step: "reg_client_contact", description: text === "-" ? null : text });
    await ctx.reply("Введите контакт (телефон или e-mail, или '-' чтобы пропустить):");
    return;
  }

  if (state.step === "reg_client_contact") {
    const newUser = await storage.createUser({
      telegramId,
      username: ctx.from?.username || null,
      fullName: state.fullName,
      role: "client",
      status: "pending",
      description: state.description || null,
      contact: text === "-" ? null : text,
      competencies: null,
      experience: null,
      timezone: null,
    });
    clearState(telegramId);
    ctx.dbUser = newUser;

    await ctx.reply("Ваша регистрация отправлена администратору на подтверждение. После одобрения вы сможете создавать запросы на консультации.");

    const admin = await storage.getAdminUser();
    if (admin) {
      try {
        await bot?.telegram.sendMessage(admin.telegramId,
          `Новый запрос на регистрацию клиента:\nИмя: ${newUser.fullName}\nUsername: @${newUser.username || "нет"}\nОписание: ${newUser.description || "нет"}\nКонтакт: ${newUser.contact || "нет"}`,
          Markup.inlineKeyboard([
            [Markup.button.callback("Подтвердить клиента", `approve_user_${newUser.id}`)],
            [Markup.button.callback("Отклонить клиента", `reject_user_${newUser.id}`)],
          ]) as any
        );
      } catch (e) {}
    }
    return;
  }

  if (state.step === "reg_consultant_name") {
    setState(telegramId, { ...state, step: "reg_consultant_competencies", fullName: text });
    await ctx.reply("Укажите область ваших компетенций:");
    return;
  }

  if (state.step === "reg_consultant_competencies") {
    setState(telegramId, { ...state, step: "reg_consultant_experience", competencies: text });
    await ctx.reply("Кратко опишите ваш опыт (или '-' чтобы пропустить):");
    return;
  }

  if (state.step === "reg_consultant_experience") {
    setState(telegramId, { ...state, step: "reg_consultant_timezone", experience: text === "-" ? null : text });
    await ctx.reply("Укажите ваш часовой пояс (например: МСК, UTC+3):");
    return;
  }

  if (state.step === "reg_consultant_timezone") {
    const newUser = await storage.createUser({
      telegramId,
      username: ctx.from?.username || null,
      fullName: state.fullName,
      role: "consultant",
      status: "pending",
      competencies: state.competencies,
      experience: state.experience || null,
      timezone: text,
      description: null,
      contact: null,
    });
    clearState(telegramId);
    ctx.dbUser = newUser;

    await ctx.reply("Ваша регистрация отправлена администратору на подтверждение. После одобрения вы сможете просматривать запросы клиентов и выбирать консультации.");

    const admin = await storage.getAdminUser();
    if (admin) {
      try {
        await bot?.telegram.sendMessage(admin.telegramId,
          `Новый запрос на регистрацию консультанта:\nИмя: ${newUser.fullName}\nUsername: @${newUser.username || "нет"}\nКомпетенции: ${newUser.competencies || "нет"}\nОпыт: ${newUser.experience || "нет"}\nЧасовой пояс: ${newUser.timezone || "нет"}`,
          Markup.inlineKeyboard([
            [Markup.button.callback("Подтвердить консультанта", `approve_user_${newUser.id}`)],
            [Markup.button.callback("Отклонить консультанта", `reject_user_${newUser.id}`)],
          ]) as any
        );
      } catch (e) {}
    }
    return;
  }

  // Create consultation request flow
  if (state.step === "req_topic") {
    setState(telegramId, { ...state, step: "req_time", topic: text });
    await ctx.reply("Укажите предпочтительные даты/время (или '-' чтобы пропустить):");
    return;
  }

  if (state.step === "req_time") {
    setState(telegramId, { ...state, step: "req_details", preferredTime: text === "-" ? null : text });
    await ctx.reply("Дополнительные детали (или '-' чтобы пропустить):");
    return;
  }

  if (state.step === "req_details") {
    const user = ctx.dbUser!;
    const newReq = await storage.createRequest({
      clientId: user.id,
      topic: state.topic,
      preferredTime: state.preferredTime || null,
      details: text === "-" ? null : text,
      status: "open",
      consultantId: null,
    });
    clearState(telegramId);
    await ctx.reply("Ваш запрос создан и доступен консультантам. Ожидайте, пока один из консультантов возьмёт его в работу.");

    const consultants = await storage.getUsersByRoleAndStatus("consultant", "active");
    for (const c of consultants) {
      try {
        await bot?.telegram.sendMessage(c.telegramId,
          `Новый запрос на консультацию!\nТема: ${newReq.topic}\nИспользуйте /menu для просмотра доступных запросов.`
        );
      } catch (e) {}
    }
    return;
  }

  // Propose time flow
  if (state.step === "propose_time") {
    const reqId = state.requestId;
    const req = await storage.getRequest(reqId);
    if (!req) { await ctx.reply("Запрос не найден."); clearState(telegramId); return; }

    await storage.updateRequest(reqId, { status: "time_proposed", preferredTime: text });
    clearState(telegramId);
    await ctx.reply("Время предложено клиенту. Ожидаем подтверждение.");

    const client = await storage.getUser(req.clientId);
    const consultant = ctx.dbUser;
    if (client) {
      try {
        await bot?.telegram.sendMessage(client.telegramId,
          `Консультант ${consultant?.fullName || ""} предлагает провести консультацию "${req.topic}" в: ${text}.\n\nПодтверждаете?`,
          Markup.inlineKeyboard([
            [Markup.button.callback("Подтвердить", `accept_time_${reqId}`)],
            [Markup.button.callback("Предложить другое время", `reject_time_${reqId}`)],
          ]) as any
        );
      } catch (e) {}
    }
    return;
  }

  // Counter-propose time flow
  if (state.step === "counter_time") {
    const reqId = state.requestId;
    const req = await storage.getRequest(reqId);
    if (!req) { await ctx.reply("Запрос не найден."); clearState(telegramId); return; }

    await storage.updateRequest(reqId, { status: "taken", preferredTime: text });
    clearState(telegramId);
    await ctx.reply("Ваше предложение по времени отправлено консультанту.");

    const consultant = req.consultantId ? await storage.getUser(req.consultantId) : null;
    const client = ctx.dbUser;
    if (consultant) {
      try {
        await bot?.telegram.sendMessage(consultant.telegramId,
          `Клиент ${client?.fullName || ""} предлагает другое время для консультации "${req.topic}": ${text}\n\nВы можете принять это время или предложить своё.`,
          Markup.inlineKeyboard([
            [Markup.button.callback("Принять это время", `accept_client_time_${reqId}`)],
            [Markup.button.callback("Предложить своё время", `propose_time_${reqId}`)],
            [Markup.button.callback("Вернуть запрос", `return_request_${reqId}`)],
          ]) as any
        );
      } catch (e) {}
    }
    return;
  }
}
