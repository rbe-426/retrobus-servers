const INFOMANIAK_MAIL_API_BASE_URL = 'https://mail.infomaniak.com/api';

const toArray = (value) => {
  const data = value?.data ?? value;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const getMailboxEmail = (mailbox) => String(
  mailbox?.email || mailbox?.email_idn || mailbox?.email_address || mailbox?.address || mailbox?.mailbox || ''
).trim().toLowerCase();

const infomaniakRequest = async (path, options = {}) => {
  const token = String(process.env.INFOMANIAK_API_TOKEN || '').trim();
  if (!token) {
    throw new Error('Le jeton API Infomaniak n est pas configure.');
  }

  const response = await fetch(`${INFOMANIAK_MAIL_API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.result === 'error') {
    const description = response.status === 403
      ? 'Le jeton Infomaniak est reconnu, mais il n est pas autorisé à administrer cette boîte. Accordez-lui les droits de gestion de la messagerie et de la boîte concernée.'
      : payload?.error?.description || payload?.error?.message || 'La requête Infomaniak a échoué.';
    const error = new Error(description);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
};

const findMailbox = async (email) => {
  const mailboxes = toArray(await infomaniakRequest('/mailbox?with=aliases'));
  const mailbox = mailboxes.find((candidate) => getMailboxEmail(candidate) === email);
  const hostingId = mailbox?.hosting_id || mailbox?.hostingId;
  const mailboxName = mailbox?.real_mailbox || mailbox?.mailbox;

  if (mailbox && hostingId && mailboxName) {
    return { hostingId, mailboxName };
  }

  throw new Error('Boîte RétroMail introuvable ou non accessible avec le jeton Infomaniak.');
};

export const getInfomaniakMailboxInfo = async (email) => {
  const mailbox = await findMailbox(email);
  return { email, hostingId: mailbox.hostingId, mailboxName: mailbox.mailboxName };
};

export const changeInfomaniakMailboxPassword = async (email, password) => {
  const mailbox = await findMailbox(email);
  await infomaniakRequest(`/securedProxy/1/mail_hostings/${mailbox.hostingId}/mailboxes/${encodeURIComponent(mailbox.mailboxName)}`, {
    method: 'PATCH',
    body: { password }
  });
};