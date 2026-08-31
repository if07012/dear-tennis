import { AcceptInviteClient } from './AcceptInviteClient';

export const metadata = {
  title: 'Join Dear Tennis',
  // Invite URLs often get shared; allow indexing of the public landing but
  // keep the page itself out of search results to avoid leaking tokens.
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AcceptInviteClient token={token} />;
}
