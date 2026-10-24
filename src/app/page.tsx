import { redirect } from "next/navigation";
import { z } from "zod";
import { currentSession, repository } from "@/lib/auth/session";
import { ResearchDesk } from "@/components/research-desk";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ chat?: string }>;
}) {
  const session = await currentSession();
  if (!session) redirect("/sign-in");
  const { chat } = await searchParams;
  const repo = repository();
  const conversations = await repo.conversations(session.user_id);
  const selected =
    chat && z.string().uuid().safeParse(chat).success
      ? await repo.conversation(session.user_id, chat)
      : null;
  return (
    <ResearchDesk
      key={
        selected
          ? `${selected.id}:${selected.messages.length}:${selected.messages.at(-1)?.status}`
          : "new"
      }
      usage={selected ? await repo.usage(session.user_id, selected.id) : []}
      userId={session.user_id}
      conversations={conversations}
      selected={selected}
      missing={Boolean(chat && !selected)}
    />
  );
}
