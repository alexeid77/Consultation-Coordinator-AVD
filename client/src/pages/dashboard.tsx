import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  MessageSquare,
  CalendarCheck,
  Bot,
  Shield,
  UserCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface Stats {
  botRunning: boolean;
  settings: {
    registrationEnabled: boolean;
    consultationsEnabled: boolean;
  };
  users: {
    totalClients: number;
    activeClients: number;
    pendingClients: number;
    totalConsultants: number;
    activeConsultants: number;
    pendingConsultants: number;
    hasAdmin: boolean;
  };
  requests: {
    total: number;
    open: number;
    taken: number;
    timeProposed: number;
    scheduled: number;
    cancelled: number;
  };
  sessions: {
    total: number;
    scheduled: number;
    completed: number;
    disagreement: number;
    notHappened: number;
    cancelled: number;
  };
}

interface UserRecord {
  id: number;
  fullName: string;
  username: string | null;
  role: string;
  status: string;
  competencies: string | null;
  createdAt: string;
}

interface Request {
  id: number;
  clientId: number;
  topic: string;
  preferredTime: string | null;
  details: string | null;
  status: string;
  consultantId: number | null;
  createdAt: string;
}

interface Session {
  id: number;
  requestId: number;
  clientId: number;
  consultantId: number;
  scheduledAt: string;
  topic: string;
  status: string;
  clientConfirmed: boolean | null;
  consultantConfirmed: boolean | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    active: "default",
    pending: "secondary",
    rejected: "destructive",
    blocked: "destructive",
    open: "default",
    taken: "secondary",
    time_proposed: "outline",
    scheduled: "default",
    cancelled: "destructive",
    completed: "default",
    disagreement: "outline",
    not_happened: "destructive",
  };

  const labels: Record<string, string> = {
    active: "Активен",
    pending: "Ожидает",
    rejected: "Отклонён",
    blocked: "Заблокирован",
    open: "Открыт",
    taken: "В работе",
    time_proposed: "Время предложено",
    scheduled: "Запланирован",
    cancelled: "Отменён",
    completed: "Завершён",
    disagreement: "Расхождение",
    not_happened: "Не состоялась",
  };

  return (
    <Badge variant={variants[status] || "secondary"} data-testid={`badge-status-${status}`}>
      {labels[status] || status}
    </Badge>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: any;
  subtitle?: string;
}) {
  return (
    <Card data-testid={`stat-card-${title}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" data-testid={`stat-value-${title}`}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
    refetchInterval: 5000,
  });

  const { data: usersList } = useQuery<UserRecord[]>({
    queryKey: ["/api/users"],
    refetchInterval: 10000,
  });

  const { data: requestsList } = useQuery<Request[]>({
    queryKey: ["/api/requests"],
    refetchInterval: 10000,
  });

  const { data: sessionsList } = useQuery<Session[]>({
    queryKey: ["/api/sessions"],
    refetchInterval: 10000,
  });

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">ConsultBot Dashboard</h1>
          <p className="text-muted-foreground text-sm">Мониторинг системы консультационных сессий</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={stats?.botRunning ? "default" : "destructive"} data-testid="badge-bot-status">
            <Bot className="h-3 w-3 mr-1" />
            {stats?.botRunning ? "Бот запущен" : "Бот остановлен"}
          </Badge>
          <Badge variant={stats?.settings.registrationEnabled ? "default" : "secondary"} data-testid="badge-reg-status">
            <UserCheck className="h-3 w-3 mr-1" />
            {stats?.settings.registrationEnabled ? "Регистрация открыта" : "Регистрация закрыта"}
          </Badge>
          <Badge variant={stats?.settings.consultationsEnabled ? "default" : "secondary"} data-testid="badge-consult-status">
            <CalendarCheck className="h-3 w-3 mr-1" />
            {stats?.settings.consultationsEnabled ? "Запись открыта" : "Запись приостановлена"}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Клиенты"
          value={stats?.users.totalClients || 0}
          icon={Users}
          subtitle={`${stats?.users.activeClients || 0} активных, ${stats?.users.pendingClients || 0} ожидают`}
        />
        <StatCard
          title="Консультанты"
          value={stats?.users.totalConsultants || 0}
          icon={Shield}
          subtitle={`${stats?.users.activeConsultants || 0} активных, ${stats?.users.pendingConsultants || 0} ожидают`}
        />
        <StatCard
          title="Заявки"
          value={stats?.requests.total || 0}
          icon={MessageSquare}
          subtitle={`${stats?.requests.open || 0} открытых`}
        />
        <StatCard
          title="Консультации"
          value={stats?.sessions.total || 0}
          icon={CalendarCheck}
          subtitle={`${stats?.sessions.scheduled || 0} запланированных`}
        />
      </div>

      <Tabs defaultValue="users" data-testid="tabs-main">
        <TabsList>
          <TabsTrigger value="users" data-testid="tab-users">Пользователи</TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests">Заявки</TabsTrigger>
          <TabsTrigger value="sessions" data-testid="tab-sessions">Консультации</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Пользователи ({usersList?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!usersList || usersList.length === 0 ? (
                <p className="text-muted-foreground text-sm" data-testid="text-no-users">
                  Пользователи пока не зарегистрированы. Откройте бот в Telegram и отправьте /start
                </p>
              ) : (
                <div className="space-y-3">
                  {usersList.map((u) => (
                    <div key={u.id} className="flex items-center justify-between gap-2 p-3 rounded-md bg-muted/50" data-testid={`row-user-${u.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{u.fullName}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.username ? `@${u.username}` : "нет username"} | {u.role === "client" ? "Клиент" : u.role === "consultant" ? "Консультант" : u.role === "admin" ? "Админ" : u.role}
                          {u.competencies && ` | ${u.competencies}`}
                        </div>
                      </div>
                      <StatusBadge status={u.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Заявки на консультации ({requestsList?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!requestsList || requestsList.length === 0 ? (
                <p className="text-muted-foreground text-sm" data-testid="text-no-requests">Заявок пока нет</p>
              ) : (
                <div className="space-y-3">
                  {requestsList.map((r) => (
                    <div key={r.id} className="p-3 rounded-md bg-muted/50 space-y-1" data-testid={`row-request-${r.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">#{r.id}: {r.topic}</div>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Клиент ID: {r.clientId}
                        {r.consultantId && ` | Консультант ID: ${r.consultantId}`}
                        {r.preferredTime && ` | Время: ${r.preferredTime}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Консультационные сессии ({sessionsList?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              {!sessionsList || sessionsList.length === 0 ? (
                <p className="text-muted-foreground text-sm" data-testid="text-no-sessions">Сессий пока нет</p>
              ) : (
                <div className="space-y-3">
                  {sessionsList.map((s) => (
                    <div key={s.id} className="p-3 rounded-md bg-muted/50 space-y-1" data-testid={`row-session-${s.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium text-sm">#{s.id}: {s.topic}</div>
                        <StatusBadge status={s.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Время: {s.scheduledAt} | Клиент ID: {s.clientId} | Консультант ID: {s.consultantId}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="flex items-center gap-1">
                          {s.clientConfirmed === null ? (
                            <><Clock className="h-3 w-3" /> Клиент: ожидание</>
                          ) : s.clientConfirmed ? (
                            <><CheckCircle className="h-3 w-3 text-green-600" /> Клиент: да</>
                          ) : (
                            <><XCircle className="h-3 w-3 text-red-600" /> Клиент: нет</>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          {s.consultantConfirmed === null ? (
                            <><Clock className="h-3 w-3" /> Консультант: ожидание</>
                          ) : s.consultantConfirmed ? (
                            <><CheckCircle className="h-3 w-3 text-green-600" /> Консультант: да</>
                          ) : (
                            <><XCircle className="h-3 w-3 text-red-600" /> Консультант: нет</>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Статистика заявок
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className="text-xl font-bold" data-testid="stat-open-requests">{stats?.requests.open || 0}</div>
              <div className="text-xs text-muted-foreground">Открытые</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className="text-xl font-bold" data-testid="stat-taken-requests">{stats?.requests.taken || 0}</div>
              <div className="text-xs text-muted-foreground">В работе</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className="text-xl font-bold" data-testid="stat-proposed-requests">{stats?.requests.timeProposed || 0}</div>
              <div className="text-xs text-muted-foreground">Время предложено</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className="text-xl font-bold" data-testid="stat-scheduled-requests">{stats?.requests.scheduled || 0}</div>
              <div className="text-xs text-muted-foreground">Запланированы</div>
            </div>
            <div className="text-center p-3 rounded-md bg-muted/50">
              <div className="text-xl font-bold" data-testid="stat-cancelled-requests">{stats?.requests.cancelled || 0}</div>
              <div className="text-xs text-muted-foreground">Отменены</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
