import { AlertCircle, ArrowUpRight, Megaphone, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import type { Conversation } from "../../lib/types";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

export function AnnouncementsWidget() {
  const [announcements, setAnnouncements] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get<{ items: Conversation[] }>("/messages/announcements")
      .then((res) => {
        if (mounted && Array.isArray(res?.items)) {
          setAnnouncements(res.items);
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

  if (loading || announcements.length === 0) return null;

  return (
    <div className="mb-4 space-y-3">
      {announcements.slice(0, 2).map((item) => {
        const isUrgent = item.priority === "urgent";
        const isImportant = item.priority === "important";

        return (
          <Card
            key={item.id}
            className={`border-l-4 overflow-hidden transition-all shadow-xs ${
              isUrgent
                ? "border-l-rose-500 bg-rose-50/20"
                : isImportant
                ? "border-l-amber-500 bg-amber-50/20"
                : "border-l-brand-600 bg-brand-50/15"
            }`}
          >
            <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isUrgent
                      ? "bg-rose-100 text-rose-700"
                      : isImportant
                      ? "bg-amber-100 text-amber-700"
                      : "bg-brand-100 text-brand-700"
                  }`}
                >
                  {isUrgent ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : item.is_pinned ? (
                    <Pin className="h-5 w-5" />
                  ) : (
                    <Megaphone className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
                      {item.code}
                    </span>
                    {item.is_pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100/80 px-2 py-0.5 text-[10.5px] font-semibold text-brand-800">
                        <Pin className="h-3 w-3 fill-current" /> Pinned Announcement
                      </span>
                    )}
                    <Badge tone={isUrgent ? "red" : isImportant ? "amber" : "purple"}>
                      {item.priority.toUpperCase()}
                    </Badge>
                    <span className="text-[11px] text-ink-400">
                      {relativeTime(item.created_at)}
                    </span>
                  </div>

                  <h3 className="mt-1 text-[15px] font-bold text-ink-900 tracking-tight">
                    {item.subject}
                  </h3>

                  <p className="mt-1 text-[13px] text-ink-600 line-clamp-2 leading-relaxed">
                    {item.messages?.[0]?.content || item.last_message?.content || "No preview available."}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-ink-500">
                    <Avatar name={item.created_by?.name || "Admin"} size="xs" />
                    <span className="font-medium text-ink-700">
                      {item.created_by?.name}
                    </span>
                    <span>•</span>
                    <span className="capitalize text-ink-500">
                      {item.created_by?.designation || item.created_by?.role || "Management"}
                    </span>
                    {item.messages?.[0]?.attachment_name && (
                      <>
                        <span>•</span>
                        <span className="text-brand-600 font-medium truncate max-w-[200px]">
                          📎 {item.messages[0].attachment_name}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 md:self-center">
                <Link to={`/messages?id=${item.id}`}>
                  <Button
                    size="sm"
                    variant={isUrgent ? "primary" : "secondary"}
                    rightIcon={<ArrowUpRight className="h-3.5 w-3.5" />}
                  >
                    View Announcement
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
