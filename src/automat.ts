import { writeFile } from 'node:fs/promises';

export async function getToken(
  authority: string,
  audience: string,
  clientId: string,
  clientSecret: string,
  scope: string
): Promise<string> {
  const response = await fetch(`${authority}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience,
      scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Token response does not contain access_token');
  }
  return data.access_token;
}

export async function issuePass(
  url: string,
  token: string,
  name: string,
  document: string
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, document }),
  });

  if (response.status !== 201) {
    throw new Error(`Issuing pass failed with status ${response.status}`);
  }

  const location = response.headers.get('Location');
  if (!location) {
    throw new Error('Response does not contain Location header');
  }

  const id = location.split('/').pop();
  if (!id) {
    throw new Error('Could not extract pass identifier from Location header');
  }

  const image = Buffer.from(await response.arrayBuffer());
  await writeFile(`${id}.png`, image);
}