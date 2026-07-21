const INFOMANIAK_API_BASE_URL = 'https://api.infomaniak.com/1';

const toArray = (value) => {
  const data = value?.data ?? value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getResourceId = (resource) => resource?.id || resource?.hosting_id || resource?.mailbox_id;

const getMailboxEmail = (mailbox) => String(
  mailbox?.email || mailbox?.email_address || mailbox?.address || mailbox?.mailbox || ''
).trim().toLowerCase();

const infomaniakRequest = async (path, options = {}) => {
  const token = String(process.env.INFOMANIAK_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('Le jeton API Infomaniak n est pas configure.');
  }

  const response = await fetch(`${INFOMANIAK_API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.result === 'error') {
    const description = payload?.error?.description || payload?.error?.message || 'La requete Infomaniak a echoue.';
    const error = new Error(description);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
};

const findMailbox = async (email) => {
  const hostings = toArray(await infomaniakRequest('/mail/hosting'));

  for (const hosting of hostings) {
    const hostingId = getResourceId(hosting);
    if (!hostingId) continue;

    const mailboxes = toArray(await infomaniakRequest(`/mail/hosting/${hostingId}/mailbox`));
    const mailbox = mailboxes.find((candidate) => getMailboxEmail(candidate) === email);
    const mailboxId = getResourceId(mailbox);

    if (mailbox && mailboxId) {
      return { hostingId, mailboxId };
    }
  }

  throw new Error('Boite RétroMail introuvable dans le compte Infomaniak.');
};

export const getInfomaniakMailboxInfo = async (email) => {
  const mailbox = await findMailbox(email);
  return { email, hostingId: mailbox.hostingId, mailboxId: mailbox.mailboxId };
};

export const changeInfomaniakMailboxPassword = async (email, password) => {
  const mailbox = await findMailbox(email);
  await infomaniakRequest(`/mail/hosting/${mailbox.hostingId}/mailbox/${mailbox.mailboxId}`, {
    method: 'PATCH',
    body: { password }
  });
};