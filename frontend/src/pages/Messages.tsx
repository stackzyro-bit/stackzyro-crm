import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Check,
  CheckCheck,
  Download,
  Filter,
  Inbox,
  Megaphone,
  MessageSquare,
  Paperclip,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { api } from "../lib/api";
import { formatDate, formatTime, relativeTime } from "../lib/format";
import type {
  Conversation,
  Message,
  MessagePriority,
  UnreadMessageCount,
  User,
} from "../lib/types";
import { Avatar } from "../components/ui/Avatar";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";

type FolderType = "inbox" | "announcements" | "sent" | "urgent" | "unread" | "archived" | "all";

export default function Messages() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const addToast = ({
    title,
    description,
    tone = "success",
  }: {
    title: string;
    description?: string;
    tone?: "success" | "error" | "info";
  }) => {
    if (tone === "error") toast.error(title, description);
    else if (tone === "info") toast.info(title, description);
    else toast.success(title, description);
  };

  // Navigation & filtering state
  const [activeFolder, setActiveFolder] = useState<FolderType>("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Data state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [unreadCounts, setUnreadCounts] = useState<UnreadMessageCount>({
    total_unread: 0,
    unread_messages: 0,
    unread_announcements: 0,
    urgent_unread: 0,
  });
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyAttachment, setReplyAttachment] = useState<{
    url: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [replyUploading, setReplyUploading] = useState(false);

  // Compose modal state
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubmitting, setComposeSubmitting] = useState(false);

  // Mobile navigation
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === "admin";

  // Check URL params on initial load
  useEffect(() => {
    if (searchParams.get("compose") === "true") {
      setComposeOpen(true);
      searchParams.delete("compose");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Load unread counts
  const loadUnreadCounts = async () => {
    try {
      const data = await api.get<UnreadMessageCount>("/messages/unread-count");
      if (data) setUnreadCounts(data);
    } catch {
      // quiet
    }
  };

  // Load conversation list
  const loadConversations = async (preserveSelectedId?: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { folder: activeFolder };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;

      const res = await api.get<{ items: Conversation[]; total: number }>(
        "/messages/conversations",
        params
      );
      const items = res.items || [];
      setConversations(items);

      // Select conversation
      const requestedId =
        preserveSelectedId ??
        (searchParams.get("id") ? parseInt(searchParams.get("id")!, 10) : null);

      if (requestedId) {
        const found = items.find((c) => c.id === requestedId);
        if (found) {
          loadThread(requestedId);
        } else {
          // If not in current folder, fetch directly
          loadThread(requestedId);
        }
      } else if (items.length > 0 && !selectedConversation && window.innerWidth >= 1024) {
        loadThread(items[0].id);
      }
    } catch (err: any) {
      addToast({
        title: "Could not load messages",
        description: err.message || "Failed to load conversation list",
        tone: "error",
      });
    } finally {
      setLoading(false);
      loadUnreadCounts();
    }
  };

  // Load individual thread
  const loadThread = async (id: number) => {
    setThreadLoading(true);
    try {
      const conv = await api.get<Conversation>(`/messages/conversations/${id}`);
      setSelectedConversation(conv);
      setMobileThreadOpen(true);

      // Update URL param
      searchParams.set("id", id.toString());
      setSearchParams(searchParams, { replace: true });

      // Update unread count locally for this item
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c))
      );
      loadUnreadCounts();
    } catch (err: any) {
      addToast({
        title: "Could not open conversation",
        description: err.message || "Failed to load message thread",
        tone: "error",
      });
    } finally {
      setThreadLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [activeFolder, priorityFilter, categoryFilter]);

  // Scroll to bottom of message thread
  useEffect(() => {
    if (selectedConversation) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedConversation?.messages]);

  // Handle reply submit
  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedConversation) return;
    if (!replyText.trim() && !replyAttachment) return;

    setReplySending(true);
    try {
      const updated = await api.post<Conversation>(
        `/messages/conversations/${selectedConversation.id}/reply`,
        {
          content: replyText.trim() || (replyAttachment ? `[Attachment: ${replyAttachment.name}]` : ""),
          attachment_url: replyAttachment?.url || null,
          attachment_name: replyAttachment?.name || null,
          attachment_size: replyAttachment?.size || null,
          attachment_type: replyAttachment?.type || null,
        }
      );

      setSelectedConversation(updated);
      setReplyText("");
      setReplyAttachment(null);

      // Update item in list
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, updated_at: updated.updated_at } : c))
      );

      addToast({
        title: "Reply sent",
        description: "Your message has been delivered.",
        tone: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Could not send reply",
        description: err.message || "Failed to deliver message",
        tone: "error",
      });
    } finally {
      setReplySending(false);
    }
  };

  // Handle attachment file upload
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast({
        title: "File too large",
        description: "Attachments must be under 10MB.",
        tone: "error",
      });
      return;
    }

    setReplyUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Direct upload through api
      const res = await api.upload<{
        url: string;
        name: string;
        size: number;
        type: string;
      }>("/messages/upload", formData);

      setReplyAttachment(res);
      addToast({
        title: "File attached",
        description: `${file.name} is ready to send.`,
        tone: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Upload failed",
        description: err.message || "Could not upload attachment",
        tone: "error",
      });
    } finally {
      setReplyUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Pin / Unpin toggle (Admin only)
  const handleTogglePin = async () => {
    if (!selectedConversation || !isAdmin) return;
    const newPinned = !selectedConversation.is_pinned;
    try {
      const updated = await api.patch<Conversation>(
        `/messages/conversations/${selectedConversation.id}`,
        { is_pinned: newPinned }
      );
      setSelectedConversation(updated);
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? { ...c, is_pinned: newPinned } : c))
      );
      addToast({
        title: newPinned ? "Announcement pinned" : "Announcement unpinned",
        description: newPinned
          ? "This notice will stay featured on staff dashboards."
          : "Notice removed from pinned section.",
        tone: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Action failed",
        description: err.message || "Could not update pin state",
        tone: "error",
      });
    }
  };

  // Archive toggle
  const handleToggleArchive = async () => {
    if (!selectedConversation) return;
    const isCurrentlyArchived = selectedConversation.status === "archived";
    try {
      const updated = await api.patch<Conversation>(
        `/messages/conversations/${selectedConversation.id}`,
        { is_archived: !isCurrentlyArchived }
      );
      setSelectedConversation(updated);
      loadConversations();
      addToast({
        title: !isCurrentlyArchived ? "Conversation archived" : "Conversation unarchived",
        description: !isCurrentlyArchived
          ? "Moved to your archive folder."
          : "Restored to active inbox.",
        tone: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Action failed",
        description: err.message || "Could not update archive state",
        tone: "error",
      });
    }
  };

  // Delete conversation (Admin only)
  const handleDeleteConversation = async () => {
    if (!selectedConversation || !isAdmin) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete "${selectedConversation.subject}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(`/messages/conversations/${selectedConversation.id}`);
      addToast({
        title: "Conversation deleted",
        description: "The thread and all replies have been removed.",
        tone: "success",
      });
      setSelectedConversation(null);
      setMobileThreadOpen(false);
      searchParams.delete("id");
      setSearchParams(searchParams, { replace: true });
      loadConversations();
    } catch (err: any) {
      addToast({
        title: "Delete failed",
        description: err.message || "Could not delete conversation",
        tone: "error",
      });
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Top Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-ink-900 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-brand-600" />
            Messages & Communication
          </h1>
          <p className="mt-0.5 text-[12px] text-ink-500">
            {isAdmin
              ? "Publish announcements, assign directives, and reply to staff queries."
              : "Direct line to management, team updates, and company announcements."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={() => {
              loadConversations(selectedConversation?.id);
              loadUnreadCounts();
            }}
            title="Refresh inbox"
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setComposeOpen(true)}
          >
            {isAdmin ? "New Announcement / Message" : "Message Admin"}
          </Button>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className="flex-1 min-h-0 rounded-xl border border-line bg-white shadow-xs flex overflow-hidden">
        {/* Left Sidebar: Folders */}
        <div className="w-56 shrink-0 border-r border-line bg-[#fbfafc] p-3 flex flex-col justify-between hidden md:flex">
          <div className="space-y-1">
            <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
              Mailbox
            </p>

            <button
              type="button"
              onClick={() => setActiveFolder("inbox")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                activeFolder === "inbox"
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-ink-700 hover:bg-ink-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Inbox className="h-4 w-4 text-brand-600" />
                <span>Inbox</span>
              </div>
              {unreadCounts.unread_messages > 0 && (
                <span className="rounded-full bg-brand-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {unreadCounts.unread_messages}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFolder("announcements")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                activeFolder === "announcements"
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-ink-700 hover:bg-ink-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Megaphone className="h-4 w-4 text-purple-600" />
                <span>Announcements</span>
              </div>
              {unreadCounts.unread_announcements > 0 && (
                <span className="rounded-full bg-purple-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {unreadCounts.unread_announcements}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFolder("urgent")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                activeFolder === "urgent"
                  ? "bg-rose-50 text-rose-700 font-semibold"
                  : "text-ink-700 hover:bg-ink-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <span>Urgent</span>
              </div>
              {unreadCounts.urgent_unread > 0 && (
                <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                  {unreadCounts.urgent_unread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveFolder("sent")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                activeFolder === "sent"
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-ink-700 hover:bg-ink-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Send className="h-4 w-4 text-indigo-600" />
                <span>Sent</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFolder("archived")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                activeFolder === "archived"
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-ink-700 hover:bg-ink-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Archive className="h-4 w-4 text-ink-500" />
                <span>Archived</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setActiveFolder("all")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors ${
                activeFolder === "all"
                  ? "bg-brand-50 text-brand-700 font-semibold"
                  : "text-ink-700 hover:bg-ink-100/60"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className="h-4 w-4 text-ink-500" />
                <span>All Messages</span>
              </div>
            </button>
          </div>

          {/* Quick Notice Badge */}
          <div className="rounded-lg border border-line bg-white p-3 text-[11px] text-ink-500">
            <p className="font-semibold text-ink-800">Direct Staff Line</p>
            <p className="mt-0.5 text-[10px]">
              {isAdmin
                ? "Broadcast company notices or address individual staff queries."
                : "Messages are sent directly to management."}
            </p>
          </div>
        </div>

        {/* Middle Pane: Thread List */}
        <div
          className={`w-full lg:w-80 xl:w-96 shrink-0 border-r border-line flex flex-col ${
            mobileThreadOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-line space-y-2 bg-white">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadConversations()}
                placeholder="Search subject, content, code…"
                className="w-full rounded-lg border border-line bg-canvas/40 pl-8 pr-3 py-1.5 text-[12px] text-ink-800 placeholder:text-ink-400 focus:border-brand-500 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="flex-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink-700"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="important">Important</option>
                <option value="normal">Normal</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-ink-700"
              >
                <option value="all">All Categories</option>
                <option value="announcement">Announcement</option>
                <option value="work_instruction">Work Instruction</option>
                <option value="meeting_notice">Meeting Notice</option>
                <option value="task_assignment">Task Assignment</option>
                <option value="urgent_notice">Urgent Notice</option>
                <option value="query">General Query</option>
                <option value="work_update">Work Update</option>
                <option value="leave_request">Leave Request</option>
              </select>
            </div>
          </div>

          {/* List of Conversations */}
          <div className="flex-1 overflow-y-auto divide-y divide-line">
            {loading ? (
              <div className="p-8 text-center text-xs text-ink-400">Loading conversations…</div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="mx-auto h-8 w-8 text-ink-300" />
                <p className="mt-2 text-xs font-semibold text-ink-700">No conversations found</p>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  {searchQuery ? "Try a different search query" : "Your mailbox is clear"}
                </p>
              </div>
            ) : (
              conversations.map((item) => {
                const isSelected = selectedConversation?.id === item.id;
                const hasUnread = (item.unread_count ?? 0) > 0;
                const isUrgent = item.priority === "urgent";
                const isImportant = item.priority === "important";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadThread(item.id)}
                    className={`w-full text-left p-3.5 transition-colors relative flex items-start gap-3 ${
                      isSelected
                        ? "bg-brand-50/50 border-l-3 border-l-brand-600"
                        : hasUnread
                        ? "bg-[#faf8fd] hover:bg-brand-50/20"
                        : "hover:bg-canvas/50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar name={item.created_by?.name || "User"} size="sm" />
                      {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-white" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate text-[12px] font-semibold text-ink-800">
                          {item.created_by?.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-ink-400">
                          {relativeTime(item.updated_at || item.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.is_pinned && <Pin className="h-3 w-3 text-brand-600 fill-current shrink-0" />}
                        <p
                          className={`truncate text-[12.5px] ${
                            hasUnread ? "font-bold text-ink-900" : "font-medium text-ink-800"
                          }`}
                        >
                          {item.subject}
                        </p>
                      </div>

                      <p className="mt-1 truncate text-[11.5px] text-ink-500">
                        {item.last_message?.content || "No message content"}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-ink-400">
                          {item.code}
                        </span>
                        {item.is_announcement ? (
                          <Badge tone="purple">Announcement</Badge>
                        ) : (
                          <span className="rounded bg-ink-100 px-1.5 py-0.2 text-[9.5px] font-medium capitalize text-ink-600">
                            {item.category.replace(/_/g, " ")}
                          </span>
                        )}
                        {isUrgent && <Badge tone="red">Urgent</Badge>}
                        {isImportant && <Badge tone="amber">Important</Badge>}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Thread Detail & Reply Composer */}
        <div
          className={`flex-1 flex flex-col bg-[#fcfbfe] ${
            !mobileThreadOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          {threadLoading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-ink-400">
              Loading conversation…
            </div>
          ) : !selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3">
                <MessageSquare className="h-7 w-7" />
              </div>
              <h2 className="text-base font-bold text-ink-900">Select a conversation</h2>
              <p className="mt-1 text-xs text-ink-500 max-w-sm">
                Choose a conversation or announcement from the list to view the full thread, or start a new message.
              </p>
              <Button
                size="sm"
                variant="primary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setComposeOpen(true)}
                className="mt-4"
              >
                Compose Message
              </Button>
            </div>
          ) : (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-line bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setMobileThreadOpen(false)}
                    className="p-1 rounded-lg text-ink-400 hover:bg-canvas lg:hidden"
                    title="Back to list"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-400">
                        {selectedConversation.code}
                      </span>
                      {selectedConversation.is_pinned && (
                        <span className="inline-flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800">
                          <Pin className="h-3 w-3 fill-current" /> Pinned
                        </span>
                      )}
                      <Badge
                        tone={
                          selectedConversation.priority === "urgent"
                            ? "red"
                            : selectedConversation.priority === "important"
                            ? "amber"
                            : "purple"
                        }
                      >
                        {selectedConversation.priority.toUpperCase()}
                      </Badge>
                      <span className="rounded bg-ink-100 px-2 py-0.5 text-[10.5px] font-medium capitalize text-ink-700">
                        {selectedConversation.category.replace(/_/g, " ")}
                      </span>
                    </div>

                    <h2 className="mt-1 text-base font-bold text-ink-900 truncate">
                      {selectedConversation.subject}
                    </h2>

                    <p className="text-[11px] text-ink-500 flex items-center gap-1.5 mt-0.5">
                      <span>Started by</span>
                      <strong className="text-ink-700 font-semibold">
                        {selectedConversation.created_by?.name}
                      </strong>
                      <span>({selectedConversation.created_by?.role})</span>
                      <span>•</span>
                      <span>{formatDate(selectedConversation.created_at)}</span>
                    </p>
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div className="flex items-center gap-1.5">
                  {isAdmin && selectedConversation.is_announcement && (
                    <Button
                      size="sm"
                      variant={selectedConversation.is_pinned ? "secondary" : "outline"}
                      leftIcon={<Pin className="h-3.5 w-3.5" />}
                      onClick={handleTogglePin}
                      title={selectedConversation.is_pinned ? "Unpin notice" : "Pin to top of dashboards"}
                    >
                      {selectedConversation.is_pinned ? "Pinned" : "Pin"}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Archive className="h-3.5 w-3.5" />}
                    onClick={handleToggleArchive}
                    title="Archive this conversation"
                  >
                    {selectedConversation.status === "archived" ? "Unarchive" : "Archive"}
                  </Button>

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="danger"
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                      onClick={handleDeleteConversation}
                      title="Permanently delete conversation"
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {selectedConversation.messages?.map((msg, index) => {
                  const isMine = msg.sender_id === user?.id;

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex gap-3 max-w-2xl ${isMine ? "ml-auto flex-row-reverse" : "mr-auto"}`}
                    >
                      <Avatar name={msg.sender?.name || "User"} size="sm" className="mt-1" />

                      <div className={`space-y-1 min-w-0 ${isMine ? "items-end" : "items-start"}`}>
                        <div
                          className={`flex items-center gap-2 text-[10.5px] ${
                            isMine ? "justify-end text-ink-400" : "text-ink-500"
                          }`}
                        >
                          <span className="font-semibold text-ink-800">{msg.sender?.name}</span>
                          <span className="capitalize text-ink-400">
                            ({msg.sender?.designation || msg.sender?.role})
                          </span>
                          <span>•</span>
                          <span>{formatTime(msg.created_at)}</span>
                        </div>

                        {/* Message Bubble */}
                        <div
                          className={`rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-xs ${
                            isMine
                              ? "bg-brand-600 text-white rounded-tr-xs"
                              : "bg-white border border-line text-ink-900 rounded-tl-xs"
                          }`}
                        >
                          <p className="whitespace-pre-wrap select-text">{msg.content}</p>

                          {/* Attachment Box */}
                          {msg.attachment_url && (
                            <div
                              className={`mt-2.5 rounded-xl p-2.5 flex items-center justify-between gap-3 border ${
                                isMine
                                  ? "bg-white/10 border-white/20 text-white"
                                  : "bg-canvas border-line text-ink-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Paperclip className="h-4 w-4 shrink-0" />
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold">
                                    {msg.attachment_name || "Attachment"}
                                  </p>
                                  {msg.attachment_size && (
                                    <p
                                      className={`text-[10px] ${
                                        isMine ? "text-white/75" : "text-ink-400"
                                      }`}
                                    >
                                      {(msg.attachment_size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                              </div>

                              <a
                                href={msg.attachment_url}
                                download={msg.attachment_name || "attachment"}
                                target="_blank"
                                rel="noreferrer"
                                className={`p-1.5 rounded-lg transition-colors ${
                                  isMine
                                    ? "hover:bg-white/20 text-white"
                                    : "hover:bg-ink-100 text-brand-600"
                                }`}
                                title="Download attachment"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Read Receipt */}
                        {isMine && msg.receipts && msg.receipts.length > 0 && (
                          <div className="flex items-center justify-end gap-1 text-[10px] text-ink-400 mt-0.5">
                            {msg.receipts.some((r) => r.is_read) ? (
                              <>
                                <CheckCheck className="h-3 w-3 text-brand-600" />
                                <span>
                                  Read by{" "}
                                  {msg.receipts
                                    .filter((r) => r.is_read)
                                    .map((r) => r.user?.name || "recipient")
                                    .slice(0, 2)
                                    .join(", ")}
                                </span>
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3 text-ink-400" />
                                <span>Delivered</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Box */}
              <div className="p-3 sm:p-4 border-t border-line bg-white shrink-0">
                {replyAttachment && (
                  <div className="mb-2 flex items-center justify-between rounded-lg bg-brand-50 border border-brand-200 px-3 py-1.5 text-xs text-brand-800">
                    <span className="flex items-center gap-1.5 truncate">
                      <Paperclip className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                      <strong className="truncate">{replyAttachment.name}</strong> (
                      {(replyAttachment.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setReplyAttachment(null)}
                      className="p-1 rounded text-brand-600 hover:text-brand-900"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendReply} className="flex items-end gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleAttachmentUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={replyUploading || replySending}
                    className="p-2 rounded-lg border border-line text-ink-500 hover:bg-canvas hover:text-ink-800 disabled:opacity-50 transition-colors"
                    title="Attach file (PDF, image, document up to 10MB)"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      placeholder={`Reply as ${user?.name}… (Press Enter to send, Shift+Enter for new line)`}
                      rows={1}
                      className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-hidden"
                      style={{ minHeight: "40px", maxHeight: "120px" }}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={replySending || replyUploading}
                    leftIcon={<Send className="h-3.5 w-3.5" />}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compose Message Modal */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={(newConv) => {
          setComposeOpen(false);
          loadConversations(newConv.id);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------------------------------------
// Compose New Message / Announcement Modal
// ------------------------------------------------------------------------------------------------
function ComposeModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (conv: Conversation) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const addToast = ({
    title,
    description,
    tone = "success",
  }: {
    title: string;
    description?: string;
    tone?: "success" | "error" | "info";
  }) => {
    if (tone === "error") toast.error(title, description);
    else if (tone === "info") toast.info(title, description);
    else toast.success(title, description);
  };
  const isAdmin = user?.role === "admin";

  const [recipients, setRecipients] = useState<User[]>([]);
  const [targetAudience, setTargetAudience] = useState<"all_staff" | "selected_staff" | "role" | "direct">(
    isAdmin ? "all_staff" : "direct"
  );
  const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
  const [targetRole, setTargetRole] = useState("telecaller");

  const [category, setCategory] = useState<string>(
    isAdmin ? "general_announcement" : "general_query"
  );
  const [priority, setPriority] = useState<MessagePriority>("normal");
  const [isAnnouncement, setIsAnnouncement] = useState<boolean>(isAdmin);
  const [isPinned, setIsPinned] = useState(false);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const [attachment, setAttachment] = useState<{
    url: string;
    name: string;
    size: number;
    type: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const modalFileInputRef = useRef<HTMLInputElement>(null);

  // Load eligible recipients
  useEffect(() => {
    if (open) {
      api.get<User[]>("/messages/recipients").then((data) => {
        if (Array.isArray(data)) setRecipients(data);
      });
      // Reset form
      setSubject("");
      setContent("");
      setAttachment(null);
      setIsPinned(false);
      if (!isAdmin) {
        setTargetAudience("direct");
        setIsAnnouncement(false);
        setCategory("general_query");
      } else {
        setTargetAudience("all_staff");
        setIsAnnouncement(true);
        setCategory("general_announcement");
      }
    }
  }, [open, isAdmin]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      addToast({
        title: "File too large",
        description: "Attachments must be under 10MB.",
        tone: "error",
      });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<{
        url: string;
        name: string;
        size: number;
        type: string;
      }>("/messages/upload", formData);

      setAttachment(res);
      addToast({
        title: "File attached",
        description: `${file.name} is ready.`,
        tone: "success",
      });
    } catch (err: any) {
      addToast({
        title: "Upload failed",
        description: err.message || "Could not upload file",
        tone: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      addToast({ title: "Subject required", description: "Please enter a message subject.", tone: "error" });
      return;
    }
    if (!content.trim()) {
      addToast({ title: "Message required", description: "Please enter your message content.", tone: "error" });
      return;
    }
    if (isAdmin && targetAudience === "selected_staff" && selectedStaffIds.length === 0) {
      addToast({ title: "Recipient required", description: "Please select at least one staff member.", tone: "error" });
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        subject: subject.trim(),
        content: content.trim(),
        category,
        priority,
        is_announcement: isAdmin ? isAnnouncement : false,
        is_pinned: isAdmin ? isPinned : false,
        target_audience: isAdmin ? targetAudience : "direct",
        target_role: isAdmin && targetAudience === "role" ? targetRole : null,
        recipient_ids:
          targetAudience === "selected_staff" || targetAudience === "direct"
            ? selectedStaffIds
            : [],
        attachment_url: attachment?.url || null,
        attachment_name: attachment?.name || null,
        attachment_size: attachment?.size || null,
        attachment_type: attachment?.type || null,
      };

      const res = await api.post<Conversation>("/messages/conversations", payload);
      addToast({
        title: isAnnouncement ? "Announcement published" : "Message sent",
        description: "Your message has been delivered to recipients.",
        tone: "success",
      });
      onCreated(res);
    } catch (err: any) {
      addToast({
        title: "Could not send message",
        description: err.message || "Failed to create conversation",
        tone: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdmin ? "Create Announcement or Staff Directive" : "Compose Message to Admin"}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {isAdmin && (
          <div className="rounded-xl border border-line bg-[#fcfbfe] p-3.5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700">
              Distribution & Audience
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "all_staff", label: "All Staff Members" },
                { id: "role", label: "By Department / Role" },
                { id: "selected_staff", label: "Specific Staff Members" },
                { id: "direct", label: "Direct Message" },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setTargetAudience(opt.id as any);
                    if (opt.id === "all_staff" || opt.id === "role") {
                      setIsAnnouncement(true);
                    }
                  }}
                  className={`p-2 rounded-lg border text-left text-[11.5px] font-medium transition-all ${
                    targetAudience === opt.id
                      ? "border-brand-500 bg-brand-50 text-brand-800 shadow-xs"
                      : "border-line bg-white text-ink-700 hover:bg-canvas"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {targetAudience === "role" && (
              <Field label="Select target department / role">
                <Select
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                >
                  <option value="telecaller">Telecaller</option>
                  <option value="sales_executive">Sales Executive</option>
                  <option value="office_assistant">Office Assistant</option>
                  <option value="manager">Manager</option>
                  <option value="staff">All Staff Roles</option>
                </Select>
              </Field>
            )}

            {(targetAudience === "selected_staff" || targetAudience === "direct") && (
              <Field label="Select recipient employee(s)">
                <div className="max-h-36 overflow-y-auto rounded-lg border border-line bg-white p-2 divide-y divide-line">
                  {recipients.map((emp) => {
                    const checked = selectedStaffIds.includes(emp.id);
                    return (
                      <label
                        key={emp.id}
                        className="flex items-center gap-2.5 py-1.5 px-2 hover:bg-canvas rounded cursor-pointer"
                      >
                        <input
                          type={targetAudience === "direct" ? "radio" : "checkbox"}
                          name="staff_recipient"
                          checked={checked}
                          onChange={(e) => {
                            if (targetAudience === "direct") {
                              setSelectedStaffIds([emp.id]);
                            } else {
                              if (e.target.checked) {
                                setSelectedStaffIds((prev) => [...prev, emp.id]);
                              } else {
                                setSelectedStaffIds((prev) =>
                                  prev.filter((id) => id !== emp.id)
                                );
                              }
                            }
                          }}
                          className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
                        />
                        <Avatar name={emp.name} size="xs" />
                        <span className="text-[12px] font-medium text-ink-900">
                          {emp.name}
                        </span>
                        <span className="text-[10.5px] text-ink-400 capitalize">
                          ({emp.designation || emp.role})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </Field>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-ink-800">
                <input
                  type="checkbox"
                  checked={isAnnouncement}
                  onChange={(e) => setIsAnnouncement(e.target.checked)}
                  className="rounded border-line text-brand-600"
                />
                Broadcast as Announcement
              </label>

              {isAnnouncement && (
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-brand-800">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    className="rounded border-line text-brand-600"
                  />
                  <Pin className="h-3.5 w-3.5" /> Pin notice on staff dashboards
                </label>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Message category" required>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {isAdmin ? (
                <>
                  <option value="general_announcement">General Announcement</option>
                  <option value="important_notice">Important Notice</option>
                  <option value="work_instructions">Work Instructions</option>
                  <option value="meeting_notice">Meeting Notice</option>
                  <option value="training_update">Training Update</option>
                  <option value="attendance_reminder">Attendance Reminder</option>
                  <option value="task_assignment">Task Assignment</option>
                  <option value="urgent_notice">Urgent Notice</option>
                </>
              ) : (
                <>
                  <option value="general_query">General Query</option>
                  <option value="work_update">Work Update</option>
                  <option value="client_issue">Client / Lead Issue</option>
                  <option value="tech_problem">Technical Problem</option>
                  <option value="attendance_correction">Attendance Correction Request</option>
                  <option value="leave_request">Leave or Permission Request</option>
                  <option value="other">Other</option>
                </>
              )}
            </Select>
          </Field>

          <Field label="Priority level" required>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as MessagePriority)}
            >
              <option value="normal">Normal Priority</option>
              <option value="important">Important Priority</option>
              <option value="urgent">Urgent Priority</option>
            </Select>
          </Field>
        </div>

        <Field label="Subject line" required>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Schedule update for tomorrow / Client follow-up query"
          />
        </Field>

        <Field label="Message content" required>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your complete message or directive here…"
            rows={5}
          />
        </Field>

        {/* Attachment upload */}
        <div>
          <input
            type="file"
            ref={modalFileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />

          {attachment ? (
            <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 p-2.5 text-xs text-brand-800">
              <span className="flex items-center gap-1.5 truncate">
                <Paperclip className="h-4 w-4 text-brand-600 shrink-0" />
                <strong className="truncate">{attachment.name}</strong> (
                {(attachment.size / 1024).toFixed(1)} KB)
              </span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="text-brand-600 hover:text-brand-900 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              leftIcon={<Paperclip className="h-3.5 w-3.5" />}
              loading={uploading}
              onClick={() => modalFileInputRef.current?.click()}
            >
              Attach Document or File (optional)
            </Button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting || uploading}
            leftIcon={<Send className="h-4 w-4" />}
          >
            {isAdmin && isAnnouncement ? "Publish Announcement" : "Send Message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
