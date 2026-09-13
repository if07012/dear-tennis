import { AdminAuthGate } from '../hero/AdminAuthGate';
import { GroqClient } from './GroqClient';
import { listGroqKeys, listGroqLogs } from '@/lib/groq-store';

export const metadata = {
  title: 'Admin · Groq Bot — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function AdminGroqPage() {
  const [keys, logs] = await Promise.all([listGroqKeys(), listGroqLogs({ pageSize: 10 })]);
  return (
    <AdminAuthGate>
      <GroqClient initialKeys={keys} initialLogs={logs} />
    </AdminAuthGate>
  );
}
