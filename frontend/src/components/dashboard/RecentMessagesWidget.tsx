import { ArrowUpRight, MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import type { Conversation, UnreadMessageCount } from "../../lib/types";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";

export function RecentMessagesWidget() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unread, setUnread] = useState<UnreadMessageCount | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get<{ items: Conversation[] }>("/messages/conversations", { folder: "all", limit: 5 }),
      api.get<UnreadMessageCount>("/messages/unread-count"),
    ])
      .then(([convRes, unreadRes]) => {
        if (mounted) {
          if (Array.isArray(convRes?.items)) setConversations(convRes.items);
          if (unreadRes) setUnread(unreadRes);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            <span>Staff Messages & Updates</span>
            {unread && unread.total_unread > 0 ? (
              <span className="inline-flex items-center rounded-full bg-brand-600 px-2 py-0.5 text-[10.5px] font-bold text-white shadow-xs">
                {unread.total_unread} unread
              </span>
            ) : null}
          </div>
        }
        subtitle="Internal two-way communication"
        action={
          <Link
            to="/messages"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
          >
            All messages
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        }
      />

      <div className="flex-1 divide-y divide-line overflow-y-auto max-h-[360px]">
        {loading ? (
          <div className="p-6 text-center text-xs text-ink-400">Loading messages…</div>
        ) : conversations.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No messages yet"
            description="Start a new conversation or send an announcement."
            action={
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Send className="h-3.5 w-3.5" />}
                onClick={() => navigate("/messages?compose=true")}
              >
                Send message
              </Button>
            }
          />
        ) : (
          conversations.map((conv) => {
            const hasUnread = (conv.unread_count ?? 0) > 0;
            const isUrgent = conv.priority === "urgent";

            return (
              <Link
                key={conv.id}
                to={`/messages?id=${conv.id}`}
                className={`flex items-start gap-3 px-5 py-3 transition-colors hover:bg-brand-50/20 ${
                  hasUnread ? "bg-[#fbf9fe]" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar name={conv.created_by?.name || "User"} size="sm" />
                  {hasUnread && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[12.5px] ${hasUnread ? "font-bold text-ink-900" : "font-medium text-ink-800"}`}>
                      {conv.subject}
                    </p>
                    <span className="shrink-0 text-[10.5px] text-ink-400">
                      {relativeTime(conv.updated_at || conv.created_at)}
                    </span>
                  </div>

                  <p className="mt-0.5 truncate text-[11.5px] text-ink-500">
                    {conv.last_message?.content || "No messages yet"}
                  </p>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10.5px] font-medium text-ink-400">
                      {conv.created_by?.name}
                    </span>
                    {conv.is_announcement ? (
                      <Badge tone="purple">Announcement</Badge>
                    ) : (
                      <span className="rounded bg-ink-100 px-1.5 py-0.2 text-[9.5px] font-medium capitalize text-ink-600">
                        {conv.category.replace(/_/g, " ")}
                      </span>
                    )}
                    {isUrgent && <Badge tone="red">Urgent</Badge>}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <div className="border-t border-line bg-[#fcfbfe] p-3 text-right">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Send className="h-3.5 w-3.5" />}
          onClick={() => navigate("/messages?compose=true")}
          className="w-full justify-center"
        >
          Compose Message
        </Button>
      </div>
    </Card>
  );
}
