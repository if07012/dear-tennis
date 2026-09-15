import { ApprovalClient } from './ApprovalClient';

export const metadata = {
  title: 'Persetujuan Pendaftaran — Dear Tennis',
  robots: { index: false, follow: false },
};

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <ApprovalClient token={token} />;
}
