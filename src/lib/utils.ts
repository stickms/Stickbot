export function getSteamIdFromUrl(query: string) {
  const url = URL.parse(query);

  if (
    url?.hostname.includes('steamcommunity.com') &&
    (url.pathname.includes('/id/') || url.pathname.includes('/profiles/'))
  ) {
    return url.pathname.split('/')[2];
  }

  return query;
}
