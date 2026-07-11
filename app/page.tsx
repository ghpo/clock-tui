import ClockApp from '@/components/ClockApp';

export default async function Page(props: {
  searchParams: Promise<{ mode?: string; color?: string; size?: string }>;
}) {
  const params = await props.searchParams;
  return <ClockApp mode={params.mode || 'clock'} color={params.color} size={params.size} />;
}
