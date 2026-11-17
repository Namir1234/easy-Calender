/**
 * Die Client-ID des Google-OAuth-Clients vom Typ «Webanwendung».
 * Sie ist nicht geheim: Google lässt sie nur von den eingetragenen
 * Adressen aus zu (siehe docs/SETUP.md, Abschnitt Handy-Version).
 *
 * Zum Ausprobieren lässt sie sich auch in `.env` als
 * `WEB_GOOGLE_CLIENT_ID` setzen.
 */
const COMMITTED_CLIENT_ID = ''

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.WEB_GOOGLE_CLIENT_ID as string | undefined) || COMMITTED_CLIENT_ID
