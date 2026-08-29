import ChatRoom from "@/components/ChatRoom";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <ChatRoom code={code} />;
}
