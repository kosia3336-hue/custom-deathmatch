import RoomLayout from '@/classic-era/app/room/[roomId]/layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <RoomLayout>{children}</RoomLayout>;
}
