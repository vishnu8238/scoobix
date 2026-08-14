import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Sparkles, Loader2, Plus, Megaphone, Send, Clock, Trash2 } from "lucide-react";
import { fetchStories, createStory, updateStory, type Story } from "@/lib/cms-api";
import { useTableVersion } from "@/lib/realtime-hooks";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { toast } from "sonner";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import type { ImageRef } from "@/lib/image-service";

export const Route = createFileRoute("/logistics/cms")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · CMS Studio" }] }),
  component: LogisticsCms,
});

function LogisticsCms() {
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<Story["target_audience"]>("riders");
  const [image, setImage] = useState<ImageRef | null>(null);
  const [saving, setSaving] = useState(false);

  const version = useTableVersion(["cms_stories"]);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchStories();
    setStories(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load, version]);

  const handlePublish = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    const ok = await createStory({
      title,
      content,
      target_audience: audience,
      image_url: image?.image_url,
      status: "published",
      published_at: new Date().toISOString(),
    });
    setSaving(false);
    if (ok) {
      toast.success("Story published to fleet");
      setComposing(false);
      setTitle("");
      setContent("");
      setImage(null);
      void load();
    }
  };

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
            <Sparkles className="h-6 w-6 text-primary" /> CMS Studio
          </h1>
          <p className="text-sm text-muted-foreground">Broadcast stories and updates to the fleet.</p>
        </div>
        {!composing && (
          <button 
            onClick={() => setComposing(true)}
            className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95"
          >
            <Plus className="h-4 w-4" /> New Story
          </button>
        )}
      </header>

      {composing && (
        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-extrabold">Compose Story</h2>
            <button onClick={() => setComposing(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
          
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Story Title"
                className="w-full rounded-2xl bg-muted/40 px-4 py-3 text-sm font-bold outline-none ring-1 ring-border/60 focus:ring-primary/40"
              />
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                placeholder="Story content..."
                className="w-full resize-none rounded-2xl bg-muted/40 px-4 py-3 text-sm outline-none ring-1 ring-border/60 focus:ring-primary/40"
              />
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">Audience:</span>
                {(["riders", "partners", "all"] as const).map(a => (
                  <button 
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition ${audience === a ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold text-muted-foreground">Story Cover Image</p>
              <ImageUploader type="banner" value={image} onChange={setImage} aspect="aspect-[16/9]" label="Add cover" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button 
              onClick={handlePublish}
              disabled={saving}
              className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish Story
            </button>
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <h2 className="mb-4 font-display text-lg font-extrabold flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-muted-foreground" /> Published Feed
        </h2>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <DataTable 
            columns={["Cover", "Title", "Audience", "Status", "Published", "Actions"]}
            rows={stories.map(s => [
              <div key={s.id+"img"} className="h-10 w-16 overflow-hidden rounded-lg bg-muted">
                {s.image_url ? <img src={s.image_url} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><Sparkles className="h-4 w-4 opacity-20" /></div>}
              </div>,
              <span key={s.id+"t"} className="font-bold">{s.title}</span>,
              <span key={s.id+"a"} className="text-[10px] font-bold uppercase text-muted-foreground">{s.target_audience}</span>,
              <StatusBadge key={s.id+"s"} label={s.status} />,
              <div key={s.id+"d"} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" /> {s.published_at ? new Date(s.published_at).toLocaleDateString() : "Draft"}
              </div>,
              <button key={s.id+"del"} className="p-1.5 rounded-full text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ])}
          />
        )}
      </section>
    </div>
  );
}
